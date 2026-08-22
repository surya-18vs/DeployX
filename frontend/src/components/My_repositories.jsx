import { useState, useEffect, useCallback, useMemo } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5002";

const IGNORE_PATTERNS = [
  /node_modules/,
  /(^|\/)\.git\//,
  /(^|\/)dist\//,
  /(^|\/)build\//,
  /(^|\/)\.env$/,
  /(^|\/)\.DS_Store$/,
];

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

function shouldIgnore(relativePath) {
  return IGNORE_PATTERNS.some((pattern) => pattern.test(relativePath));
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result.split(",")[1]) || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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

function LockIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={`w-3 h-3 shrink-0 ${className}`}>
      <path d="M4 4a4 4 0 118 0v2h.25A1.75 1.75 0 0114 7.75v5.5A1.75 1.75 0 0112.25 15h-8.5A1.75 1.75 0 012 13.25v-5.5A1.75 1.75 0 013.75 6H4V4zm8.25 3.5h-8.5a.25.25 0 00-.25.25v5.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25v-5.5a.25.25 0 00-.25-.25zM5.5 6h5V4a2.5 2.5 0 00-5 0v2z" />
    </svg>
  );
}

function GlobeIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={`w-3 h-3 shrink-0 ${className}`}>
      <path d="M8 0a8 8 0 100 16A8 8 0 008 0zM1.5 8a6.5 6.5 0 011.02-3.5h2.7a17.6 17.6 0 000 7H2.52A6.5 6.5 0 011.5 8zm12.98-3.5A6.5 6.5 0 0114.5 8a6.5 6.5 0 01-1.02 3.5h-2.7a17.6 17.6 0 000-7h2.7zM8 1.5c.5 0 1.34 1.07 1.73 3H6.27C6.66 2.57 7.5 1.5 8 1.5zM6.27 12.5h3.46c-.39 1.93-1.23 3-1.73 3s-1.34-1.07-1.73-3zM5.24 11a16.1 16.1 0 010-6h5.52a16.1 16.1 0 010 6H5.24z" />
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

function TrashIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={`w-4 h-4 shrink-0 ${className}`}>
      <path d="M6.5 1.75A.75.75 0 017.25 1h1.5a.75.75 0 01.75.75V3h3.25a.75.75 0 010 1.5H12.9l-.68 8.16A1.75 1.75 0 0110.48 14H5.52a1.75 1.75 0 01-1.74-1.34L3.1 4.5H2.75a.75.75 0 010-1.5H6V1.75zM4.61 4.5l.66 7.9a.25.25 0 00.25.23h4.96a.25.25 0 00.25-.23l.66-7.9H4.61zM7.5 3h1V2.5h-1V3z" />
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

function XIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={`w-4 h-4 shrink-0 ${className}`}>
      <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
    </svg>
  );
}

function ChevronIcon({ className = "", open }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? "rotate-90" : ""} ${className}`}
    >
      <path d="M6.22 3.22a.75.75 0 011.06 0l4.5 4.5a.75.75 0 010 1.06l-4.5 4.5a.75.75 0 01-1.06-1.06L10.19 8 6.22 4.03a.75.75 0 010-1.06z" />
    </svg>
  );
}

function CheckCircleIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`shrink-0 ${className}`}>
      <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.15" />
      <path
        d="M8 12.5l2.5 2.5L16 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

function Spinner({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`w-4 h-4 shrink-0 animate-spin ${className}`}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- delete confirmation modal ---------- */

function DeleteModal({ repo, onCancel, onConfirmed }) {
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const matches = typed.trim() === repo.name;

  const handleDelete = async () => {
    if (!matches) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/repo/${repo.owner}/${repo.name}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      onConfirmed(repo);
    } catch (err) {
      setError(err.message || "Failed to delete repository.");
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-md border border-red-800 bg-gray-950 rounded-xl p-6 flex flex-col gap-4">
        <div>
          <h2 className="text-white font-bold text-lg">Delete repository</h2>
          <p className="text-gray-400 text-sm mt-1">
            This permanently deletes{" "}
            <span className="text-white font-semibold">{repo.owner}/{repo.name}</span> from
            GitHub, including all commits, issues, and settings. This can't be undone.
          </p>
        </div>

        <div>
          <label className="text-xs text-gray-500">
            Type <span className="text-gray-300 font-semibold">{repo.name}</span> to confirm.
          </label>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="w-full mt-1.5 border border-gray-700 bg-black rounded-lg px-3 py-2 text-white outline-0 focus:border-red-500"
            autoFocus
          />
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="text-sm text-gray-400 border border-gray-700 rounded-lg px-4 py-2 hover:border-gray-500 transition disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!matches || deleting}
            className="text-sm text-white bg-red-700 rounded-lg px-4 py-2 hover:bg-red-600 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {deleting && <Spinner />}
            {deleting ? "Deleting..." : "Delete this repository"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- commit changes modal ---------- */

function CommitModal({ repo, onClose, onCommitted }) {
  const [pickedFiles, setPickedFiles] = useState([]);
  const [folderName, setFolderName] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("idle"); // idle | committing | done | error
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleFolderSelect = (e) => {
    const list = Array.from(e.target.files || []);
    const filtered = list.filter((f) => !shouldIgnore(f.webkitRelativePath));
    setPickedFiles(filtered);
    setFolderName(filtered[0]?.webkitRelativePath?.split("/")[0] || "folder");
  };

  const handleCommit = async () => {
    if (pickedFiles.length === 0) return;
    setStatus("committing");
    setError(null);

    try {
      const files = await Promise.all(
        pickedFiles.map(async (file) => ({
          path: file.webkitRelativePath.split("/").slice(1).join("/") || file.name,
          content: await readFileAsBase64(file),
        }))
      );

      const res = await fetch(`${API_URL}/api/repo/commit`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: repo.owner,
          repo: repo.name,
          branch: repo.defaultBranch,
          message,
          files,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      setResult(data);
      setStatus("done");
      onCommitted?.();
    } catch (err) {
      setError(err.message || "Failed to commit changes.");
      setStatus("error");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-lg border border-gray-700 bg-gray-950 rounded-xl overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-white font-bold text-lg">Commit changes</h2>
            <p className="text-gray-500 text-sm mt-0.5">
              Pushing to <span className="text-gray-300 font-semibold">{repo.owner}/{repo.name}</span> on{" "}
              <span className="text-gray-300 font-semibold">{repo.defaultBranch}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white shrink-0">
            <XIcon />
          </button>
        </div>

        {status === "done" ? (
          /* success state */
          <div className="p-6 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-950 border border-emerald-700 flex items-center justify-center">
              <CheckCircleIcon className="text-emerald-400 w-6 h-6" />
            </div>
            <div>
              <p className="text-white font-semibold">Changes committed</p>
              <p className="text-gray-500 text-sm mt-1">
                {result.filesPushed} file{result.filesPushed === 1 ? "" : "s"} pushed successfully.
              </p>
            </div>
            <a
              href={result.commitUrl}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 text-sm underline"
            >
              View commit on GitHub
            </a>
            <button
              onClick={onClose}
              className="mt-2 text-sm text-gray-200 bg-gray-800 border border-gray-600 rounded-lg px-5 py-2 hover:border-white transition"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="p-6 flex flex-col gap-5">
            {/* step 1 */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-gray-800 border border-gray-600 text-gray-300 text-[11px] font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <span className="text-sm font-semibold text-gray-200">Select the folder with your changes</span>
              </div>

              {pickedFiles.length === 0 ? (
                <label className="block ml-7 border-2 border-dashed border-gray-700 rounded-lg p-6 text-center cursor-pointer bg-black/40 hover:border-white transition">
                  <input
                    type="file"
                    webkitdirectory=""
                    directory=""
                    multiple
                    className="hidden"
                    onChange={handleFolderSelect}
                    disabled={status === "committing"}
                  />
                  <p className="text-gray-500 text-sm">Click to browse for a folder</p>
                </label>
              ) : (
                <div className="ml-7 border border-gray-700 bg-black rounded-lg px-3 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-200 text-sm min-w-0">
                    <FolderIcon className="text-gray-400 shrink-0" />
                    <span className="font-semibold truncate">{folderName}</span>
                    <span className="text-gray-500 text-xs shrink-0">({pickedFiles.length} files)</span>
                  </div>
                  {status !== "committing" && (
                    <button
                      onClick={() => {
                        setPickedFiles([]);
                        setFolderName("");
                      }}
                      className="text-gray-500 hover:text-white shrink-0"
                    >
                      <XIcon />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* step 2 */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-gray-800 border border-gray-600 text-gray-300 text-[11px] font-bold flex items-center justify-center shrink-0">
                  2
                </span>
                <span className="text-sm font-semibold text-gray-200">
                  Describe what changed <span className="text-gray-600 font-normal">(optional)</span>
                </span>
              </div>
              <input
                type="text"
                placeholder="e.g. Fix header layout on mobile"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={status === "committing"}
                className="w-full ml-7 border border-gray-700 bg-black rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-0 focus:border-gray-400 disabled:opacity-50"
                style={{ width: "calc(100% - 1.75rem)" }}
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-950/20 border border-red-900 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* step 3 */}
            <div className="flex gap-2 justify-end pt-1 border-t border-gray-800">
              <button
                onClick={onClose}
                disabled={status === "committing"}
                className="text-sm text-gray-400 border border-gray-700 rounded-lg px-4 py-2 hover:border-gray-500 transition disabled:opacity-40 mt-4"
              >
                Cancel
              </button>
              <button
                onClick={handleCommit}
                disabled={pickedFiles.length === 0 || status === "committing"}
                className="text-sm text-white bg-gray-700 border border-gray-500 rounded-lg px-4 py-2 hover:border-white transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 mt-4"
              >
                {status === "committing" && <Spinner />}
                {status === "committing" ? "Pushing..." : "Push commit"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- table header ---------- */

function TableHeader() {
  return (
    <div className="flex items-center gap-4 px-4 py-2.5 border-b-[2px] border-gray-700 text-[11px] uppercase tracking-widest text-gray-500">
      <div className="flex-1 min-w-0">Repository</div>
      <div className="w-24 shrink-0 hidden sm:block">Language</div>
      <div className="w-14 shrink-0 text-right">Stars</div>
      <div className="w-14 shrink-0 text-right">Forks</div>
      <div className="w-24 shrink-0 hidden md:block text-right">Updated</div>
      <div className="w-44 shrink-0 text-right">Actions</div>
    </div>
  );
}

/* ---------- table row ---------- */

function RepoRow({ repo, onDeleteRequest, onCommitRequest }) {
  return (
    <div className="border-b border-gray-800">
      <div className="flex items-center gap-4 px-4 py-3 hover:bg-gray-900/40 transition-colors">
        {/* repository name + badge + description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <a
              href={repo.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="text-gray-200 text-sm font-semibold truncate hover:underline hover:text-white"
              title={repo.name}
            >
              {repo.name}
            </a>
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-purple-400/80 border border-purple-400/40 rounded-full px-2 py-0.5 shrink-0">
              {repo.private ? <LockIcon /> : <GlobeIcon />}
              {repo.private ? "Private" : "Public"}
            </span>
            <a
              href={repo.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="text-gray-600 hover:text-white shrink-0"
              title="Open in GitHub"
            >
              <ExternalLinkIcon />
            </a>
          </div>
          <p className="text-gray-600 text-xs truncate mt-0.5">{repo.description || "No description"}</p>
        </div>

        {/* language */}
        <div className="w-24 shrink-0 hidden sm:flex items-center gap-1.5 text-xs text-gray-400">
          {repo.language ? (
            <>
              <span className={`w-2 h-2 rounded-full shrink-0 ${LANGUAGE_COLORS[repo.language] || "bg-gray-500"}`} />
              <span className="truncate">{repo.language}</span>
            </>
          ) : (
            <span className="text-gray-600">—</span>
          )}
        </div>

        {/* stars */}
        <div className="w-14 shrink-0 flex items-center justify-end gap-1 text-xs text-gray-400">
          <StarIcon /> {repo.stars}
        </div>

        {/* forks */}
        <div className="w-14 shrink-0 flex items-center justify-end gap-1 text-xs text-gray-400">
          <ForkIcon /> {repo.forks}
        </div>

        {/* updated */}
        <div className="w-24 shrink-0 hidden md:block text-right text-xs text-gray-500">
          {formatRelativeTime(repo.pushedAt || repo.updatedAt)}
        </div>

        {/* actions — the primary, clearly visible controls in the row */}
        <div className="shrink-0 flex items-center justify-end gap-2">
          <button
            onClick={() => onCommitRequest(repo)}
            className="flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 border border-gray-600 bg-gray-800 text-gray-200 hover:border-white hover:bg-gray-700 transition"
          >
            <CommitIcon /> Commit
          </button>
          <button
            onClick={() => onDeleteRequest(repo)}
            className="flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 border border-red-800 bg-red-950/40 text-red-400 hover:bg-red-700 hover:text-white hover:border-red-600 transition"
          >
            <TrashIcon /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- main page ---------- */

function My_repositories() {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("updated"); // updated | name | stars
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [commitTarget, setCommitTarget] = useState(null);

  const loadRepos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/repo/list`, { credentials: "include" });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to load repositories.");
      setRepos(data.repos);
    } catch (err) {
      setError(err.message || "Couldn't load your repositories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRepos();
  }, [loadRepos]);

  const visibleRepos = useMemo(() => {
    let list = repos;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (r) => r.name.toLowerCase().includes(q) || (r.description || "").toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "stars") return b.stars - a.stars;
      return new Date(b.pushedAt || b.updatedAt) - new Date(a.pushedAt || a.updatedAt);
    });
    return list;
  }, [repos, query, sortBy]);

  const handleDeleted = (repo) => {
    setRepos((prev) => prev.filter((r) => r.name !== repo.name));
    setDeleteTarget(null);
  };

  return (
    <div className="min-h-full bg-black p-10">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <h1 className="text-2xl  font-extrabold uppercase ">My Repositories</h1>
        <button
          onClick={loadRepos}
          disabled={loading}
          className="text-xs text-gray-400 border border-gray-700 rounded-lg px-3 py-1.5 hover:border-gray-400 disabled:opacity-40 transition"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap mb-4">
        <input
          type="text"
          placeholder="Search repositories..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-[200px] border border-gray-700 bg-gray-950 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-0 focus:border-gray-400"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="border border-gray-700 bg-gray-950 rounded-lg px-3 py-2 text-sm text-gray-300 outline-0 focus:border-gray-400"
        >
          <option value="updated">Recently updated</option>
          <option value="name">Name (A–Z)</option>
          <option value="stars">Most stars</option>
        </select>
      </div>

      {error && (
        <div className="border border-red-800 bg-red-950/20 rounded-lg p-4 flex items-center justify-between mb-6">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={loadRepos}
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

        {!error && !loading && visibleRepos.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-16">
            {repos.length === 0
              ? "No repositories yet — create one from New Repository."
              : "No repositories match your search."}
          </div>
        )}

        {!error &&
          !loading &&
          visibleRepos.map((repo) => (
            <RepoRow
              key={repo.fullName}
              repo={repo}
              onDeleteRequest={setDeleteTarget}
              onCommitRequest={setCommitTarget}
            />
          ))}
      </div>

      {deleteTarget && (
        <DeleteModal
          repo={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirmed={handleDeleted}
        />
      )}

      {commitTarget && (
        <CommitModal
          repo={commitTarget}
          onClose={() => setCommitTarget(null)}
          onCommitted={loadRepos}
        />
      )}
    </div>
  );
}

export default My_repositories;
