import { useState, useEffect, useCallback, useMemo } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5002";

const LANGUAGE_COLORS = {
  JavaScript: "bg-yellow-400",
  TypeScript: "bg-blue-400",
  Python: "bg-blue-300",
  HTML: "bg-orange-400",
  CSS: "bg-purple-400",
  Java: "bg-red-400",
  Go: "bg-cyan-400",
  Rust: "bg-orange-500",
  Shell: "bg-green-400",
  Ruby: "bg-red-500",
  PHP: "bg-indigo-400",
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

function formatJoinDate(input) {
  if (!input) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/* ---------- icons ---------- */

function ExternalLinkIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={`w-3.5 h-3.5 shrink-0 ${className}`}>
      <path d="M3.75 2A1.75 1.75 0 002 3.75v8.5C2 13.216 2.784 14 3.75 14h8.5A1.75 1.75 0 0014 12.25v-3.5a.75.75 0 00-1.5 0v3.5a.25.25 0 01-.25.25h-8.5a.25.25 0 01-.25-.25v-8.5a.25.25 0 01.25-.25h3.5a.75.75 0 000-1.5h-3.5zM9 1.75A.75.75 0 019.75 1h4.5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0V3.56L8.03 9.03a.75.75 0 01-1.06-1.06L12.44 2.5H9.75A.75.75 0 019 1.75z" />
    </svg>
  );
}

function GithubIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={`w-4 h-4 shrink-0 ${className}`}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function BuildingIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={`w-3.5 h-3.5 shrink-0 ${className}`}>
      <path d="M4 2.5a.5.5 0 01.5-.5h7a.5.5 0 01.5.5v11h1.5a.5.5 0 010 1H2.5a.5.5 0 010-1H4v-11zM5 3v10h6V3H5zm1 2h1v1H6V5zm3 0h1v1H9V5zm-3 3h1v1H6V8zm3 0h1v1H9V8z" />
    </svg>
  );
}

function PinIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={`w-3.5 h-3.5 shrink-0 ${className}`}>
      <path d="M8 16s6-5.5 6-9.5a6 6 0 10-12 0C2 10.5 8 16 8 16zm0-6.5a3 3 0 110-6 3 3 0 010 6z" />
    </svg>
  );
}

function LinkIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={`w-3.5 h-3.5 shrink-0 ${className}`}>
      <path d="M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-4.55 9.45a2 2 0 010-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25a.75.75 0 00-1.06-1.06l-1.25 1.25a2 2 0 01-2.83 0z" />
    </svg>
  );
}

function StarIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={`w-3.5 h-3.5 shrink-0 ${className}`}>
      <path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.79L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z" />
    </svg>
  );
}

function ForkIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={`w-3.5 h-3.5 shrink-0 ${className}`}>
      <path d="M5 3.25a2.25 2.25 0 114.5 0 2.25 2.25 0 01-4.5 0zm2.25.75a.75.75 0 100-1.5.75.75 0 000 1.5zM4 7.25a.75.75 0 01.75.75v.25a1.25 1.25 0 001.25 1.25h4a1.25 1.25 0 001.25-1.25V8a.75.75 0 011.5 0v.25a2.75 2.75 0 01-2.75 2.75H8.75v1.65a2.25 2.25 0 11-1.5 0V11H6a2.75 2.75 0 01-2.75-2.75V8A.75.75 0 014 7.25zM8 12.75a.75.75 0 100 1.5.75.75 0 000-1.5z" />
    </svg>
  );
}

function CommitIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={`w-4 h-4 shrink-0 ${className}`}>
      <path d="M11.93 8.5a4.002 4.002 0 01-7.86 0H.75a.75.75 0 010-1.5h3.32a4.002 4.002 0 017.86 0h3.32a.75.75 0 010 1.5h-3.32zM8 10.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
    </svg>
  );
}

/* ---------- shared primitives — same design system used across the app ---------- */

function StatCard({ label, value, tone = "neutral", loading }) {
  const toneStyle = {
    ok: "text-emerald-400",
    warn: "text-yellow-400",
    danger: "text-red-400",
    purple: "text-purple-400",
    gold: "text-amber-400",
    neutral: "text-gray-200",
  }[tone];

  return (
    <div className="border border-gray-800 bg-gray-950 rounded-xl px-5 py-4 flex-1 min-w-[140px]">
      <p className="text-xs text-gray-500 uppercase tracking-widest">{label}</p>
      {loading ? (
        <div className="w-16 h-8 bg-gray-800 rounded animate-pulse mt-2" />
      ) : (
        <p className={`text-2xl font-bold mt-1 ${toneStyle}`}>{value}</p>
      )}
    </div>
  );
}

function Card({ children, className = "" }) {
  return <div className={`border border-gray-800 bg-[#0d1117] rounded-lg p-5 ${className}`}>{children}</div>;
}

function Panel({ title, children, right }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">{title}</p>
        {right}
      </div>
      {children}
    </Card>
  );
}

/* ---------- main page ---------- */

function Profile() {
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);

  const [stats, setStats] = useState({ projects: 0, deployments: 0, active: 0, failed: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  const [repos, setRepos] = useState([]);
  const [reposLoading, setReposLoading] = useState(true);

  const [commits, setCommits] = useState([]);
  const [commitsLoading, setCommitsLoading] = useState(true);

  const [error, setError] = useState(null);

  const loadUser = useCallback(async () => {
    setUserLoading(true);
    try {
      const res = await fetch(`${API_URL}/user`, { credentials: "include" });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to load profile.");
      setUser(data.user);
    } catch (err) {
      setError(err.message || "Couldn't load your profile.");
    } finally {
      setUserLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/dashboard`, { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setStats({
          projects: data.stats?.projects ?? 0,
          deployments: data.stats?.deployments ?? 0,
          active: data.stats?.active ?? 0,
          failed: data.stats?.failed ?? 0,
        });
      }
    } catch {
      // supplementary — page still renders without it
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadRepos = useCallback(async () => {
    setReposLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/repo/list`, { credentials: "include" });
      const data = await res.json();
      if (data.success) setRepos(data.repos);
    } catch {
      // supplementary — languages/top repos sections just stay empty
    } finally {
      setReposLoading(false);
    }
  }, []);

  const loadCommits = useCallback(async () => {
    setCommitsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/repo/recent-commits`, { credentials: "include" });
      const data = await res.json();
      if (data.success) setCommits(data.commits);
    } catch {
      // supplementary — activity feed just stays empty
    } finally {
      setCommitsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
    loadStats();
    loadRepos();
    loadCommits();
  }, [loadUser, loadStats, loadRepos, loadCommits]);

  const initials = user?.displayName
    ? user.displayName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
    : user?.username?.slice(0, 2).toUpperCase() || "";

  const joinDate = formatJoinDate(user?.createdAt);

  // top languages by repo count (simple, readable — not weighted by bytes,
  // since GitHub's per-repo language-bytes endpoint would mean N extra
  // API calls just for this page)
  const topLanguages = useMemo(() => {
    const counts = {};
    repos.forEach((r) => {
      if (r.language) counts[r.language] = (counts[r.language] || 0) + 1;
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([language, count]) => ({ language, count, pct: total ? Math.round((count / total) * 100) : 0 }));
  }, [repos]);

  const topRepos = useMemo(() => {
    return [...repos].sort((a, b) => b.stars - a.stars).slice(0, 5);
  }, [repos]);

  const totalStars = useMemo(() => repos.reduce((sum, r) => sum + (r.stars || 0), 0), [repos]);

  return (
    <div className="min-h-full bg-black">
      <div className="max-w-screen mx-auto px-10 py-10 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl uppercase font-semibold text-white">Profile</h1>
          <p className="text-sm text-gray-500 mt-0.5">Your DeployX account, connected via GitHub.</p>
        </div>

        {error && (
          <div className="border border-red-900 bg-red-500/10 rounded-lg p-4 flex items-center justify-between">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={() => {
                setError(null);
                loadUser();
              }}
              className="h-9 px-3 rounded-lg border border-gray-800 text-xs text-gray-400 hover:text-gray-200 hover:border-gray-700 transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* profile card */}
        <Card className="flex items-start gap-5 flex-wrap">
          <div className="w-20 h-20 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center overflow-hidden shrink-0">
            {userLoading ? (
              <div className="w-full h-full bg-gray-800 animate-pulse" />
            ) : user?.avatar ? (
              <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
            ) : (
              <span className="text-gray-400 text-xl font-bold">{initials}</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            {userLoading ? (
              <>
                <div className="h-5 w-40 bg-gray-800 rounded animate-pulse" />
                <div className="h-4 w-24 bg-gray-800 rounded animate-pulse mt-2" />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-lg font-semibold text-white truncate">{user?.displayName || user?.username}</p>
                  <span className="text-sm text-gray-500">@{user?.username}</span>
                </div>

                {user?.bio && <p className="text-sm text-gray-400 mt-2 max-w-xl leading-relaxed">{user.bio}</p>}

                <div className="flex items-center gap-4 flex-wrap mt-3 text-xs text-gray-500">
                  {user?.company && (
                    <span className="flex items-center gap-1.5">
                      <BuildingIcon className="text-gray-600" />
                      {user.company}
                    </span>
                  )}
                  {user?.location && (
                    <span className="flex items-center gap-1.5">
                      <PinIcon className="text-gray-600" />
                      {user.location}
                    </span>
                  )}
                  {user?.blog && (
                    <a
                      href={user.blog.startsWith("http") ? user.blog : `https://${user.blog}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 hover:text-gray-300 transition"
                    >
                      <LinkIcon className="text-gray-600" />
                      {user.blog.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                  {joinDate && <span>Joined GitHub {joinDate}</span>}
                </div>

                {(user?.followers != null || user?.following != null || user?.publicRepos != null) && (
                  <div className="flex items-center gap-4 flex-wrap mt-3 text-sm">
                    {user.followers != null && (
                      <span className="text-gray-300">
                        <span className="font-semibold text-white">{user.followers}</span> followers
                      </span>
                    )}
                    {user.following != null && (
                      <span className="text-gray-300">
                        <span className="font-semibold text-white">{user.following}</span> following
                      </span>
                    )}
                    {user.publicRepos != null && (
                      <span className="text-gray-300">
                        <span className="font-semibold text-white">{user.publicRepos}</span> public repos
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {!userLoading && user?.username && (
            <a
              href={user.profileUrl || `https://github.com/${user.username}`}
              target="_blank"
              rel="noreferrer"
              className="h-9 px-4 rounded-lg border border-gray-800 text-sm text-gray-300 hover:text-white hover:border-gray-600 transition flex items-center gap-2 shrink-0"
            >
              <GithubIcon />
              View on GitHub
              <ExternalLinkIcon className="text-gray-500" />
            </a>
          )}
        </Card>

        {/* stats */}
        <div className="flex flex-wrap gap-4">
          <StatCard label="Repositories" value={repos.length} tone="purple" loading={reposLoading} />
          <StatCard label="Deployments" value={stats.deployments} tone="warn" loading={statsLoading} />
          <StatCard label="Active" value={stats.active} tone="ok" loading={statsLoading} />
          <StatCard label="Failed" value={stats.failed} tone="danger" loading={statsLoading} />
          <StatCard label="Total stars" value={totalStars} tone="blue" loading={reposLoading} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* top languages */}
          <Panel title="Top languages">
            {reposLoading ? (
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-4 bg-gray-900 rounded animate-pulse" />
                ))}
              </div>
            ) : topLanguages.length === 0 ? (
              <p className="text-sm text-gray-600 py-2">No language data yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {topLanguages.map(({ language, count, pct }) => (
                  <div key={language} className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${LANGUAGE_COLORS[language] || "bg-gray-500"}`} />
                    <span className="text-sm text-gray-200 w-24 truncate shrink-0">{language}</span>
                    <div className="flex-1 h-2 bg-gray-900 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${LANGUAGE_COLORS[language] || "bg-gray-500"}`}
                        style={{ width: `${pct}%`, opacity: 0.8 }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-16 text-right shrink-0">
                      {count} repo{count === 1 ? "" : "s"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* most starred repos */}
          <Panel title="Most starred repositories">
            {reposLoading ? (
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-4 bg-gray-900 rounded animate-pulse" />
                ))}
              </div>
            ) : topRepos.length === 0 || topRepos[0].stars === 0 ? (
              <p className="text-sm text-gray-600 py-2">No starred repositories yet.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {topRepos
                  .filter((r) => r.stars > 0)
                  .map((repo) => (
                    <a
                      key={repo.fullName}
                      href={repo.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-3 py-2 border-b border-gray-900 last:border-0 hover:bg-gray-900/40 -mx-2 px-2 rounded transition"
                    >
                      <span className="text-sm text-gray-200 truncate">{repo.name}</span>
                      <div className="flex items-center gap-3 text-xs text-gray-500 shrink-0">
                        <span className="flex items-center gap-1">
                          <StarIcon /> {repo.stars}
                        </span>
                        <span className="flex items-center gap-1">
                          <ForkIcon /> {repo.forks}
                        </span>
                      </div>
                    </a>
                  ))}
              </div>
            )}
          </Panel>
        </div>

        {/* recent activity */}
        <Panel title="Recent activity">
          {commitsLoading ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-4 bg-gray-900 rounded animate-pulse" />
              ))}
            </div>
          ) : commits.length === 0 ? (
            <p className="text-sm text-gray-600 py-2">No recent commits found.</p>
          ) : (
            <div className="flex flex-col">
              {commits.slice(0, 8).map((c, i) => (
                <div key={`${c.sha}-${i}`} className="flex items-start gap-3 py-2.5 border-b border-gray-900 last:border-0">
                  <div className="w-7 h-7 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center shrink-0 mt-0.5">
                    <CommitIcon className="text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{c.message}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5 flex-wrap">
                      <span className="font-mono text-gray-500">{c.repo}</span>
                      <span>·</span>
                      <span>{formatRelativeTime(c.time)}</span>
                      <a href={c.url} target="_blank" rel="noreferrer" className="text-gray-600 hover:text-gray-300 ml-1">
                        <ExternalLinkIcon />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

export default Profile;