import { useState, useCallback, useEffect, useRef } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5002";

// Files we never want to push (build artifacts, deps, secrets, vcs internals)
const IGNORE_PATTERNS = [
  /node_modules/,
  /(^|\/)\.git\//,
  /(^|\/)dist\//,
  /(^|\/)build\//,
  /(^|\/)\.env$/,
  /(^|\/)\.DS_Store$/,
];

const NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

function shouldIgnore(relativePath) {
  return IGNORE_PATTERNS.some((pattern) => pattern.test(relativePath));
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// browser btoa() only handles Latin1 — this survives UTF-8 content (accented
// names, emoji, etc.) that a user-written README might contain
function textToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function base64ToText(b64) {
  try {
    return decodeURIComponent(escape(atob(b64)));
  } catch {
    return atob(b64);
  }
}

// Looks for a root-level package.json among the read files and returns a
// safe, deterministic setup command from its scripts — never guessed, so
// this only produces output when it's confident (or produces nothing).
function detectSetupCommand(files) {
  const pkgFile = files.find((f) => f.path === "package.json" || f.path.endsWith("/package.json"));
  if (!pkgFile) return null;
  try {
    const pkg = JSON.parse(base64ToText(pkgFile.content));
    const scripts = pkg.scripts || {};
    if (scripts.dev) return "npm run dev";
    if (scripts.start) return "npm start";
    if (scripts.build) return "npm run build";
    return null;
  } catch {
    return null;
  }
}

// Builds a render.yaml Blueprint from the same server-side detection
// /api/deploy/analyze already runs (generator.render). Only produces a file
// when there's a confirmed start command — a Blueprint with a guessed or
// missing startCommand would fail on Render's side, so this stays silent
// (returns null) rather than shipping something broken.
//
// rootDir matters for monorepos (frontend + backend in the same repo) —
// without it, Render looks for package.json at the repo root even when the
// backend actually lives in a subfolder like "server/" or "backend/".
function buildRenderYaml(renderConfig, repoName, rootDir) {
  const svc = renderConfig?.services?.[0];
  if (!svc || svc.type !== "web_service" || !svc.buildCommand || !svc.startCommand) return null;

  const safeName = (repoName || "app").toLowerCase().replace(/[^a-z0-9-]/g, "-");

  const lines = [
    "services:",
    "  - type: web",
    `    name: ${safeName}`,
    `    runtime: ${svc.env === "node" ? "node" : svc.env}`,
    "    plan: free",
  ];
  if (rootDir) lines.push(`    rootDir: ${rootDir}`);
  lines.push(
    `    buildCommand: ${svc.buildCommand}`,
    `    startCommand: ${svc.startCommand}`,
    // recommended by Render for Deploy-to-Render-button flows: prevents
    // future pushes to THIS repo from redeploying every Blueprint instance
    // anyone else deployed from it
    "    autoDeploy: false",
    ""
  );

  return lines.join("\n");
}

// Builds README.md content entirely from what the user typed — no AI
// involved. Sections are only included when there's something to put in
// them, so an empty description or tech stack just quietly omits that part.
function buildReadmeMarkdown({ title, description, techStack, files }) {
  const lines = [`# ${title.trim() || "Untitled Project"}`, ""];

  if (description.trim()) {
    lines.push(description.trim(), "");
  }

  if (techStack.length > 0) {
    lines.push("## Tech Stack", "");
    techStack.forEach((tech) => lines.push(`- ${tech}`));
    lines.push("");
  }

  const setupCommand = detectSetupCommand(files);
  if (setupCommand) {
    lines.push("## Setup", "", "```bash", "npm install", setupCommand, "```", "");
  }

  return lines.join("\n").trim() + "\n";
}

function logTone(line) {
  if (line.startsWith("[error]")) return "text-red-400";
  if (line.startsWith("[warn]")) return "text-amber-400";
  if (line.startsWith("[ok]")) return "text-emerald-400";
  return "text-gray-400";
}

const STEP_LABELS = {
  idle: "Waiting for a project",
  reading: "Reading files",
  readme_form: "Project details",
  creating_repo: "Creating repo",
  pushing: "Pushing files",
  checking: "Analyzing project",
  ask_continue: "Awaiting input",
  connect_vercel: "Awaiting input",
  await_tier: "Awaiting input",
  deploying: "Deploying",
  patching_readme: "Patching README",
  done: "Complete",
  error: "Failed",
};

// Ordered phases of this pipeline — used only to drive the stepper UI below.
// Purely derived from `step`, no effect on the pipeline logic itself.
const PIPELINE_PHASES = [
  { key: "setup", label: "Setup", match: (s) => s === "idle" },
  { key: "read", label: "Read", match: (s) => s === "reading" },
  { key: "readme", label: "README", match: (s) => s === "readme_form" },
  { key: "verify", label: "Verify", match: (s) => s === "checking" },
  { key: "push", label: "Push", match: (s) => s === "creating_repo" || s === "pushing" },
  {
    key: "deploy",
    label: "Deploy",
    match: (s) => ["ask_continue", "connect_vercel", "await_tier", "deploying", "patching_readme"].includes(s),
  },
  { key: "done", label: "Done", match: (s) => s === "done" || s === "error" },
];

/* ---------- small inline icons (no emoji) ---------- */

function CheckIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={`w-4 h-4 shrink-0 ${className}`}>
      <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
    </svg>
  );
}

function XIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={`w-4 h-4 shrink-0 ${className}`}>
      <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
    </svg>
  );
}

function Spinner({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`w-4 h-4 shrink-0 animate-spin ${className}`}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function FolderIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={`w-5 h-5 shrink-0 ${className}`}>
      <path d="M2 4.5A1.5 1.5 0 013.5 3h4.086a1.5 1.5 0 011.06.44l1.415 1.413A1.5 1.5 0 0011.12 5.5H16.5A1.5 1.5 0 0118 7v8a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 012 15V4.5z" />
    </svg>
  );
}

/* ---------- shared primitives — same visual language as the deploy flow ---------- */

function Card({ children, className = "" }) {
  return <div className={`border border-gray-800 bg-[#0d1117] rounded-xl p-5 ${className}`}>{children}</div>;
}

function Pill({ tone = "neutral", children }) {
  const styles = {
    ok: "text-emerald-400 bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/20",
    warn: "text-amber-400 bg-amber-500/10 ring-1 ring-inset ring-amber-500/20",
    danger: "text-red-400 bg-red-500/10 ring-1 ring-inset ring-red-500/20",
    neutral: "text-gray-400 bg-gray-500/10 ring-1 ring-inset ring-gray-500/10",
  }[tone];
  return <span className={`text-xs font-medium rounded-md px-2 py-0.5 whitespace-nowrap ${styles}`}>{children}</span>;
}

// Slim horizontal stepper — this pipeline genuinely runs through these
// phases in order, so the numbering encodes real progress, not decoration.
function Pipeline({ phases, currentIndex, danger = false }) {
  return (
    <div className="flex items-center w-full mb-6">
      {phases.map((phase, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        const isLastActive = active && danger;
        return (
          <div key={phase.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${
                  isLastActive
                    ? "bg-red-500/15 border-red-500 text-red-400"
                    : done
                    ? "bg-emerald-500 border-emerald-500 text-black"
                    : active
                    ? "bg-emerald-500/15 border-emerald-500 text-emerald-400"
                    : "bg-transparent border-gray-800 text-gray-700"
                }`}
              >
                {done ? <CheckIcon className="w-3 h-3" /> : i + 1}
              </div>
              <span
                className={`text-[10px] uppercase tracking-wide whitespace-nowrap ${
                  isLastActive ? "text-red-400" : active || done ? "text-gray-300" : "text-gray-700"
                }`}
              >
                {phase.label}
              </span>
            </div>
            {i < phases.length - 1 && (
              <div className={`h-px flex-1 mx-2 mb-4 transition-colors ${done ? "bg-emerald-500" : "bg-gray-800"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------- */

function Newrepositories() {
  const [pickedFiles, setPickedFiles] = useState([]);
  const [folderName, setFolderName] = useState("");
  const [repoName, setRepoName] = useState("");
  const [nameStatus, setNameStatus] = useState("idle"); // idle | checking | available | taken | invalid | error
  const [step, setStep] = useState("idle");
  const [log, setLog] = useState([]);
  const [deployInfo, setDeployInfo] = useState(null);
  // "static" (frontend only) | "server" (backend only) | "both" (frontend + backend)
  const [detectedTarget, setDetectedTarget] = useState(null);
  const [repoDone, setRepoDone] = useState(false);
  const [deployedUrl, setDeployedUrl] = useState(null);
  const [notDeployableReason, setNotDeployableReason] = useState(null);
  // kept from the read step so the Vercel deploy call (later, on user
  // confirmation) can send file content directly — Vercel's API takes
  // files, not a repo URL, unlike Render's git-based service creation
  const [readFiles, setReadFiles] = useState(null);
  const [readmeTitle, setReadmeTitle] = useState("");
  const [readmeDescription, setReadmeDescription] = useState("");
  const [readmeTechStack, setReadmeTechStack] = useState([]);
  const [techInput, setTechInput] = useState("");
  const [vercelConnected, setVercelConnected] = useState(null); // null = unknown yet
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [isBackendHandoff, setIsBackendHandoff] = useState(false);
  const [renderBlueprintAvailable, setRenderBlueprintAvailable] = useState(false);

  const terminalRef = useRef(null);
  const terminalWrapRef = useRef(null);

  const addLog = useCallback((msg) => {
    setLog((prev) => [...prev, msg]);
  }, []);

  // auto-scroll the terminal to the latest line
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [log]);

  // debounced repo-name availability check, GitHub-style
  useEffect(() => {
    const trimmed = repoName.trim();

    if (!trimmed) {
      setNameStatus("idle");
      return;
    }
    if (!NAME_PATTERN.test(trimmed)) {
      setNameStatus("invalid");
      return;
    }

    setNameStatus("checking");
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/repo/check-name?name=${encodeURIComponent(trimmed)}`,
          { credentials: "include", signal: controller.signal }
        );
        const data = await res.json();
        setNameStatus(data.available ? "available" : "taken");
      } catch (err) {
        if (err.name !== "AbortError") setNameStatus("error");
      }
    }, 450);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [repoName]);

  const locked = step !== "idle" && step !== "error";

  const handleFolderSelect = (e) => {
    const list = Array.from(e.target.files || []);
    const filtered = list.filter((f) => !shouldIgnore(f.webkitRelativePath));
    setPickedFiles(filtered);
    setFolderName(filtered[0]?.webkitRelativePath?.split("/")[0] || "project");
  };

  const clearFolder = () => {
    setPickedFiles([]);
    setFolderName("");
  };

  const resetAll = () => {
    setStep("idle");
    setLog([]);
    setDeployInfo(null);
    setDetectedTarget(null);
    setRepoDone(false);
    setDeployedUrl(null);
    setNotDeployableReason(null);
    setPickedFiles([]);
    setFolderName("");
    setRepoName("");
    setNameStatus("idle");
    setReadFiles(null);
    setReadmeTitle("");
    setReadmeDescription("");
    setReadmeTechStack([]);
    setTechInput("");
    setVercelConnected(null);
    setCheckingConnection(false);
    setIsBackendHandoff(false);
    setRenderBlueprintAvailable(false);
  };

  const addTechTag = () => {
    const value = techInput.trim();
    if (!value) return;
    if (!readmeTechStack.includes(value)) {
      setReadmeTechStack((prev) => [...prev, value]);
    }
    setTechInput("");
  };

  const removeTechTag = (tag) => {
    setReadmeTechStack((prev) => prev.filter((t) => t !== tag));
  };

  const handleTechInputKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTechTag();
    }
  };

  const scrollToTerminal = () => {
    terminalWrapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const runPipeline = async () => {
    if (nameStatus !== "available" || pickedFiles.length === 0) return;

    scrollToTerminal();

    try {
      setStep("reading");
      addLog("Reading files from folder...");
      const files = await Promise.all(
        pickedFiles.map(async (file) => ({
          path: file.webkitRelativePath.split("/").slice(1).join("/") || file.name,
          content: await readFileAsBase64(file),
        }))
      );
      setReadFiles(files);
      setReadmeTitle(repoName);
      setStep("readme_form");
    } catch (err) {
      addLog(`[error] ${err.message}`);
      setStep("error");
    }
  };

  const continueAfterReadme = async () => {
    if (!readFiles) return;

    try {
      const readmeContent = buildReadmeMarkdown({
        title: readmeTitle,
        description: readmeDescription,
        techStack: readmeTechStack,
        files: readFiles,
      });

      // drop any README.md the folder already had, then add the one just
      // built from the form — so what the user entered is always what ships
      const withoutExistingReadme = readFiles.filter(
        (f) => f.path.split("/").pop()?.toLowerCase() !== "readme.md"
      );
      let files = [
        ...withoutExistingReadme,
        { path: "README.md", content: textToBase64(readmeContent) },
      ];

      setStep("checking");
      addLog("Analyzing project...");
      // Runs before the repo even exists — /analyze only needs file content,
      // not a live repo — so a render.yaml Blueprint can be generated and
      // included in the very first commit when this is a backend project.
      const checkRes = await fetch(`${API_URL}/api/deploy/analyze`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files }),
      });
      const checkData = await checkRes.json();

      const hasFrontend = !!checkData.intelligence?.frontend?.detected;
      const hasBackend = !!checkData.intelligence?.backend?.detected;
      // "both" is the case that was previously silently dropped — the old
      // logic only ever checked backend.detected, so a project with a
      // frontend AND a backend got treated as backend-only and the
      // frontend never got a Vercel deploy at all.
      const target = hasFrontend && hasBackend ? "both" : hasBackend ? "server" : hasFrontend ? "static" : "none";

      const vercelConfig = checkData.generator?.vercel || {};
      const renderConfig = checkData.generator?.render || null;
      const backendRootDir = checkData.intelligence?.backend?.rootDir || "";

      let renderBlueprintReady = false;
      if (hasBackend) {
        const renderYaml = buildRenderYaml(renderConfig, repoName, backendRootDir);
        if (renderYaml) {
          files = [...files, { path: "render.yaml", content: textToBase64(renderYaml) }];
          renderBlueprintReady = true;
        }
      }
      setRenderBlueprintAvailable(renderBlueprintReady);
      setReadFiles(files);

      setStep("creating_repo");
      addLog(`Creating repo "${repoName}" on GitHub...`);
      const createRes = await fetch(`${API_URL}/api/repo/create`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: repoName, private: false }),
      });
      const createData = await createRes.json();
      if (!createData.success) throw new Error(createData.message);
      addLog(`[ok] Repo created: ${createData.repo.html_url}`);

      const [owner, repo] = createData.repo.full_name.split("/");
      const branch = createData.repo.default_branch;

      setStep("pushing");
      addLog("Pushing files to repo...");
      const pushRes = await fetch(`${API_URL}/api/repo/push`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, branch, files }),
      });
      const pushData = await pushRes.json();
      if (!pushData.success) throw new Error(pushData.message);
      addLog(`[ok] Pushed ${pushData.filesPushed} files. Commit: ${pushData.commitUrl}`);
      setRepoDone(true);

      setDeployInfo({
        owner,
        repo,
        branch,
        htmlUrl: createData.repo.html_url,
        cloneUrl: createData.repo.clone_url,
        target,
        vercelConfig,
      });

      if (!checkData.success || !checkData.readyToDeploy) {
        setNotDeployableReason(
          checkData.blockingReason || "Project could not be verified as deployable."
        );
        addLog(`[warn] Not deployable: ${checkData.blockingReason || "unknown reason"}`);
        setStep("done");
        return;
      }

      const targetLabel =
        target === "both"
          ? "frontend + backend"
          : target === "static"
          ? "frontend (static site)"
          : "backend (web service)";
      addLog(
        `[ok] Deployable. Detected type: ${targetLabel}` +
          (renderBlueprintReady ? " — render.yaml included for one-click Render deploy." : "")
      );
      setDetectedTarget(target);
      setStep("ask_continue");
    } catch (err) {
      addLog(`[error] ${err.message}`);
      setStep("error");
    }
  };

  const handleContinueChoice = async (wantsToDeploy) => {
    if (!wantsToDeploy) {
      addLog("Deployment skipped. Repository is ready on GitHub.");
      setStep("done");
      return;
    }

    if (detectedTarget === "server") {
      // No API automation for backend-only deploys — Railway's public API
      // isn't reliably usable for arbitrary third-party repos yet, so this
      // hands off to Render/Railway's own pickers instead of scripting
      // something fragile.
      addLog("Backend detected — hand off to Render/Railway for deployment.");
      setIsBackendHandoff(true);
      setStep("done");
      return;
    }

    if (detectedTarget === "both") {
      // Frontend still deploys automatically via Vercel below; the backend
      // hand-off card gets flagged now so it shows up alongside the Vercel
      // result once we land on "done" — both parts of a fullstack repo get
      // surfaced together instead of one silently disappearing.
      addLog("Frontend + backend detected — deploying frontend to Vercel; backend hosting links follow after.");
      setIsBackendHandoff(true);
    }

    // "static" or "both" both continue into the Vercel connection flow —
    // in the "both" case this only ever deploys the frontend half.
    setCheckingConnection(true);
    try {
      const res = await fetch(`${API_URL}/api/connections`, { credentials: "include" });
      const data = await res.json();
      const connected = data.success && data.connections?.some((c) => c.provider === "vercel");
      setVercelConnected(connected);
      setStep(connected ? "await_tier" : "connect_vercel");
    } catch {
      setVercelConnected(false);
      setStep("connect_vercel");
    } finally {
      setCheckingConnection(false);
    }
  };

  const connectVercel = async () => {
    try {
      const res = await fetch(`${API_URL}/api/connections/vercel/install-url`, { credentials: "include" });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      addLog(`[error] Couldn't start the Vercel connection: ${err.message}`);
    }
  };

  const recheckVercelConnection = async () => {
    setCheckingConnection(true);
    try {
      const res = await fetch(`${API_URL}/api/connections`, { credentials: "include" });
      const data = await res.json();
      const connected = data.success && data.connections?.some((c) => c.provider === "vercel");
      setVercelConnected(connected);
      if (connected) setStep("await_tier");
    } finally {
      setCheckingConnection(false);
    }
  };

  const handleDeploy = async (tier) => {
    if (!deployInfo || !readFiles) return;
    setStep("deploying");

    try {
      addLog(
        `Creating Vercel deployment for the frontend (tier requested: ${tier}, currently free-plan only)...`
      );
      const projectName = repoName.trim().toLowerCase();
      const deployRes = await fetch(`${API_URL}/api/deploy/vercel`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName,
          files: readFiles,
          envVars: {},
          // vercelConfig.rootDir already points at the frontend subfolder
          // when this is a monorepo (the "both" case) — the backend route
          // computed that server-side during /analyze, so a fullstack repo
          // still re-roots correctly to just the frontend files here.
          vercelConfig: deployInfo.vercelConfig,
        }),
      });
      const deployData = await deployRes.json();
      if (!deployData.success) {
        if (deployData.code === "vercel_not_connected") {
          setVercelConnected(false);
          setStep("connect_vercel");
          addLog("[warn] Vercel connection was lost — reconnect to continue.");
          return;
        }
        throw new Error(deployData.message);
      }
      addLog("Deployment created. Waiting for it to go live...");

      let live = false;
      let liveUrl = null;
      let failed = false;
      for (let i = 0; i < 30 && !live && !failed; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const statusRes = await fetch(
          `${API_URL}/api/deploy/vercel/status?deploymentId=${deployData.deploymentId}`,
          { credentials: "include" }
        );
        const statusData = await statusRes.json();
        addLog(`Status: ${statusData.status}`);
        if (statusData.status === "READY") {
          live = true;
          liveUrl = statusData.url;
        } else if (statusData.status === "ERROR" || statusData.status === "CANCELED") {
          failed = true;
        }
      }

      if (failed) {
        addLog("[error] Vercel build failed.");
        try {
          const logsRes = await fetch(
            `${API_URL}/api/deploy/vercel/logs?deploymentId=${deployData.deploymentId}`,
            { credentials: "include" }
          );
          const logsData = await logsRes.json();
          if (logsData.success && logsData.logs) {
            const analyzeRes = await fetch(`${API_URL}/api/deploy/analyze-logs`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ logs: logsData.logs }),
            });
            const analyzeData = await analyzeRes.json();
            if (analyzeData.success && analyzeData.analysis) {
              addLog(`[warn] AI analysis: ${analyzeData.analysis}`);
            }
          }
        } catch {
          // log analysis is best-effort; don't block the error path on it
        }
        setStep("error");
        return;
      }

      if (!live) {
        addLog("[warn] Timed out waiting for deploy to go live. Check the Vercel dashboard.");
        setStep("error");
        return;
      }

      addLog(`[ok] Live at ${liveUrl}`);

      setStep("patching_readme");
      addLog("Adding deployed link to README...");
      const patchRes = await fetch(`${API_URL}/api/repo/readme-patch`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: deployInfo.owner,
          repo: deployInfo.repo,
          branch: deployInfo.branch,
          deployedUrl: liveUrl,
        }),
      });
      const patchData = await patchRes.json();
      if (!patchData.success) throw new Error(patchData.message);

      addLog("[ok] README updated.");
      setDeployedUrl(liveUrl);
      setStep("done");
    } catch (err) {
      addLog(`[error] ${err.message}`);
      setStep("error");
    }
  };

  const isBusy =
    step !== "idle" &&
    step !== "error" &&
    step !== "done" &&
    step !== "ask_continue" &&
    step !== "connect_vercel" &&
    step !== "await_tier" &&
    step !== "readme_form";
  const canRun = !locked && nameStatus === "available" && pickedFiles.length > 0;
  const statusTone = step === "error" ? "danger" : step === "done" ? "ok" : isBusy ? "warn" : "neutral";
  const phaseIndex = PIPELINE_PHASES.findIndex((p) => p.match(step));

  const nameFieldClasses = {
    idle: "border-gray-800 bg-[#0d1117] focus:border-emerald-600",
    checking: "border-gray-800 bg-[#0d1117] focus:border-emerald-600",
    available: "border-emerald-600 bg-emerald-500/[0.04] focus:border-emerald-500",
    taken: "border-red-600 bg-red-500/[0.04] focus:border-red-500",
    invalid: "border-red-600 bg-red-500/[0.04] focus:border-red-500",
    error: "border-red-600 bg-red-500/[0.04] focus:border-red-500",
  }[nameStatus];

  return (
    <div className="min-h-full bg-black">
      <div className="max-screen  mx-4 px-6 py-10">
        {/* header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold uppercase text-white tracking-tight">New Project</h1>
            <p className="text-sm text-gray-500 mt-0.5">Push a project folder straight to GitHub, with an optional deploy.</p>
          </div>
          <Pill tone={statusTone}>{STEP_LABELS[step] || step}</Pill>
        </div>

        <Pipeline phases={PIPELINE_PHASES} currentIndex={phaseIndex} danger={step === "error"} />

        {/* two-column layout: controls on the left, terminal on the right */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* ---------------- LEFT: controls ---------------- */}
          <div className="w-full lg:max-w-xl flex flex-col gap-4">
            {/* repo name */}
            <div className={locked ? "opacity-50" : ""}>
              <input
                type="text"
                placeholder="Repository name"
                value={repoName}
                disabled={locked}
                onChange={(e) => setRepoName(e.target.value)}
                className={`w-full h-11 border rounded-lg px-4 outline-none font-medium text-white placeholder-gray-600 text-sm transition-colors disabled:cursor-not-allowed ${nameFieldClasses}`}
              />
              {nameStatus === "taken" && (
                <p className="text-red-400 text-xs mt-1.5 ml-1">That name is already taken.</p>
              )}
              {nameStatus === "invalid" && (
                <p className="text-red-400 text-xs mt-1.5 ml-1">
                  Use only letters, numbers, hyphens, underscores, and periods.
                </p>
              )}
              {nameStatus === "available" && (
                <p className="text-emerald-400 text-xs mt-1.5 ml-1">Name available.</p>
              )}
              {nameStatus === "error" && (
                <p className="text-red-400 text-xs mt-1.5 ml-1">Couldn't check availability. Try again.</p>
              )}
            </div>

            {/* folder picker / selected folder chip */}
            <div className={locked ? "opacity-50" : ""}>
              {pickedFiles.length === 0 ? (
                <label className="flex flex-col items-center justify-center gap-1.5 border border-dashed border-gray-800 rounded-xl py-16 cursor-pointer hover:border-emerald-600/60 hover:bg-emerald-500/[0.03] transition-colors">
                  <input
                    type="file"
                    webkitdirectory=""
                    directory=""
                    multiple
                    className="hidden"
                    disabled={locked}
                    onChange={handleFolderSelect}
                  />
                  <FolderIcon className="text-gray-600 mb-1" />
                  <p className="text-sm text-gray-300 font-medium">Choose your project folder</p>
                  <p className="text-xs text-gray-600">node_modules, .git, dist, build and .env are skipped automatically</p>
                </label>
              ) : (
                <Card className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-gray-200">
                    <FolderIcon className="text-emerald-400" />
                    <span className="text-sm font-medium">{folderName}</span>
                    <span className="text-xs text-gray-600">{pickedFiles.length} files</span>
                  </div>
                  {!locked && (
                    <button
                      onClick={clearFolder}
                      aria-label="Remove folder"
                      className="text-gray-600 hover:text-gray-300 transition-colors"
                    >
                      <XIcon />
                    </button>
                  )}
                </Card>
              )}
            </div>

            {/* run button — only shown before the pipeline has started */}
            {step === "idle" && (
              <button
                onClick={runPipeline}
                disabled={!canRun}
                className="h-11 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-800 disabled:text-gray-600 text-black text-sm font-semibold transition-colors"
              >
                Create repo &amp; push
              </button>
            )}

            {/* working */}
            {(step === "reading" || step === "checking" || step === "creating_repo" || step === "pushing" || step === "patching_readme") && (
              <Card className="flex items-center justify-center gap-2.5 py-8">
                <Spinner className="text-emerald-400" />
                <p className="text-sm text-gray-300">{STEP_LABELS[step]}...</p>
              </Card>
            )}

            {/* README details form — fully user-authored, built client-side */}
            {step === "readme_form" && (
              <Card className="flex flex-col gap-3">
                <p className="text-sm font-medium text-white">Add a few details for the README</p>

                <div>
                  <label className="text-xs text-gray-500">Title</label>
                  <input
                    type="text"
                    value={readmeTitle}
                    onChange={(e) => setReadmeTitle(e.target.value)}
                    placeholder={repoName || "Project title"}
                    className="w-full mt-1 border border-gray-800 bg-black rounded-lg px-3 py-2 text-sm text-white placeholder-gray-700 outline-none focus:border-emerald-600 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500">
                    Description <span className="text-gray-700">(optional)</span>
                  </label>
                  <textarea
                    value={readmeDescription}
                    onChange={(e) => setReadmeDescription(e.target.value)}
                    placeholder="What does this project do?"
                    rows={3}
                    className="w-full mt-1 border border-gray-800 bg-black rounded-lg px-3 py-2 text-sm text-white placeholder-gray-700 outline-none focus:border-emerald-600 transition-colors resize-y"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500">
                    Tech stack <span className="text-gray-700">(optional — press Enter to add)</span>
                  </label>
                  <input
                    type="text"
                    value={techInput}
                    onChange={(e) => setTechInput(e.target.value)}
                    onKeyDown={handleTechInputKeyDown}
                    placeholder="e.g. React"
                    className="w-full mt-1 border border-gray-800 bg-black rounded-lg px-3 py-2 text-sm text-white placeholder-gray-700 outline-none focus:border-emerald-600 transition-colors"
                  />
                  {readmeTechStack.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {readmeTechStack.map((tech) => (
                        <span
                          key={tech}
                          className="inline-flex items-center gap-1 text-xs text-gray-300 border border-gray-700 rounded-full pl-2.5 pr-1.5 py-0.5"
                        >
                          {tech}
                          <button
                            onClick={() => removeTechTag(tech)}
                            aria-label={`Remove ${tech}`}
                            className="text-gray-600 hover:text-white transition-colors"
                          >
                            <XIcon className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={continueAfterReadme}
                  className="self-start h-9 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-semibold transition-colors"
                >
                  Continue
                </button>
              </Card>
            )}

            {/* deployable? prompt */}
            {step === "ask_continue" && (
              <Card className="flex flex-col gap-3">
                <p className="text-sm text-gray-300">
                  {detectedTarget === "both" ? (
                    <>
                      This project has both a <b className="text-white">frontend</b> and a{" "}
                      <b className="text-white">backend</b>. The frontend will deploy automatically to your
                      Vercel account; you'll get one-click hosting links for the backend on Render or Railway
                      right after.
                    </>
                  ) : (
                    <>
                      This project can be deployed as a{" "}
                      <b className="text-white">
                        {detectedTarget === "static" ? "static site (frontend)" : "web service (backend)"}
                      </b>
                      . Deploy it now?
                    </>
                  )}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleContinueChoice(true)}
                    className="h-9 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-semibold transition-colors"
                  >
                    Yes, deploy
                  </button>
                  <button
                    onClick={() => handleContinueChoice(false)}
                    className="h-9 px-4 rounded-lg border border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700 text-sm transition-colors"
                  >
                    No, just keep repository
                  </button>
                </div>
              </Card>
            )}

            {/* connect Vercel — only reached for frontend deploys (static or both) with no Vercel account linked yet */}
            {step === "connect_vercel" && (
              <Card className="flex flex-col gap-3">
                <p className="text-sm text-gray-300">
                  Connect your Vercel account to deploy the frontend — it will go to{" "}
                  <b className="text-white">your own</b> Vercel account, not ours.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={connectVercel}
                    className="h-9 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-semibold transition-colors"
                  >
                    Connect Vercel
                  </button>
                  <button
                    onClick={recheckVercelConnection}
                    disabled={checkingConnection}
                    className="h-9 px-4 rounded-lg border border-gray-800 text-gray-300 hover:border-gray-700 text-sm transition-colors disabled:opacity-40 flex items-center gap-1.5"
                  >
                    {checkingConnection && <Spinner />}
                    I've connected — continue
                  </button>
                </div>
                <p className="text-gray-600 text-xs">Opens in a new tab. Come back and click continue once approved.</p>
              </Card>
            )}

            {/* tier prompt */}
            {step === "await_tier" && (
              <Card className="flex flex-col gap-3">
                <p className="text-sm text-gray-300">
                  Frontend target: <b className="text-white">Vercel</b>. Choose a tier:
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleDeploy("free")}
                    className="h-9 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-semibold transition-colors"
                  >
                    Free
                  </button>
                  <button
                    disabled
                    title="Coming soon"
                    className="h-9 px-4 rounded-lg border border-gray-800 text-gray-600 text-sm cursor-not-allowed"
                  >
                    Paid (coming soon)
                  </button>
                </div>
              </Card>
            )}

            {/* success banner */}
            {step === "done" && (
              <Card className="flex flex-col gap-3">
                {repoDone && (
                  <div className="flex items-center gap-2 text-sm text-white font-medium">
                    <CheckIcon className="text-emerald-400" /> Repository pushed successfully
                  </div>
                )}
                {deployedUrl && (
                  <div className="flex items-center gap-2 text-sm text-white font-medium">
                    <CheckIcon className="text-emerald-400" /> Frontend deployed to Vercel —{" "}
                    <a href={deployedUrl} target="_blank" rel="noreferrer" className="underline text-emerald-400">
                      {deployedUrl}
                    </a>
                  </div>
                )}
                {isBackendHandoff && deployInfo && (
                  <div className="border border-gray-800 bg-black rounded-lg p-3 flex flex-col gap-3">
                    <p className="text-gray-400 text-xs">
                      {detectedTarget === "both"
                        ? "Now pick a host for the backend — both are free."
                        : "This looks like a backend project — pick a host to deploy it on. Both are free."}
                    </p>

                    {renderBlueprintAvailable ? (
                      <div className="flex flex-col gap-1.5">
                        <p className="text-gray-500 text-xs">
                          <span className="text-white font-semibold">Render</span> — build and start commands
                          are pre-filled from <span className="font-mono text-gray-400">render.yaml</span>,
                          just click through.
                        </p>
                        <a
                          href={`https://render.com/deploy?repo=${encodeURIComponent(deployInfo.htmlUrl)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="self-start text-xs text-black bg-emerald-500 hover:bg-emerald-400 rounded-lg px-3 py-1.5 transition-colors font-semibold"
                        >
                          Deploy to Render
                        </a>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <p className="text-gray-500 text-xs">
                          <span className="text-white font-semibold">Render</span> — couldn't confirm a start
                          command automatically, so this needs a few fields filled in manually on Render's
                          "New Web Service" screen.
                        </p>
                        <a
                          href="https://dashboard.render.com/select-repo?type=web"
                          target="_blank"
                          rel="noreferrer"
                          className="self-start text-xs text-gray-200 border border-gray-700 rounded-lg px-3 py-1.5 hover:border-gray-500 transition-colors"
                        >
                          Open Render
                        </a>
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5 pt-2 border-t border-gray-900">
                      <p className="text-gray-500 text-xs">
                        <span className="text-white font-semibold">Railway</span> — search for{" "}
                        <span className="text-white font-mono">
                          {deployInfo.owner}/{deployInfo.repo}
                        </span>{" "}
                        once there. Every future push auto-redeploys after this one-time setup.
                      </p>
                      <a
                        href="https://railway.com/new/github"
                        target="_blank"
                        rel="noreferrer"
                        className="self-start text-xs text-gray-200 border border-gray-700 rounded-lg px-3 py-1.5 hover:border-gray-500 transition-colors"
                      >
                        Open Railway
                      </a>
                    </div>
                  </div>
                )}
                {!deployedUrl && !isBackendHandoff && notDeployableReason && (
                  <p className="text-gray-500 text-xs">Not deployable: {notDeployableReason}</p>
                )}
                {!deployedUrl && !isBackendHandoff && !notDeployableReason && (
                  <p className="text-gray-500 text-xs">Deployment skipped — repository only.</p>
                )}
                <button
                  onClick={resetAll}
                  className="self-start h-9 px-4 rounded-lg border border-emerald-600 text-emerald-400 hover:bg-emerald-400 hover:text-black text-sm font-semibold transition-colors"
                >
                  Start another deployment
                </button>
              </Card>
            )}

            {/* error banner */}
            {step === "error" && (
              <Card className="flex flex-col gap-3">
                <p className="text-sm text-red-400 font-medium">Something went wrong — see the log on the right.</p>
                <button
                  onClick={resetAll}
                  className="self-start h-9 px-4 rounded-lg border border-gray-800 text-gray-300 hover:border-gray-600 text-sm transition-colors"
                >
                  Try again
                </button>
              </Card>
            )}
          </div>

          {/* ---------------- RIGHT: terminal ---------------- */}
          <div ref={terminalWrapRef} className="w-full lg:max-w-xl lg:sticky lg:top-10">
            <div
              className={`border rounded-xl overflow-hidden bg-[#0d1117] transition-colors ${
                isBusy ? "border-emerald-600 ring-1 ring-emerald-600/40" : "border-gray-800"
              }`}
            >
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-900">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
                <span className="ml-2 text-[10px] tracking-widest uppercase text-gray-500">repo-pipeline</span>
                {isBusy && <span className="ml-auto"><Pill tone="warn">Live</Pill></span>}
              </div>
              <div ref={terminalRef} className="h-[28rem] overflow-y-auto px-4 py-3 font-mono text-xs leading-6">
                {log.length === 0 ? (
                  <p className="text-gray-700">Logs will appear here once you start the pipeline.</p>
                ) : (
                  log.map((line, i) => (
                    <div key={i} className={`${logTone(line)} whitespace-pre-wrap break-words`}>
                      <span className="text-gray-700 mr-2">$</span>
                      {line}
                    </div>
                  ))
                )}
                {isBusy && (
                  <div className="text-emerald-400">
                    <span className="text-gray-700 mr-2">$</span>
                    <span className="inline-block w-2 h-3.5 -mb-0.5 bg-emerald-400 animate-pulse" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Newrepositories;