import { useState, useEffect, useCallback, useMemo } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5002";

const STATUS_STYLES = {
  live: "text-emerald-400 border-emerald-800 bg-emerald-950/30",
  deploying: "text-yellow-400 border-yellow-800 bg-yellow-950/30",
  failed: "text-red-400 border-red-800 bg-red-950/30",
  pushed: "text-gray-400 border-gray-700 bg-gray-900",
};

const STATUS_LABELS = {
  live: "Live",
  deploying: "Deploying",
  failed: "Failed",
  pushed: "Pushed",
};

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

/* ---------- inline icons ---------- */

function XIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={`w-4 h-4 shrink-0 ${className}`}>
      <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
    </svg>
  );
}

function TrashIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={`w-4 h-4 shrink-0 ${className}`}>
      <path d="M6.5 1.75A.75.75 0 017.25 1h1.5a.75.75 0 01.75.75V3h3.25a.75.75 0 010 1.5H12.9l-.68 8.16A1.75 1.75 0 0110.48 14H5.52a1.75 1.75 0 01-1.74-1.34L3.1 4.5H2.75a.75.75 0 010-1.5H6V1.75zM4.61 4.5l.66 7.9a.25.25 0 00.25.23h4.96a.25.25 0 00.25-.23l.66-7.9H4.61zM7.5 3h1V2.5h-1V3z" />
    </svg>
  );
}

function ExternalLinkIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={`w-3.5 h-3.5 shrink-0 ${className}`}>
      <path d="M3.75 2A1.75 1.75 0 002 3.75v8.5C2 13.216 2.784 14 3.75 14h8.5A1.75 1.75 0 0014 12.25v-3.5a.75.75 0 00-1.5 0v3.5a.25.25 0 01-.25.25h-8.5a.25.25 0 01-.25-.25v-8.5a.25.25 0 01.25-.25h3.5a.75.75 0 000-1.5h-3.5zM9 1.75A.75.75 0 019.75 1h4.5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0V3.56L8.03 9.03a.75.75 0 01-1.06-1.06L12.44 2.5H9.75A.75.75 0 019 1.75z" />
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

/* ---------- remove-from-dashboard modal ---------- */

function RemoveModal({ deployment, onCancel, onConfirmed }) {
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState(null);

  const handleRemove = async () => {
    setRemoving(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/dashboard/${deployment.project}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      onConfirmed(deployment);
    } catch (err) {
      setError(err.message || "Failed to remove deployment record.");
      setRemoving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-md border border-red-800 bg-gray-950 rounded-xl p-6 flex flex-col gap-4">
        <div>
          <h2 className="text-white font-bold text-lg">Remove from dashboard</h2>
          <p className="text-gray-400 text-sm mt-1">
            This removes <span className="text-white font-semibold">{deployment.project}</span> from
            your dashboard. It does <span className="text-gray-300 font-semibold">not</span> delete the
            GitHub repository or the live deployment on {deployment.provider}.
          </p>
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={removing}
            className="text-sm text-gray-400 border border-gray-700 rounded-lg px-4 py-2 hover:border-gray-500 transition disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleRemove}
            disabled={removing}
            className="text-sm text-white bg-red-700 rounded-lg px-4 py-2 hover:bg-red-600 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {removing && <Spinner />}
            {removing ? "Removing..." : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- table header ---------- */

function TableHeader() {
  return (
    <div className="flex items-center gap-4 px-4 py-2.5 border-b-[2px] border-gray-700 text-[11px] uppercase tracking-widest text-gray-500">
      <div className="flex-1 min-w-0">Project</div>
      <div className="w-28 shrink-0 hidden sm:block">Provider</div>
      <div className="w-28 shrink-0">Status</div>
      <div className="w-28 shrink-0 hidden md:block text-right">Updated</div>
      <div className="w-28 shrink-0 text-right">Actions</div>
    </div>
  );
}

/* ---------- table row ---------- */

function DeploymentRow({ deployment, onRemoveRequest }) {
  const statusStyle = STATUS_STYLES[deployment.status] || STATUS_STYLES.pushed;
  const statusLabel = STATUS_LABELS[deployment.status] || deployment.status;

  return (
    <div className="border-b border-gray-800">
      <div className="flex items-center gap-4 px-4 py-3 hover:bg-gray-900/40 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-gray-200 text-sm font-semibold truncate" title={deployment.project}>
              {deployment.project}
            </span>
            {deployment.url && (
              <a
                href={deployment.url}
                target="_blank"
                rel="noreferrer"
                className="text-gray-600 hover:text-white shrink-0"
                title="Open live URL"
              >
                <ExternalLinkIcon />
              </a>
            )}
          </div>
          <p className="text-gray-600 text-xs truncate mt-0.5">{deployment.url || "No URL yet"}</p>
        </div>

        <div className="w-28 shrink-0 hidden sm:block text-xs text-gray-400 truncate">
          {deployment.provider}
        </div>

        <div className="w-28 shrink-0">
          <span
            className={`inline-block text-[11px] font-semibold uppercase tracking-wide border rounded-full px-2.5 py-1 ${statusStyle}`}
          >
            {statusLabel}
          </span>
        </div>

        <div className="w-28 shrink-0 hidden md:block text-right text-xs text-gray-500">
          {formatRelativeTime(deployment.time)}
        </div>

        <div className="w-28 shrink-0 flex items-center justify-end">
          <button
            onClick={() => onRemoveRequest(deployment)}
            className="flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 border border-red-800 bg-red-950/40 text-red-400 hover:bg-red-700 hover:text-white hover:border-red-600 transition"
          >
            <TrashIcon /> Remove
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- main page ---------- */

function My_deployments() {
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updated");
  const [removeTarget, setRemoveTarget] = useState(null);

  const loadDeployments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/dashboard`, { credentials: "include" });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to load deployments.");
      setDeployments(data.deployments);
    } catch (err) {
      setError(err.message || "Couldn't load your deployments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDeployments();
  }, [loadDeployments]);

  const visibleDeployments = useMemo(() => {
    // exclude records that were only pushed to GitHub and never actually deployed
    let list = deployments.filter((d) => d.status !== "pushed");

    if (statusFilter !== "all") {
      list = list.filter((d) => d.status === statusFilter);
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((d) => d.project.toLowerCase().includes(q));
    }

    list = [...list].sort((a, b) => {
      if (sortBy === "name") return a.project.localeCompare(b.project);
      return new Date(b.time) - new Date(a.time);
    });

    return list;
  }, [deployments, query, statusFilter, sortBy]);

  const handleRemoved = (deployment) => {
    setDeployments((prev) => prev.filter((d) => d.id !== deployment.id));
    setRemoveTarget(null);
  };

  return (
    <div className="min-h-full bg-black p-10">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <h1 className="text-2xl uppercase  font-extrabold ">My Deployments</h1>
        <button
          onClick={loadDeployments}
          disabled={loading}
          className="text-xs text-gray-400 border border-gray-700 rounded-lg px-3 py-1.5 hover:border-gray-400 disabled:opacity-40 transition"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap mb-4">
        <input
          type="text"
          placeholder="Search deployments..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-[200px] border border-gray-700 bg-gray-950 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-0 focus:border-gray-400"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-700 bg-gray-950 rounded-lg px-3 py-2 text-sm text-gray-300 outline-0 focus:border-gray-400"
        >
          <option value="all">All statuses</option>
          <option value="live">Live</option>
          <option value="deploying">Deploying</option>
          <option value="failed">Failed</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="border border-gray-700 bg-gray-950 rounded-lg px-3 py-2 text-sm text-gray-300 outline-0 focus:border-gray-400"
        >
          <option value="updated">Recently updated</option>
          <option value="name">Name (A–Z)</option>
        </select>
      </div>

      {error && (
        <div className="border border-red-800 bg-red-950/20 rounded-lg p-4 flex items-center justify-between mb-6">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={loadDeployments}
            className="text-xs text-gray-400 border border-gray-700 rounded-lg px-3 py-1.5 hover:border-gray-500 transition"
          >
            Retry
          </button>
        </div>
      )}

      <div className="border border-gray-800 rounded-xl overflow-hidden">
        <TableHeader />

        {!error && loading && (
          <div>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="border-b border-gray-800 px-4 py-3">
                <div className="h-4 w-1/3 bg-gray-800 rounded animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {!error && !loading && visibleDeployments.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-16">
            {deployments.filter((d) => d.status !== "pushed").length === 0
              ? "No deployments yet — deploy a project from New Deployment."
              : "No deployments match your filters."}
          </div>
        )}

        {!error &&
          !loading &&
          visibleDeployments.map((deployment) => (
            <DeploymentRow
              key={deployment.id}
              deployment={deployment}
              onRemoveRequest={setRemoveTarget}
            />
          ))}
      </div>

      {removeTarget && (
        <RemoveModal
          deployment={removeTarget}
          onCancel={() => setRemoveTarget(null)}
          onConfirmed={handleRemoved}
        />
      )}
    </div>
  );
}

export default My_deployments;
