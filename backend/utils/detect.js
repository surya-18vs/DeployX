const SKIP_DIR_SEGMENTS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "__pycache__", ".venv", "venv", ".vercel",
]);

const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "ico", "webp", "pdf", "zip", "gz", "tar",
  "woff", "woff2", "ttf", "eot", "otf", "mp4", "mp3", "wav", "exe", "dll", "so", "node", "wasm",
]);

const ML_PACKAGES = [
  "tensorflow", "torch", "pytorch", "scikit-learn", "sklearn", "keras",
  "transformers", "xgboost", "lightgbm", "onnxruntime", "opencv-python", "pandas", "numpy",
];

function isSkippedPath(path) {
  return path.split("/").some((seg) => SKIP_DIR_SEGMENTS.has(seg));
}

function decodeFiles(rawFiles) {
  // rawFiles: [{ path, content }] where content is always base64
  return rawFiles.map((f) => {
    const ext = (f.path.split(".").pop() || "").toLowerCase();
    const isBinary = BINARY_EXTENSIONS.has(ext);
    const skippedDir = isSkippedPath(f.path);
    let content = "";
    if (!isBinary) {
      try {
        content = Buffer.from(f.content, "base64").toString("utf-8");
      } catch {
        content = "";
      }
    }
    return { path: f.path, content, isBinary, skippedDir, size: f.content?.length || 0 };
  });
}

function findFile(files, matcher, { includeSkipped = false } = {}) {
  return files
    .filter((f) => includeSkipped || !f.skippedDir)
    .filter((f) => matcher(f.path))
    // prefer shallowest match (closer to project root)
    .sort((a, b) => a.path.split("/").length - b.path.split("/").length)[0];
}

function parsePackageJson(file) {
  if (!file) return null;
  try {
    return JSON.parse(file.content);
  } catch {
    return null;
  }
}

function parseEnvContent(content) {
  const map = {};
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eq = trimmed.indexOf("=");
    if (eq === -1) return;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) map[key] = value;
  });
  return map;
}

function dirnameOf(path) {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

function detectFrontend(files) {
  const pkgFile = findFile(files, (p) => p.endsWith("package.json"));
  const pkg = parsePackageJson(pkgFile);
  const deps = pkg ? { ...pkg.dependencies, ...pkg.devDependencies } : {};
  const indexHtml = findFile(files, (p) => p === "index.html" || p.endsWith("/index.html"));

  if (deps.next) {
    return { detected: true, framework: "next", buildCommand: "npm run build", outputDirectory: ".next", isFullstack: true, rootDir: dirnameOf(pkgFile.path) };
  }
  if (deps.vite) {
    const isVue = !!(deps.vue || deps["@vitejs/plugin-vue"]);
    const isReact = !!(deps.react || deps["@vitejs/plugin-react"]);
    return {
      detected: true,
      framework: isVue ? "vue-vite" : isReact ? "vite" : "vite",
      buildCommand: "npm run build",
      outputDirectory: "dist",
      rootDir: dirnameOf(pkgFile.path),
    };
  }
  if (deps["react-scripts"]) {
    return { detected: true, framework: "create-react-app", buildCommand: "npm run build", outputDirectory: "build", rootDir: dirnameOf(pkgFile.path) };
  }
  if (deps["@angular/core"]) {
    return { detected: true, framework: "angular", buildCommand: "npm run build", outputDirectory: "dist", rootDir: dirnameOf(pkgFile.path) };
  }
  if (deps.svelte) {
    return { detected: true, framework: "svelte", buildCommand: "npm run build", outputDirectory: "dist", rootDir: dirnameOf(pkgFile.path) };
  }

  // Catch-all for projects that have a recognizable frontend dependency or
  // bundler (React set up manually, Webpack, Parcel, Rollup, esbuild) but
  // don't match one of the named frameworks above. We can't be certain of
  // the exact output folder convention here, so we defer to whatever the
  // project's own package.json build script implies, rather than guessing
  // a framework-specific default.
  if (pkg && (deps.react || deps.webpack || deps["webpack-cli"] || deps.parcel || deps.rollup || deps.esbuild)) {
    const hasBuildScript = !!(pkg.scripts && pkg.scripts.build);
    return {
      detected: true,
      framework: "custom",
      buildCommand: hasBuildScript ? "npm run build" : null,
      outputDirectory: "dist",
      rootDir: dirnameOf(pkgFile.path),
    };
  }

  // Plain HTML/CSS/JS project — this now fires regardless of whether a
  // package.json exists (e.g. a stray package.json just for a linter or
  // local dev server shouldn't block detection of an otherwise static site).
  if (indexHtml) {
    return { detected: true, framework: "static", buildCommand: null, outputDirectory: ".", rootDir: dirnameOf(indexHtml.path) };
  }

  return { detected: false, framework: null, buildCommand: null, outputDirectory: null, rootDir: "" };
}

function detectBackend(files) {
  const pkgFile = findFile(files, (p) => p.endsWith("package.json"));
  const pkg = parsePackageJson(pkgFile);
  const deps = pkg ? { ...pkg.dependencies, ...pkg.devDependencies } : {};

  if (deps.express || deps.koa || deps.fastify || deps["@nestjs/core"]) {
    const framework = deps.express ? "express" : deps.koa ? "koa" : deps.fastify ? "fastify" : "nestjs";
    return {
      detected: true,
      language: "node",
      framework,
      startCommand: pkg.scripts?.start ? "npm start" : "node server.js",
      runsAsLongLivedProcess: true,
      rootDir: dirnameOf(pkgFile.path),
    };
  }

  const requirementsFile = findFile(files, (p) => p.endsWith("requirements.txt"));
  if (requirementsFile) {
    const reqText = requirementsFile.content.toLowerCase();
    const rootDir = dirnameOf(requirementsFile.path);
    if (reqText.includes("django")) return { detected: true, language: "python", framework: "django", startCommand: "gunicorn wsgi:application", runsAsLongLivedProcess: true, rootDir };
    if (reqText.includes("flask")) return { detected: true, language: "python", framework: "flask", startCommand: "gunicorn app:app", runsAsLongLivedProcess: true, rootDir };
    if (reqText.includes("fastapi")) return { detected: true, language: "python", framework: "fastapi", startCommand: "uvicorn main:app --host 0.0.0.0", runsAsLongLivedProcess: true, rootDir };
  }

  const gemfile = findFile(files, (p) => p.endsWith("Gemfile"));
  if (gemfile && gemfile.content.toLowerCase().includes("rails")) {
    return { detected: true, language: "ruby", framework: "rails", startCommand: "bundle exec rails server", runsAsLongLivedProcess: true, rootDir: dirnameOf(gemfile.path) };
  }

  const goMod = findFile(files, (p) => p.endsWith("go.mod"));
  if (goMod) {
    return { detected: true, language: "go", framework: "go", startCommand: "go run .", runsAsLongLivedProcess: true, rootDir: dirnameOf(goMod.path) };
  }

  return { detected: false, language: null, framework: null, startCommand: null, runsAsLongLivedProcess: false, rootDir: "" };
}

function detectEnvVars(files) {
  const referenced = new Set();

  for (const f of files) {
    if (f.isBinary || f.skippedDir) continue;
    let m;
    const jsPattern = /process\.env\.([A-Z0-9_]+)/g;
    while ((m = jsPattern.exec(f.content)) !== null) referenced.add(m[1]);
    const vitePattern = /import\.meta\.env\.([A-Z0-9_]+)/g;
    while ((m = vitePattern.exec(f.content)) !== null) referenced.add(m[1]);
    const pyPattern1 = /os\.environ(?:\.get)?\(\s*['"]([A-Z0-9_]+)['"]/g;
    while ((m = pyPattern1.exec(f.content)) !== null) referenced.add(m[1]);
    const pyPattern2 = /os\.getenv\(\s*['"]([A-Z0-9_]+)['"]/g;
    while ((m = pyPattern2.exec(f.content)) !== null) referenced.add(m[1]);
  }

  const envFile = findFile(files, (p) => p.split("/").pop() === ".env");
  const envExampleFile = findFile(files, (p) => p.split("/").pop() === ".env.example");
  const envMap = envFile ? parseEnvContent(envFile.content) : {};
  const exampleMap = envExampleFile ? parseEnvContent(envExampleFile.content) : {};

  const providedKeys = new Set(Object.keys(envMap));
  const allKnownKeys = new Set([...referenced, ...Object.keys(exampleMap)]);
  const missing = [...allKnownKeys].filter((k) => !providedKeys.has(k));

  return {
    referenced: [...referenced],
    providedInEnvFile: [...providedKeys],
    missing,
    hasEnvFile: !!envFile,
    hasEnvExample: !!envExampleFile,
  };
}

const DB_URI_PATTERNS = [
  { name: "MongoDB", regex: /^mongodb(\+srv)?:\/\/.+/ },
  { name: "PostgreSQL", regex: /^postgres(ql)?:\/\/.+/ },
  { name: "MySQL", regex: /^mysql:\/\/.+/ },
  { name: "Redis", regex: /^rediss?:\/\/.+/ },
];

function validateDatabaseURIs(envMap) {
  const results = [];
  for (const [key, value] of Object.entries(envMap)) {
    if (!/URI|URL|DATABASE|DB_|MONGO|POSTGRES|MYSQL|REDIS/i.test(key)) continue;
    if (!value) continue;
    const matchedType = DB_URI_PATTERNS.find((p) => p.regex.test(value));
    results.push({
      key,
      looksValid: !!matchedType,
      detectedType: matchedType?.name || null,
      preview: value.length > 12 ? `${value.slice(0, 10)}...` : "(too short to be a real URI)",
    });
  }
  return results;
}

function detectMLDependencies(files) {
  const matched = new Set();

  const pkgFile = findFile(files, (p) => p.endsWith("package.json"));
  const pkg = parsePackageJson(pkgFile);
  if (pkg) {
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    for (const dep of deps) {
      if (ML_PACKAGES.some((mlPkg) => dep.toLowerCase().includes(mlPkg))) matched.add(dep);
    }
  }

  const reqFile = findFile(files, (p) => p.endsWith("requirements.txt"));
  if (reqFile) {
    reqFile.content.split("\n").forEach((line) => {
      const name = line.split(/[=<>~]/)[0].trim().toLowerCase();
      if (ML_PACKAGES.includes(name)) matched.add(name);
    });
  }

  return { detected: matched.size > 0, matched: [...matched] };
}

function estimateCost({ frontend, backend, ml }) {
  if (backend.detected && ml.detected) {
    return {
      tier: "likely needs a paid tier",
      note: "ML dependencies plus a live backend usually exceed free-tier build size, memory, or execution-time limits. Check current Render/Vercel pricing pages for exact numbers — this is a heads-up, not a quote.",
    };
  }
  if (backend.detected && backend.runsAsLongLivedProcess) {
    return {
      tier: "free tier likely workable, watch cold starts",
      note: "A long-lived server (Express/Flask/Rails-style) fits free tiers on most providers but may sleep on idle — fine for demos, not for production traffic.",
    };
  }
  if (frontend.detected && !backend.detected) {
    return {
      tier: "free tier",
      note: "A static/frontend-only build is the cheapest thing to host — free tiers on Vercel/Render/Netlify comfortably cover this.",
    };
  }
  return { tier: "unknown", note: "Couldn't confidently classify this project — see the detection warnings above." };
}

module.exports = {
  decodeFiles,
  findFile,
  parsePackageJson,
  parseEnvContent,
  detectFrontend,
  detectBackend,
  detectEnvVars,
  validateDatabaseURIs,
  detectMLDependencies,
  estimateCost,
  isSkippedPath,
  dirnameOf,
};