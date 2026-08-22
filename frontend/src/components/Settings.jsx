import { useState, useEffect, useCallback } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5002";

function formatRelativeTime(input) {
  if (!input) return "—";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "—";
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

/* ---------- icons ---------- */

function GithubIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={`w-5 h-5 shrink-0 ${className}`}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function CheckIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={`w-4 h-4 shrink-0 ${className}`}>
      <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
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

function TriangleIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 76 65" fill="currentColor" className={`w-5 h-5 shrink-0 ${className}`}>
      <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
    </svg>
  );
}

/* ---------- shared primitives — same design system used across the app ---------- */

function Card({ children, className = "" }) {
  return <div className={`border border-gray-800 bg-[#0d1117] rounded-lg p-5 ${className}`}>{children}</div>;
}

function Pill({ tone = "neutral", children }) {
  const styles = {
    ok: "text-emerald-400 bg-emerald-500/10",
    warn: "text-amber-400 bg-amber-500/10",
    danger: "text-red-400 bg-red-500/10",
    neutral: "text-gray-400 bg-gray-500/10",
  }[tone];
  return <span className={`text-xs font-medium rounded-md px-2 py-0.5 ${styles}`}>{children}</span>;
}

/* ---------- disconnect confirmation modal ---------- */

function DisconnectModal({ provider, onCancel, onConfirm, disconnecting }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-sm border border-gray-800 bg-[#0d1117] rounded-2xl p-6 flex flex-col gap-4">
        <div>
          <h2 className="text-white font-semibold text-base">Disconnect {provider}?</h2>
          <p className="text-gray-500 text-sm mt-1.5 leading-relaxed">
            You won't be able to deploy through {provider} until you reconnect it. Existing deployments won't be
            affected.
          </p>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={disconnecting}
            className="h-10 px-4 rounded-lg border border-gray-800 text-sm text-gray-400 hover:text-gray-200 hover:border-gray-700 transition disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={disconnecting}
            className="h-10 px-4 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-sm font-semibold text-white transition flex items-center gap-2"
          >
            {disconnecting && <Spinner />}
            {disconnecting ? "Disconnecting..." : "Disconnect"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- main page ---------- */

function Settings() {
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);

  const [connections, setConnections] = useState([]);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [connectionsError, setConnectionsError] = useState(null);

  const [connectingVercel, setConnectingVercel] = useState(false);
  const [disconnectTarget, setDisconnectTarget] = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const loadUser = useCallback(async () => {
    setUserLoading(true);
    try {
      const res = await fetch(`${API_URL}/user`, { credentials: "include" });
      const data = await res.json();
      if (data.success) setUser(data.user);
    } catch {
      // if this fails the page still works — GitHub info just won't render
    } finally {
      setUserLoading(false);
    }
  }, []);

  const loadConnections = useCallback(async () => {
    setConnectionsLoading(true);
    setConnectionsError(null);
    try {
      const res = await fetch(`${API_URL}/api/connections`, { credentials: "include" });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to load connections.");
      setConnections(data.connections);
    } catch (err) {
      setConnectionsError(err.message || "Couldn't load your connected accounts.");
    } finally {
      setConnectionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
    loadConnections();
  }, [loadUser, loadConnections]);

  // if we just came back from the Vercel OAuth redirect (?connected=vercel),
  // refresh the connection list once so the new connection shows up without
  // requiring a manual refresh click
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "vercel") {
      loadConnections();
      params.delete("connected");
      const newUrl = window.location.pathname + (params.toString() ? `?${params}` : "");
      window.history.replaceState({}, "", newUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vercelConnection = connections.find((c) => c.provider === "vercel");

  const connectVercel = async () => {
    setConnectingVercel(true);
    try {
      const res = await fetch(`${API_URL}/api/connections/vercel/install-url`, { credentials: "include" });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setConnectionsError(`Couldn't start the Vercel connection: ${err.message}`);
    } finally {
      setConnectingVercel(false);
    }
  };

  const confirmDisconnect = async () => {
    if (!disconnectTarget) return;
    setDisconnecting(true);
    try {
      const res = await fetch(`${API_URL}/api/connections/${disconnectTarget}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to disconnect.");
      setConnections((prev) => prev.filter((c) => c.provider !== disconnectTarget));
      setDisconnectTarget(null);
    } catch (err) {
      setConnectionsError(err.message || "Couldn't disconnect that account.");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleLogout = () => {
    window.location.assign(`${API_URL}/logout`);
  };

  return (
    <div className="min-h-full bg-black">
      <div className="max-w-screen mx-auto px-10 py-10 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl uppercase font-semibold text-white">Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage the accounts DeployX uses to push and deploy your projects.</p>
        </div>

        {connectionsError && (
          <div className="border border-red-900 bg-red-500/10 rounded-lg p-4 flex items-center justify-between">
            <p className="text-red-400 text-sm">{connectionsError}</p>
            <button
              onClick={() => {
                setConnectionsError(null);
                loadConnections();
              }}
              className="h-9 px-3 rounded-lg border border-gray-800 text-xs text-gray-400 hover:text-gray-200 hover:border-gray-700 transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* ---------------- Connected accounts ---------------- */}
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Connected accounts</p>

          {/* GitHub — required, this is the login identity itself */}
          <Card className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center shrink-0 overflow-hidden">
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
                ) : (
                  <GithubIcon className="text-gray-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">GitHub</p>
                <p className="text-xs text-gray-500 truncate">
                  {userLoading ? "Loading..." : user ? `@${user.username}` : "Not signed in"}
                </p>
              </div>
            </div>
            <Pill tone="ok">Connected</Pill>
          </Card>
          <p className="text-xs text-gray-600 px-1 -mt-1">
            GitHub is how you sign in to DeployX, so it can't be disconnected here — sign out instead if you need
            to switch accounts.
          </p>

          {/* Vercel — optional, connect/disconnect */}
          <Card className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center shrink-0">
                <TriangleIcon className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">Vercel</p>
                <p className="text-xs text-gray-500 truncate">
                  {connectionsLoading
                    ? "Checking connection..."
                    : vercelConnection
                    ? `${vercelConnection.accountLabel?.startsWith("team:") ? "Team account" : "Personal account"} · connected ${formatRelativeTime(vercelConnection.updatedAt)}`
                    : "Used to deploy your frontend projects"}
                </p>
              </div>
            </div>

            {connectionsLoading ? (
              <Spinner className="text-gray-500" />
            ) : vercelConnection ? (
              <div className="flex items-center gap-2 shrink-0">
                <Pill tone="ok">Connected</Pill>
                <button
                  onClick={() => setDisconnectTarget("vercel")}
                  className="h-8 px-3 rounded-lg border border-gray-800 text-xs text-gray-400 hover:text-red-400 hover:border-red-900 transition"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={connectVercel}
                disabled={connectingVercel}
                className="h-9 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-sm font-semibold transition shrink-0 flex items-center gap-2"
              >
                {connectingVercel && <Spinner />}
                Connect
              </button>
            )}
          </Card>
        </div>

        {/* ---------------- Account ---------------- */}
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Account</p>
          <Card className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Sign out</p>
              <p className="text-xs text-gray-500 mt-0.5">You'll need to sign back in with GitHub to use DeployX again.</p>
            </div>
            <button
              onClick={handleLogout}
              className="h-9 px-4 rounded-lg border border-red-900 text-red-400 hover:bg-red-500/10 hover:border-red-700 text-sm font-medium transition shrink-0"
            >
              Sign out
            </button>
          </Card>
        </div>
      </div>

      {disconnectTarget && (
        <DisconnectModal
          provider={disconnectTarget === "vercel" ? "Vercel" : disconnectTarget}
          onCancel={() => setDisconnectTarget(null)}
          onConfirm={confirmDisconnect}
          disconnecting={disconnecting}
        />
      )}
    </div>
  );
}

export default Settings;