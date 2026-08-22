import { useState, useEffect, useCallback, useMemo } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5002";

function dayKey(input) {
  const d = new Date(input);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ---------- stat card ---------- */

function StatCard({ label, value, tone = "neutral", sublabel }) {
  const toneStyle = {
    ok: "text-emerald-400",
    warn: "text-yellow-400",
    danger: "text-red-400",
    neutral: "text-gray-200",
  }[tone];

  return (
    <div className="border border-gray-800 bg-gray-950 rounded-xl px-5 py-4 flex-1 min-w-[150px]">
      <p className="text-xs text-gray-500 uppercase tracking-widest">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${toneStyle}`}>{value}</p>
      {sublabel && <p className="text-[11px] text-gray-600 mt-1">{sublabel}</p>}
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

/* ---------- contribution heatmap (GitHub-style) ---------- */

function ContributionHeatmap({ dailyCounts }) {
  const weeks = 26; // ~6 months
  const today = startOfDay(new Date());
  const start = addDays(today, -(weeks * 7 - 1));
  // align start to a Sunday so columns line up like GitHub's graph
  const startAligned = addDays(start, -start.getDay());

  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const date = addDays(startAligned, i);
    const key = dayKey(date);
    cells.push({ date, key, count: dailyCounts[key] || 0, future: date > today });
  }

  const columns = [];
  for (let w = 0; w < weeks; w++) {
    columns.push(cells.slice(w * 7, w * 7 + 7));
  }

  const maxCount = Math.max(1, ...cells.map((c) => c.count));

  const colorFor = (count) => {
    if (count === 0) return "#161b22";
    const ratio = count / maxCount;
    if (ratio > 0.75) return "#39d353";
    if (ratio > 0.5) return "#26a641";
    if (ratio > 0.25) return "#006d32";
    return "#0e4429";
  };

  // month labels — show a label above the first column that lands in a new month
  const monthLabels = [];
  let lastMonth = null;
  columns.forEach((col, i) => {
    const firstOfCol = col[0].date;
    const m = firstOfCol.getMonth();
    if (m !== lastMonth) {
      monthLabels.push({ index: i, label: MONTH_LABELS[m] });
      lastMonth = m;
    }
  });

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex flex-col gap-1 min-w-full">
        <div className="flex gap-[3px] pl-8 mb-1">
          {columns.map((_, i) => {
            const found = monthLabels.find((m) => m.index === i);
            return (
              <div key={i} className="w-[13px] text-[10px] text-gray-500 shrink-0">
                {found ? found.label : ""}
              </div>
            );
          })}
        </div>
        <div className="flex gap-1">
          <div className="flex flex-col gap-[3px] pr-1 shrink-0">
            {WEEKDAY_LABELS.map((label, i) => (
              <div key={i} className="h-[13px] text-[10px] text-gray-500 leading-[13px]">
                {label}
              </div>
            ))}
          </div>
          <div className="flex gap-[3px]">
            {columns.map((col, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {col.map((cell) => (
                  <div
                    key={cell.key}
                    title={`${cell.count} event${cell.count === 1 ? "" : "s"} on ${cell.date.toLocaleDateString()}`}
                    className="w-[13px] h-[13px] rounded-[2px]"
                    style={{ backgroundColor: cell.future ? "transparent" : colorFor(cell.count) }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5 pl-8 mt-2">
          <span className="text-[10px] text-gray-500">Less</span>
          {["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"].map((c) => (
            <div key={c} className="w-[10px] h-[10px] rounded-[2px]" style={{ backgroundColor: c }} />
          ))}
          <span className="text-[10px] text-gray-500">More</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- weekly bar chart ---------- */

function WeeklyBarChart({ commits, deployments }) {
  const weekCount = 8;
  const today = startOfDay(new Date());

  const buckets = Array.from({ length: weekCount }, (_, i) => {
    const weekEnd = addDays(today, -i * 7);
    const weekStart = addDays(weekEnd, -6);
    return { weekStart, weekEnd, commits: 0, deployments: 0 };
  }).reverse();

  const bucketFor = (date) => {
    const d = startOfDay(new Date(date));
    return buckets.find((b) => d >= b.weekStart && d <= b.weekEnd);
  };

  commits.forEach((c) => {
    const b = bucketFor(c.time);
    if (b) b.commits += 1;
  });
  deployments.forEach((d) => {
    const b = bucketFor(d.time);
    if (b) b.deployments += 1;
  });

  const max = Math.max(1, ...buckets.map((b) => b.commits + b.deployments));

  return (
    <div className="flex items-end gap-3 h-40">
      {buckets.map((b, i) => {
        const commitH = (b.commits / max) * 100;
        const deployH = (b.deployments / max) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-2">
            <div className="w-full flex flex-col items-center justify-end h-32 gap-[2px]">
              {b.deployments > 0 && (
                <div
                  className="w-full max-w-[28px] bg-cyan-500/70 rounded-t-sm"
                  style={{ height: `${Math.max(deployH, 4)}%` }}
                  title={`${b.deployments} deployment(s)`}
                />
              )}
              {b.commits > 0 && (
                <div
                  className="w-full max-w-[28px] bg-emerald-500/80 rounded-t-sm"
                  style={{ height: `${Math.max(commitH, 4)}%` }}
                  title={`${b.commits} commit(s)`}
                />
              )}
              {b.commits === 0 && b.deployments === 0 && <div className="w-full max-w-[28px] h-[2px] bg-gray-800" />}
            </div>
            <span className="text-[10px] text-gray-600">
              {b.weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- deploy success ring ---------- */

function SuccessRing({ live, failed }) {
  const total = live + failed;
  const pct = total === 0 ? 0 : Math.round((live / total) * 100);
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex items-center gap-5">
      <svg width="100" height="100" viewBox="0 0 100 100" className="shrink-0 -rotate-90">
        <circle cx="50" cy="50" r="42" fill="none" stroke="#21262d" strokeWidth="10" />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke={pct >= 70 ? "#39d353" : pct >= 40 ? "#d29922" : "#f85149"}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={total === 0 ? circumference : offset}
          strokeLinecap="round"
        />
      </svg>
      <div>
        <p className="text-2xl font-bold text-white">{total === 0 ? "—" : `${pct}%`}</p>
        <p className="text-xs text-gray-500 mt-1">
          {live} live · {failed} failed
        </p>
      </div>
    </div>
  );
}

/* ---------- main page ---------- */

function Activity() {
  const [commits, setCommits] = useState([]);
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadActivity = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [commitsRes, dashboardRes] = await Promise.all([
        fetch(`${API_URL}/api/repo/recent-commits`, { credentials: "include" }),
        fetch(`${API_URL}/api/dashboard`, { credentials: "include" }),
      ]);
      const commitsData = await commitsRes.json();
      const dashboardData = await dashboardRes.json();

      if (!commitsData.success) throw new Error(commitsData.message || "Failed to load commit activity.");
      if (!dashboardData.success) throw new Error(dashboardData.message || "Failed to load deployment activity.");

      setCommits(commitsData.commits);
      setDeployments(dashboardData.deployments.filter((d) => d.status !== "pushed"));
    } catch (err) {
      setError(err.message || "Couldn't load your activity.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  const dailyCounts = useMemo(() => {
    const map = {};
    commits.forEach((c) => {
      const key = dayKey(c.time);
      map[key] = (map[key] || 0) + 1;
    });
    deployments.forEach((d) => {
      const key = dayKey(d.time);
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [commits, deployments]);

  const streaks = useMemo(() => {
    const activeDays = new Set(Object.keys(dailyCounts).filter((k) => dailyCounts[k] > 0));
    let longest = 0;
    let running = 0;
    let current = 0;

    // walk backwards from today to compute current streak
    let cursor = startOfDay(new Date());
    while (activeDays.has(dayKey(cursor))) {
      current += 1;
      cursor = addDays(cursor, -1);
    }

    // walk the last ~180 days forward to find the longest streak in range
    let walker = addDays(startOfDay(new Date()), -179);
    for (let i = 0; i < 180; i++) {
      if (activeDays.has(dayKey(walker))) {
        running += 1;
        longest = Math.max(longest, running);
      } else {
        running = 0;
      }
      walker = addDays(walker, 1);
    }

    return { current, longest };
  }, [dailyCounts]);

  const topRepos = useMemo(() => {
    const counts = {};
    commits.forEach((c) => {
      counts[c.repo] = (counts[c.repo] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [commits]);

  const liveCount = deployments.filter((d) => d.status === "live").length;
  const failedCount = deployments.filter((d) => d.status === "failed").length;
  const activeDayCount = Object.values(dailyCounts).filter((c) => c > 0).length;

  return (
    <div className="min-h-full bg-black p-10">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <h1 className="text-2xl font-extrabold uppercase">Activities</h1>
        <button
          onClick={loadActivity}
          disabled={loading}
          className="text-xs text-gray-400 border border-gray-700 rounded-lg px-3 py-1.5 hover:border-gray-400 disabled:opacity-40 transition"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="border border-red-800 bg-red-950/20 rounded-lg p-4 flex items-center justify-between mb-6">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={loadActivity}
            className="text-xs text-gray-400 border border-gray-700 rounded-lg px-3 py-1.5 hover:border-gray-500 transition"
          >
            Retry
          </button>
        </div>
      )}

      {!error && loading && (
        <div className="flex flex-col gap-4">
          <div className="h-20 bg-gray-900 rounded-xl animate-pulse" />
          <div className="h-40 bg-gray-900 rounded-xl animate-pulse" />
        </div>
      )}

      {!error && !loading && (
        <div className="flex flex-col gap-5">
          {/* stats row */}
          <div className="flex flex-wrap gap-4">
            <StatCard label="Active days" value={activeDayCount} sublabel="last 6 months" />
            <StatCard label="Current streak" value={`${streaks.current}d`} tone={streaks.current > 0 ? "ok" : "neutral"} />
            <StatCard label="Longest streak" value={`${streaks.longest}d`} />
            <StatCard label="Total commits" value={commits.length} sublabel="across recent repos" />
            <StatCard label="Deployments" value={deployments.length} />
          </div>

          {/* contribution heatmap */}
          <Panel title="Activity — last 6 months">
            <ContributionHeatmap dailyCounts={dailyCounts} />
          </Panel>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* weekly bar chart */}
            <Panel
              title="Weekly activity"
              right={
                <div className="flex items-center gap-3 text-[10px] text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-emerald-500/80" /> commits
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-cyan-500/70" /> deploys
                  </span>
                </div>
              }
            >
              <WeeklyBarChart commits={commits} deployments={deployments} />
            </Panel>

            {/* deploy success rate */}
            <Panel title="Deployment success rate">
              <SuccessRing live={liveCount} failed={failedCount} />
            </Panel>
          </div>

          {/* top repos */}
          <Panel title="Most active repositories">
            {topRepos.length === 0 ? (
              <p className="text-sm text-gray-600 py-4">No commit activity yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {topRepos.map(([repo, count], i) => {
                  const max = topRepos[0][1];
                  return (
                    <div key={repo} className="flex items-center gap-3">
                      <span className="text-xs text-gray-600 w-4 shrink-0">{i + 1}</span>
                      <span className="text-sm text-gray-200 w-40 truncate shrink-0">{repo}</span>
                      <div className="flex-1 h-2 bg-gray-900 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500/70 rounded-full"
                          style={{ width: `${(count / max) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-16 text-right shrink-0">{count} commits</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

export default Activity;