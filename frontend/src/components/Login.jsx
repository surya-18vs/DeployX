import { useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";

const DEMO_LOG_LINES = [
  { text: "$ deployx push ./storefront", tone: "text-gray-500" },
  { text: "[ok] Repository created: github.com/you/storefront", tone: "text-gray-400" },
  { text: "[ok] Pushed 214 files — commit 9f3a1c2", tone: "text-gray-400" },
  { text: "Running deployment intelligence engine...", tone: "text-gray-500" },
  { text: "[ok] Detected: vite / react — no backend", tone: "text-gray-400" },
  { text: "[ok] Security scan clean — 0 findings", tone: "text-amber-300" },
  { text: "Deploying to Vercel...", tone: "text-gray-500" },
  { text: "[ok] Live at storefront-you.vercel.app", tone: "text-emerald-400" },
];

function Login() {
  const [searchParams] = useSearchParams();
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5002";
  const [visibleLines, setVisibleLines] = useState(0);

  const handleGithubLogin = () => {
    window.location.assign(`${apiUrl}/auth/github`);
  };

  const handleCreateAccount = () => {
    const returnTo = `${apiUrl}/auth/github`;
    window.location.assign(
      `https://github.com/signup?return_to=${encodeURIComponent(returnTo)}`
    );
  };

  // purely decorative — types out the demo log on a loop, resets when it finishes
  useEffect(() => {
    let cancelled = false;
    let timeoutId;

    const runCycle = (line) => {
      if (cancelled) return;
      if (line <= DEMO_LOG_LINES.length) {
        setVisibleLines(line);
        timeoutId = setTimeout(() => runCycle(line + 1), 550);
      } else {
        timeoutId = setTimeout(() => {
          setVisibleLines(0);
          runCycle(1);
        }, 1800);
      }
    };

    runCycle(1);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  // purely presentational — derives pipeline stage state from the same visibleLines value
  const pushActive = visibleLines >= 1;
  const pushDone = visibleLines >= 3;
  const scanActive = visibleLines >= 4;
  const scanDone = visibleLines >= 6;
  const deployActive = visibleLines >= 7;
  const deployDone = visibleLines >= 8;

  const stages = [
    { key: "push", label: "Push", active: pushActive, done: pushDone, color: "#9CA3AF" },
    { key: "scan", label: "Scan", active: scanActive, done: scanDone, color: "#F5B759" },
    { key: "deploy", label: "Deploy", active: deployActive, done: deployDone, color: "#34D399" },
  ];

  return (
    <div className="w-screen h-screen bg-[#050609] overflow-hidden relative">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

        .dx-display { font-family: 'Space Grotesk', system-ui, sans-serif; }
        .dx-mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }

        @keyframes term-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
        .term-cursor { animation: term-blink 1s step-end infinite; }

        @keyframes spin-slow { to { transform: rotate(360deg); } }
        .spin-slow { animation: spin-slow 7s linear infinite; }

        @keyframes float-orb { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(24px, -34px); } }
        .float-orb { animation: float-orb 11s ease-in-out infinite; }

        @keyframes fade-up { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fade-up 0.35s ease-out both; }

        @keyframes scan-sweep { 0% { transform: translateY(-100%); } 100% { transform: translateY(600%); } }
        .scan-sweep { animation: scan-sweep 3.2s ease-in-out infinite; }

        @keyframes pulse-dot { 0%, 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0.55); } 50% { box-shadow: 0 0 0 6px rgba(52,211,153,0); } }
        .pulse-dot { animation: pulse-dot 1.8s ease-out infinite; }

        @keyframes grain-shift { 0%, 100% { transform: translate(0,0); } 50% { transform: translate(-1.5%, -1%); } }
        .grain-layer { animation: grain-shift 8s steps(2) infinite; }

        @media (prefers-reduced-motion: reduce) {
          .float-orb, .spin-slow, .scan-sweep, .pulse-dot, .grain-layer, .fade-up { animation: none !important; }
        }

        .dx-focus:focus-visible {
          outline: 2px solid #34D399;
          outline-offset: 3px;
        }
      `}</style>

      {/* film grain texture, subtle */}
      <div
        className="grain-layer pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-screen"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="w-full h-full grid grid-cols-1 lg:grid-cols-2 relative">
        {/* ---------------- LEFT: hero / brand ---------------- */}
        <div className="relative hidden lg:flex flex-col justify-center px-16 overflow-hidden border-r border-white/[0.06]">
          {/* dot grid texture */}
          <div
            className="absolute inset-0 opacity-[0.15]"
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1.4px)",
              backgroundSize: "26px 26px",
            }}
          />
          {/* vignette */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_left,transparent_0%,#050609_85%)]" />

          {/* floating glow orbs — multi-accent, not a single mono-glow */}
          <div className="float-orb absolute -top-24 left-1/3 w-[440px] h-[440px] rounded-full bg-emerald-500/[0.09] blur-[120px]" />
          <div
            className="float-orb absolute bottom-0 right-0 w-[380px] h-[380px] rounded-full bg-violet-500/[0.07] blur-[120px]"
            style={{ animationDelay: "-4s" }}
          />
          <div
            className="float-orb absolute top-1/2 -left-10 w-[260px] h-[260px] rounded-full bg-amber-400/[0.05] blur-[100px]"
            style={{ animationDelay: "-7s" }}
          />

          <div className="relative flex items-center gap-2.5 mb-12">
            {/* <div className="w-9 h-9 rounded-lg bg-gray-950 border border-white/10 flex items-center justify-center shadow-[0_0_24px_-6px_rgba(52,211,153,0.4)]">
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <path d="M8 4H5.5A1.5 1.5 0 004 5.5v13A1.5 1.5 0 005.5 20H8" stroke="rgb(156,163,175)" strokeWidth="2" strokeLinecap="round" />
                <path d="M12 17V7M12 7l-3.5 3.5M12 7l3.5 3.5" stroke="#34d399" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div> */}
            <span className="dx-display  text-gray-200 font-bold  tracking-tight text-5xl">
              Deploy<span className="text-emerald-400">X</span>
            </span>
          </div>

          <span className="dx-mono relative text-[9px] tracking-[0.25em] uppercase text-emerald-400/70 mb-5">
            Push-to-production
          </span>

          <h1 className="dx-display relative text-white text-[3rem] font-semibold tracking-tight leading-[1.05] max-w-lg">
            Ship code without
            <br />
            touching a <span className="text-emerald-400">console.</span>
          </h1>
          {/* <p className="relative text-sm tracking-tighter font-mono text-gray-500 font-lighter  mt-5 max-w-md leading-relaxed">
            Push straight from your files to a live GitHub repository and a production deployment — no git commands, no dashboards to configure, no credentials to hand over.
          </p> */}

          {/* pipeline stage rail, derived from the same demo state as the console below */}
          <div className="relative mt-10 flex items-center gap-3 max-w-md">
            {stages.map((s, i) => (
              <div key={s.key} className="flex items-center gap-3 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`relative w-2 h-2 rounded-full transition-all duration-300 ${s.active ? "pulse-dot" : ""}`}
                    style={{ backgroundColor: s.active ? s.color : "#374151" }}
                  />
                  <span
                    className={`dx-mono text-[11px] tracking-wide transition-colors duration-300 ${s.active ? "text-gray-300" : "text-gray-600"}`}
                  >
                    {s.label}
                  </span>
                </div>
                {i < stages.length - 1 && (
                  <div className="flex-1 h-px bg-gray-800 relative overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-gray-500 transition-all duration-500"
                      style={{ width: s.done ? "100%" : "0%" }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* console */}
          <div className="relative mt-6 w-full max-w-md border border-white/10 rounded-xl overflow-hidden bg-[#080a0d]/90 backdrop-blur shadow-[0_0_70px_-24px_rgba(52,211,153,0.3)]">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.08] bg-white/[0.02]">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
              <span className="dx-mono ml-2 text-[10px] tracking-widest uppercase text-gray-600">logs....</span>
              <span className="dx-mono ml-auto text-[10px] text-gray-700">live</span>
            </div>
            <div className="relative px-4 py-4 font-mono text-[12px] leading-6 h-52 overflow-hidden">
              <div className="scan-sweep pointer-events-none absolute inset-x-0 h-16 bg-gradient-to-b from-emerald-400/[0.05] via-emerald-400/[0.02] to-transparent" />
              {DEMO_LOG_LINES.slice(0, visibleLines).map((line, i) => (
                <div key={i} className={`fade-up dx-mono whitespace-pre-wrap ${line.tone}`}>
                  {line.text}
                </div>
              ))}
              <span className="term-cursor text-emerald-400 dx-mono">_</span>
            </div>
          </div>
        </div>

        {/* ---------------- RIGHT: auth ---------------- */}
        <div className="relative flex flex-col justify-center items-center px-6">
          <div
            className="absolute w-[560px] h-[560px] rounded-full bg-emerald-500/[0.08] blur-[140px]"
            style={{ transform: "translateY(-8%)" }}
          />
          <div
            className="absolute w-[320px] h-[320px] rounded-full bg-violet-500/[0.06] blur-[120px]"
            style={{ transform: "translate(30%, 20%)" }}
          />

          <div className="relative max-w-lg ">
            {/* mobile-only brand mark */}
            <div className="flex lg:hidden items-center justify-center gap-2.5 mb-8">
              <div className="w-9 h-9 rounded-lg bg-gray-950 border border-white/10 flex items-center justify-center">
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <path d="M8 4H5.5A1.5 1.5 0 004 5.5v13A1.5 1.5 0 005.5 20H8" stroke="rgb(156,163,175)" strokeWidth="2" strokeLinecap="round" />
                  <path d="M12 17V7M12 7l-3.5 3.5M12 7l3.5 3.5" stroke="#34d399" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="dx-display text-gray-200 font-bold tracking-tight text-lg">
                Deploy<span className="text-emerald-400">X</span>
              </span>
            </div>

            <span className="dx-mono hidden lg:block text-[11px] tracking-[0.25em] uppercase text-purple-400 text-left mb-3">
              Authenticate
            </span>
            <h2 className="dx-display text-white text-3xl font-semibold tracking-tight text-center lg:text-left">
              Welcome back
            </h2>
            <p className="text-gray-500 text-sm mt-2 text-center lg:text-left">
              Sign in with GitHub to continue to your dashboard.
            </p>

            {/* card with animated gradient ring */}
            <div className="relative mt-8 rounded-2xl p-1 w-130  overflow-hidden">
              <div
                className="spin-slow absolute -inset-10"
                style={{
                  background:
                    "conic-gradient(from 0deg, transparent 0%, rgba(52,211,153,0.6) 8%, transparent 18%, rgba(139,124,246,0.45) 26%, transparent 36%)",
                }}
              />
              <div className="relative rounded-2xl border border-white/10 bg-gradient-to-b from-[#0b0e14] to-[#050609] p-6">
                {searchParams.get("error") === "github_oauth_failed" && (
                  <div className="w-full mb-5 border border-red-800/60 bg-red-500/10 rounded-lg px-3 py-2.5">
                    <p className="text-center text-sm text-red-400">
                      GitHub sign-in was cancelled or failed. Please try again.
                    </p>
                  </div>
                )}

                <div className="w-full flex flex-col gap-3">
                  <button
                    onClick={handleGithubLogin}
                    className="dx-focus group relative h-12 w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-semibold transition-all duration-200 shadow-[0_0_30px_-8px_rgba(52,211,153,0.5)] hover:shadow-[0_0_38px_-6px_rgba(52,211,153,0.7)] flex items-center justify-center gap-2"
                  >
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" className="opacity-90">
                      <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.5 0-.24-.01-1.04-.01-1.88-2.78.62-3.37-1.21-3.37-1.21-.46-1.2-1.11-1.52-1.11-1.52-.91-.64.07-.63.07-.63 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.72 0 0 .84-.27 2.75 1.05a9.3 9.3 0 015 0c1.91-1.32 2.75-1.05 2.75-1.05.55 1.41.2 2.46.1 2.72.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.57 5.05.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .28.18.61.69.5A10.26 10.26 0 0022 12.25C22 6.58 17.52 2 12 2z" />
                    </svg>
                    Log in with GitHub
                  </button>

                  <button
                    onClick={handleCreateAccount}
                    className="dx-focus h-12 w-full rounded-xl border border-white/10 text-gray-400 hover:text-gray-200 hover:border-white/20 hover:bg-white/[0.02] text-sm font-medium transition-all duration-200"
                  >
                    Create a new GitHub account
                  </button>
                </div>

                {/* <div className="mt-6 pt-5 border-t border-white/[0.06] grid grid-cols-3 gap-2">
                  {[
                    { label: "OAuth only", sub: "no passwords" },
                    { label: "Private repos", sub: "read/write scoped" },
                    { label: "Revocable", sub: "anytime, on GitHub" },
                  ].map((f) => (
                    <div key={f.label} className="text-center">
                      <p className="dx-mono text-[10px] text-gray-400 leading-tight">{f.label}</p>
                      <p className="text-[10px] text-gray-700 leading-tight mt-0.5">{f.sub}</p>
                    </div>
                  ))}
                </div> */}
              </div>
            </div>

            <p className="text-center text-gray-700 text-xs mt-6">
              By continuing, you agree to authenticate via GitHub OAuth.
              <br />
              DeployX never stores your GitHub password.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;