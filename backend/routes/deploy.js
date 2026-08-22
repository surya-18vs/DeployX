const express = require("express");
const axios = require("axios");
const store = require("../store/deploymentStore");
const {
  decodeFiles,
  detectFrontend,
  detectBackend,
  detectEnvVars,
  validateDatabaseURIs,
  detectMLDependencies,
  estimateCost,
  parseEnvContent,
  isSkippedPath,
} = require("../utils/detect");
const { scanSecrets, isEnvFile } = require("../utils/security");

const router = express.Router();

const RENDER_API_KEY = process.env.RENDER_API_KEY;
const RENDER_API_BASE = "https://api.render.com/v1";
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_API_BASE = "https://api.vercel.com";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent";

let cachedOwnerId = null;

async function getOwnerId() {
  if (cachedOwnerId) return cachedOwnerId;
  const { data } = await axios.get(`${RENDER_API_BASE}/owners`, {
    headers: { Authorization: `Bearer ${RENDER_API_KEY}` },
  });
  const ownerId = data?.[0]?.owner?.id;
  if (!ownerId) throw new Error("Could not resolve a Render owner ID from this API key.");
  cachedOwnerId = ownerId;
  return ownerId;
}

function requireAuth(req, res, next) {
  if (!req.user || !req.user.accessToken) {
    return res.status(401).json({ success: false, message: "Not logged in" });
  }
  next();
}

// ======================================================================
// EXISTING REPO-BASED FLOW (Render) — unchanged
// ======================================================================

router.post("/check", requireAuth, (req, res) => {
  const { files } = req.body;
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ success: false, message: "files array is required." });
  }

  const findFile = (name) => files.find((f) => f.path.split("/").pop() === name);
  const pkgFile = findFile("package.json");

  if (!pkgFile) {
    return res.json({
      success: true,
      deployable: false,
      reason: "No package.json found — can't determine how to build or run this project.",
    });
  }

  let pkg;
  try {
    const raw = pkgFile.content.startsWith("{")
      ? pkgFile.content
      : Buffer.from(pkgFile.content, "base64").toString("utf-8");
    pkg = JSON.parse(raw);
  } catch (err) {
    return res.json({
      success: true,
      deployable: false,
      reason: "package.json is not valid JSON — fix that before deploying.",
    });
  }

  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const hasVite = !!deps.vite;
  const hasReactScripts = !!deps["react-scripts"];
  const hasNext = !!deps.next;
  const hasExpress = !!deps.express;
  const hasBuildScript = !!(pkg.scripts && pkg.scripts.build);
  const hasStartScript = !!(pkg.scripts && pkg.scripts.start);

  const problems = [];
  if (!pkg.name) problems.push("package.json is missing a 'name' field.");
  if (hasNext && !hasBuildScript) problems.push("Next.js project but no 'build' script defined.");
  if (hasExpress && !hasStartScript) problems.push("Express project but no 'start' script defined.");

  let target = "unknown";
  if (hasNext || hasVite || hasReactScripts) {
    target = "static";
  } else if (hasExpress) {
    target = "server";
  }

  res.json({
    success: true,
    deployable: problems.length === 0 && target !== "unknown",
    target,
    problems,
    detected: { hasVite, hasReactScripts, hasNext, hasExpress },
  });
});

router.post("/render", requireAuth, async (req, res) => {
  if (!RENDER_API_KEY) {
    return res.status(500).json({ success: false, message: "RENDER_API_KEY is not configured on the server." });
  }

  const { repoUrl, branch = "main", serviceName, target } = req.body;
  if (!repoUrl || !serviceName || !target) {
    return res.status(400).json({
      success: false,
      message: "repoUrl, serviceName, and target ('static' or 'server') are required.",
    });
  }

  const isStatic = target === "static";
  let ownerId;
  try {
    ownerId = await getOwnerId();
  } catch (err) {
    console.error("deploy/render ownerId error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to resolve Render account owner ID." });
  }

  const payload = isStatic
    ? {
        type: "static_site",
        name: serviceName,
        ownerId,
        repo: repoUrl,
        branch,
        autoDeploy: "yes",
        serviceDetails: { buildCommand: "npm install && npm run build", publishPath: "dist" },
      }
    : {
        type: "web_service",
        name: serviceName,
        ownerId,
        repo: repoUrl,
        branch,
        autoDeploy: "yes",
        serviceDetails: { env: "node", plan: "free", buildCommand: "npm install", startCommand: "npm start" },
      };

  try {
    const { data } = await axios.post(`${RENDER_API_BASE}/services`, payload, {
      headers: { Authorization: `Bearer ${RENDER_API_KEY}` },
    });
    res.json({
      success: true,
      serviceId: data.service?.id,
      dashboardUrl: `https://dashboard.render.com/${isStatic ? "static" : "web"}/${data.service?.id}`,
    });
  } catch (err) {
    console.error("deploy/render error:", err.response?.data || err.message);
    res.status(500).json({ success: false, message: "Failed to create Render service." });
  }
});

router.get("/render/status", requireAuth, async (req, res) => {
  const { serviceId } = req.query;
  if (!serviceId) return res.status(400).json({ success: false, message: "serviceId is required." });
  if (!RENDER_API_KEY) return res.status(500).json({ success: false, message: "RENDER_API_KEY is not configured." });

  try {
    const { data: service } = await axios.get(`${RENDER_API_BASE}/services/${serviceId}`, {
      headers: { Authorization: `Bearer ${RENDER_API_KEY}` },
    });
    const { data: deploys } = await axios.get(`${RENDER_API_BASE}/services/${serviceId}/deploys?limit=1`, {
      headers: { Authorization: `Bearer ${RENDER_API_KEY}` },
    });
    const latestStatus = deploys?.[0]?.deploy?.status || "unknown";
    res.json({ success: true, status: latestStatus, live: latestStatus === "live", url: service?.serviceDetails?.url || null });
  } catch (err) {
    console.error("deploy/render/status error:", err.response?.data || err.message);
    res.status(500).json({ success: false, message: "Failed to fetch deploy status." });
  }
});

// ======================================================================
// NEW: NO-REPOSITORY FLOW
//
// Render's API only creates services from a git repo — there's no
// "upload raw files" option there. Vercel's Deployments API DOES accept
// inlined file content directly (v13/deployments), so the repo-less path
// targets Vercel. Render config is still generated for reference / in
// case this project later goes through the repo-based flow.
// ======================================================================

// Vercel only accepts a fixed enum of framework identifiers in
// projectSettings.framework. Our own detector can return values like
// "static" or "custom" that describe the project accurately but aren't
// valid Vercel framework slugs — passing those straight through causes
// Vercel to reject the deployment with a "bad_request" error. Anything
// not in this list gets sent as `framework: null`, which just tells
// Vercel "no preset, use the install/build commands as given."
const VERCEL_FRAMEWORK_SLUGS = new Set([
  "container", "blitzjs", "nextjs", "gatsby", "remix", "react-router", "astro", "hexo",
  "eleventy", "docusaurus-2", "docusaurus", "preact", "solidstart-1", "solidstart", "dojo",
  "ember", "vue", "scully", "ionic-angular", "angular", "polymer", "svelte", "sveltekit",
  "sveltekit-1", "ionic-react", "create-react-app", "gridsome", "umijs", "sapper", "saber",
  "stencil", "nuxtjs", "redwoodjs", "hugo", "jekyll", "brunch", "middleman", "zola", "hydrogen",
  "vite", "tanstack-start", "tanstack-start-lovable", "vitepress", "vuepress", "parcel",
  "fastapi", "flask", "fasthtml", "django", "ash", "eve", "sanity", "sanity-v2", "storybook",
  "nitro", "hono", "express", "h3", "koa", "nestjs", "elysia", "fastify", "xmcp", "python",
  "ruby", "rust", "axum", "actix-web", "bun", "node", "go", "services", "mastra",
]);

function toVercelFrameworkSlug(framework) {
  if (!framework) return null;
  // our detector uses "next" but Vercel's slug is "nextjs"
  if (framework === "next") return "nextjs";
  if (framework === "vue-vite") return "vite";
  return VERCEL_FRAMEWORK_SLUGS.has(framework) ? framework : null;
}

function generateVercelConfig({ frontend, backend }) {
  if (backend.detected && backend.runsAsLongLivedProcess && !frontend.detected) {
    return {
      warning:
        "This looks like a long-lived server (app.listen()-style). Vercel runs code as serverless functions, not a persistent process — this will likely need route-level adaptation to work on Vercel.",
      framework: null,
      buildCommand: null,
      outputDirectory: null,
      installCommand: "npm install",
      rootDir: backend.rootDir || "",
    };
  }
  return {
    framework: toVercelFrameworkSlug(frontend.framework),
    buildCommand: frontend.buildCommand,
    outputDirectory: frontend.outputDirectory,
    installCommand: "npm install",
    rootDir: frontend.rootDir || "",
  };
}

function generateRenderConfig({ frontend, backend }) {
  if (backend.detected) {
    return {
      services: [
        {
          type: "web_service",
          env: backend.language === "node" ? "node" : backend.language,
          buildCommand: "npm install",
          startCommand: backend.startCommand,
        },
      ],
    };
  }
  if (frontend.detected) {
    return {
      services: [
        {
          type: "static_site",
          buildCommand: frontend.buildCommand || "npm install && npm run build",
          publishPath: frontend.outputDirectory || "dist",
        },
      ],
    };
  }
  return null;
}

// ----------------------------------------------------------------------
// POST /api/deploy/analyze
// body: { files: [{ path, content }] }  content is always base64
// Runs: Deployment Intelligence Engine + Security Scanner + Generator
// ----------------------------------------------------------------------
router.post("/analyze", requireAuth, (req, res) => {
  const { files: rawFiles } = req.body;
  if (!Array.isArray(rawFiles) || rawFiles.length === 0) {
    return res.status(400).json({ success: false, message: "files array is required." });
  }

  const files = decodeFiles(rawFiles);

  const frontend = detectFrontend(files);
  const backend = detectBackend(files);
  const envVars = detectEnvVars(files);
  const ml = detectMLDependencies(files);
  const cost = estimateCost({ frontend, backend, ml });

  const envFile = files.find((f) => f.path.split("/").pop() === ".env" && !f.skippedDir);
  const envMap = envFile ? parseEnvContent(envFile.content) : {};
  const databaseUris = validateDatabaseURIs(envMap);

  const security = scanSecrets(files);
  // never send raw matched values back to the client — mask already applied in scanSecrets,
  // but strip the "expected" .env findings down to name/type only for a quieter report
  const securityReport = security.findings.map((f) => ({
    file: f.file,
    line: f.line,
    type: f.type,
    severity: f.severity,
    inEnvFile: f.expected,
    preview: f.match,
  }));

  const vercelConfig = generateVercelConfig({ frontend, backend });
  const renderConfig = generateRenderConfig({ frontend, backend });

  const readyToDeploy = !security.hasBlockingIssues && (frontend.detected || backend.detected);

  res.json({
    success: true,
    readyToDeploy,
    blockingReason: security.hasBlockingIssues
      ? "Unresolved secrets found outside of .env files. Remove or move them into environment variables before deploying."
      : !frontend.detected && !backend.detected
      ? "Couldn't detect a recognizable frontend or backend project structure."
      : null,
    intelligence: { frontend, backend, envVars, databaseUris, ml, cost },
    security: { findings: securityReport, blockingCount: security.blocking.length },
    generator: { vercel: vercelConfig, render: renderConfig },
  });
});

// ----------------------------------------------------------------------
// POST /api/deploy/vercel
// body: { projectName, files: [{ path, content }], envVars: { KEY: value }, vercelConfig }
// Real deployment via Vercel's REST API — no git repo involved.
// ----------------------------------------------------------------------
router.post("/vercel", requireAuth, async (req, res) => {
  if (!VERCEL_TOKEN) {
    return res.status(500).json({ success: false, message: "VERCEL_TOKEN is not configured on the server." });
  }

  const { projectName, files: rawFiles, envVars = {}, vercelConfig = {} } = req.body;
  if (!projectName || !Array.isArray(rawFiles) || rawFiles.length === 0) {
    return res.status(400).json({ success: false, message: "projectName and a non-empty files array are required." });
  }
  if (!/^[a-z0-9._-]+$/.test(projectName)) {
    return res.status(400).json({ success: false, message: "projectName can only contain lowercase letters, numbers, dots, dashes and underscores." });
  }

  const decoded = decodeFiles(rawFiles);

  // Re-run the scanner server-side — never trust the client to have honored
  // the /analyze warnings. Block the deploy if unresolved secrets remain.
  const security = scanSecrets(decoded);
  if (security.hasBlockingIssues) {
    return res.status(400).json({
      success: false,
      message: "Deploy blocked: unresolved secrets detected outside of .env files.",
      findings: security.blocking.map((f) => ({ file: f.file, line: f.line, type: f.type })),
    });
  }

  // Pull real values out of any .env file server-side, then strip env files
  // from what actually gets uploaded to Vercel — secrets go in as env vars,
  // never as committed file content.
  //
  // Also re-root every path relative to the detected project folder
  // (vercelConfig.rootDir, e.g. "myapp/frontend") — Vercel expects
  // package.json at the top of what it receives, and dropping a parent
  // folder that contains sibling projects (like a separate backend/) would
  // otherwise leave it nested and unbuildable.
  const rootDir = vercelConfig.rootDir || "";
  const rootPrefix = rootDir ? `${rootDir}/` : "";

  let envFromFile = {};
  const deployFiles = [];
  for (const f of rawFiles) {
    if (isSkippedPath(f.path)) continue;
    if (rootPrefix && !f.path.startsWith(rootPrefix)) continue; // outside the detected project — e.g. a sibling backend/ folder
    const relativePath = rootPrefix ? f.path.slice(rootPrefix.length) : f.path;
    if (!relativePath) continue;

    if (isEnvFile(relativePath)) {
      const decodedContent = Buffer.from(f.content, "base64").toString("utf-8");
      envFromFile = { ...envFromFile, ...parseEnvContent(decodedContent) };
      continue;
    }
    deployFiles.push({ file: relativePath, data: f.content, encoding: "base64" });
  }

  if (deployFiles.length === 0) {
    return res.status(400).json({
      success: false,
      message: "No files left to deploy after re-rooting — check that the detected project folder is correct.",
    });
  }

  const finalEnv = { ...envFromFile, ...envVars };

  // Normalize the incoming framework value the same way, in case the client
  // sent through the raw detector output rather than what /analyze returned.
  const safeFramework = toVercelFrameworkSlug(vercelConfig.framework);

  const payload = {
    name: projectName,
    files: deployFiles,
    target: "production",
    projectSettings: {
      framework: safeFramework,
      buildCommand: vercelConfig.buildCommand || null,
      outputDirectory: vercelConfig.outputDirectory || null,
      installCommand: vercelConfig.installCommand || "npm install",
    },
    env: finalEnv,
  };

  try {
    const { data } = await axios.post(`${VERCEL_API_BASE}/v13/deployments`, payload, {
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
    });

    await store.upsertRecord(req.user.username, projectName, {
      provider: "Vercel",
      status: "deploying",
      url: data.url ? `https://${data.url}` : null,
      deploymentId: data.id,
    });

    res.json({ success: true, deploymentId: data.id, url: data.url ? `https://${data.url}` : null, status: data.readyState });
  } catch (err) {
    console.error("deploy/vercel error:", err.response?.data || err.message);
    res.status(500).json({
      success: false,
      message: err.response?.data?.error?.message || "Failed to create Vercel deployment.",
    });
  }
});

// ----------------------------------------------------------------------
// GET /api/deploy/vercel/status?deploymentId=...
// ----------------------------------------------------------------------
router.get("/vercel/status", requireAuth, async (req, res) => {
  const { deploymentId } = req.query;
  if (!deploymentId) return res.status(400).json({ success: false, message: "deploymentId is required." });
  if (!VERCEL_TOKEN) return res.status(500).json({ success: false, message: "VERCEL_TOKEN is not configured." });

  try {
    const { data } = await axios.get(`${VERCEL_API_BASE}/v13/deployments/${deploymentId}`, {
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
    });

    const status = data.readyState; // QUEUED | INITIALIZING | BUILDING | READY | ERROR | CANCELED
    if (status === "READY" || status === "ERROR") {
      await store.upsertRecord(req.user.username, data.name, {
        provider: "Vercel",
        status: status === "READY" ? "live" : "failed",
        url: data.url ? `https://${data.url}` : null,
      });
    }

    res.json({ success: true, status, url: data.url ? `https://${data.url}` : null });
  } catch (err) {
    console.error("deploy/vercel/status error:", err.response?.data || err.message);
    res.status(500).json({ success: false, message: "Failed to fetch Vercel deployment status." });
  }
});

// ----------------------------------------------------------------------
// GET /api/deploy/vercel/logs?deploymentId=...
// ----------------------------------------------------------------------
router.get("/vercel/logs", requireAuth, async (req, res) => {
  const { deploymentId } = req.query;
  if (!deploymentId) return res.status(400).json({ success: false, message: "deploymentId is required." });
  if (!VERCEL_TOKEN) return res.status(500).json({ success: false, message: "VERCEL_TOKEN is not configured." });

  try {
    const { data } = await axios.get(`${VERCEL_API_BASE}/v3/deployments/${deploymentId}/events`, {
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
      params: { limit: 300 },
    });

    const logText = (Array.isArray(data) ? data : [])
      .filter((event) => event.text)
      .map((event) => event.text)
      .join("\n");

    res.json({ success: true, logs: logText });
  } catch (err) {
    console.error("deploy/vercel/logs error:", err.response?.data || err.message);
    res.status(500).json({ success: false, message: "Failed to fetch Vercel deployment logs." });
  }
});

// ----------------------------------------------------------------------
// POST /api/deploy/analyze-logs
// body: { logs: string }
// AI Log Analyzer — Claude reads the failing build log and suggests fixes.
// ----------------------------------------------------------------------
router.post("/analyze-logs", requireAuth, async (req, res) => {
  const { logs } = req.body;
  if (!logs || typeof logs !== "string") {
    return res.status(400).json({ success: false, message: "logs (string) is required." });
  }
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ success: false, message: "GEMINI_API_KEY is not configured on the server." });
  }

  try {
    const { data } = await axios.post(
      `${GEMINI_API_BASE}?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text:
                  "Here is a failed deployment build log. In under 200 words, identify the most likely root cause and give a specific, actionable fix. Skip preamble.\n\n" +
                  logs.slice(-12000),
              },
            ],
          },
        ],
      },
      { headers: { "content-type": "application/json" } }
    );

    const analysis = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") || "";

    res.json({ success: true, analysis });
  } catch (err) {
    console.error("deploy/analyze-logs error:", err.response?.data || err.message);
    res.status(500).json({ success: false, message: "Failed to analyze logs with Gemini." });
  }
});

module.exports = router;