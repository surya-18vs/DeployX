import { useState, useEffect, useCallback, useRef } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5002";

const REFRESH_INTERVAL_MS = 20000;

const STATUS_STYLES = {
  live: "text-emerald-400 bg-emerald-950/40 border-emerald-700",
  active: "text-emerald-400 bg-emerald-950/40 border-emerald-700",
  deploying: "text-amber-300 bg-amber-950/40 border-amber-700",
  building: "text-amber-300 bg-amber-950/40 border-amber-700",
  pending: "text-gray-400 bg-gray-900 border-gray-700",
  failed: "text-red-400 bg-red-950/40 border-red-700",
};

function formatRelativeTime(input) {
  if (!input) return "—";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "—";

  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function StatusBadge({ status }) {
  const key = (status || "pending").toLowerCase();
  const style = STATUS_STYLES[key] || STATUS_STYLES.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 border rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${style}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {status || "pending"}
    </span>
  );
}

/* ---------- shared panel-style building blocks (matches Activity.jsx) ---------- */

function StatCard({ label, value, colorClass, loading }) {
  return (
    <div className="border border-gray-800 bg-gray-950 rounded-xl px-5 py-4 flex-1 min-w-[150px]">
      <p className="text-xs text-gray-500 uppercase tracking-widest">{label}</p>
      {loading ? (
        <div className="w-16 h-8 bg-gray-800 rounded animate-pulse mt-2" />
      ) : (
        <p className={`text-2xl font-bold mt-1 ${colorClass}`}>{value}</p>
      )}
    </div>
  );
}

function Panel({ title, children, right }) {
  return (
    <div className="border border-gray-800 bg-gray-950 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">{title}</p>
        {right}
      </div>
      {children}
    </div>
  );
}

function TableSkeletonRow({ i }) {
  return (
    <div
      className="grid grid-cols-4 items-center py-3 border-b border-gray-900 last:border-0 animate-pulse"
      style={{ animationDelay: `${i * 80}ms` }}
    >
      <div className="h-4 w-32 bg-gray-800 rounded" />
      <div className="h-4 w-20 bg-gray-800 rounded" />
      <div className="h-5 w-16 bg-gray-800 rounded-full" />
      <div className="h-4 w-14 bg-gray-800 rounded" />
    </div>
  );
}

function Dashboard() {
  const [stats, setStats] = useState({ deployments: 0, active: 0, failed: 0 });
  const [repoCount, setRepoCount] = useState(0);
  const [repoCountLoading, setRepoCountLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const loadDashboard = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/dashboard`, { credentials: "include" });
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to load dashboard data.");

      setStats({
        deployments: data.stats?.deployments ?? 0,
        active: data.stats?.active ?? 0,
        failed: data.stats?.failed ?? 0,
      });
      setRows(Array.isArray(data.deployments) ? data.deployments : []);
    } catch (err) {
      setError(err.message || "Couldn't load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  // real repository count, straight from GitHub via /api/repo/list — not
  // the dashboard's own record count, which only tracks deployment activity
  const loadRepoCount = useCallback(async () => {
    setRepoCountLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/repo/list`, { credentials: "include" });
      const data = await res.json();
      if (data.success) setRepoCount(data.repos.length);
    } catch {
      // supplementary — the rest of the dashboard still renders without it
    } finally {
      setRepoCountLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    loadRepoCount();
    pollRef.current = setInterval(() => loadDashboard({ silent: true }), REFRESH_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [loadDashboard, loadRepoCount]);

  return (
    <div className="min-h-full bg-black p-10">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <h1 className="text-2xl uppercase tracking-wide font-extrabold ">Dashboard</h1>
        <button
          onClick={() => {
            loadDashboard();
            loadRepoCount();
          }}
          disabled={loading}
          className="text-xs text-gray-400 border border-gray-700 rounded-lg px-3 py-1.5 hover:border-gray-400 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="flex flex-col gap-5">
        {/* stats row */}
        <div id="overview" className="flex flex-wrap gap-4">
          <StatCard label="Repositories" value={repoCount} colorClass="text-purple-400" loading={repoCountLoading} />
          <StatCard label="Deployments" value={stats.deployments} colorClass="text-amber-300" loading={loading} />
          <StatCard label="Active" value={stats.active} colorClass="text-emerald-400" loading={loading} />
          <StatCard label="Failed" value={stats.failed} colorClass="text-red-400" loading={loading} />
        </div>

        {/* deployments table */}
        <Panel title="Recent deployments">
          <div className="grid grid-cols-4 border-b border-gray-800 pb-2 mb-1 text-gray-500 text-xs uppercase tracking-widest">
            <div>Project</div>
            <div>Provider</div>
            <div>Status</div>
            <div>Time</div>
          </div>

          {error && (
            <div className="flex items-center justify-between border border-red-800 bg-red-950/20 rounded-lg px-4 py-4 mt-3">
              <p className="text-red-400 text-sm">{error}</p>
              <button
                onClick={() => loadDashboard()}
                className="text-xs text-gray-400 border border-gray-700 rounded-lg px-3 py-1.5 hover:border-gray-500 transition"
              >
                Retry
              </button>
            </div>
          )}

          {!error && loading && (
            <>
              {[0, 1, 2, 3].map((i) => (
                <TableSkeletonRow key={i} i={i} />
              ))}
            </>
          )}

          {!error && !loading && rows.length === 0 && (
            <div className="py-10 text-center text-gray-500 text-sm">
              No deployments yet — create one to see it here.
            </div>
          )}

          {!error &&
            !loading &&
            rows.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-4 items-center py-3 border-b border-gray-900 last:border-0 hover:bg-gray-900/40 transition-colors rounded-md px-2 -mx-2"
              >
                <div className="text-white font-semibold truncate pr-4">
                  {row.url ? (
                    <a href={row.url} target="_blank" rel="noreferrer" className="hover:underline">
                      {row.project}
                    </a>
                  ) : (
                    row.project
                  )}
                </div>
                <div className="text-gray-400">{row.provider}</div>
                <div>
                  <StatusBadge status={row.status} />
                </div>
                <div className="text-gray-500 text-sm">{formatRelativeTime(row.time)}</div>
              </div>
            ))}
        </Panel>
      </div>
    </div>
  );
}

export default Dashboard;