const express = require("express");
const { Octokit } = require("@octokit/rest");
const store = require("../store/deploymentStore");

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.user || !req.user.accessToken) {
    return res.status(401).json({ success: false, message: "Not logged in" });
  }
  next();
}

function getOctokit(req) {
  return new Octokit({ auth: req.user.accessToken });
}

// ======================
// Lightweight language detector, used as a fallback for /list.
// GitHub's own `language` field (from Linguist) is null for a while right
// after a repo is created/pushed to — this fills that gap immediately by
// counting file extensions from what we just pushed. Not meant to replace
// Linguist's accuracy, just to avoid showing "—" on a freshly created repo.
// ======================
const EXTENSION_LANGUAGE_MAP = {
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".py": "Python",
  ".html": "HTML",
  ".htm": "HTML",
  ".css": "CSS",
  ".scss": "CSS",
  ".java": "Java",
  ".go": "Go",
  ".rs": "Rust",
  ".sh": "Shell",
  ".rb": "Ruby",
  ".php": "PHP",
};

// files that exist in most projects regardless of language — skip these so
// e.g. a lockfile or config doesn't skew the count
const SKIP_FOR_LANGUAGE_DETECTION = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/;

function extnameOf(filePath) {
  const base = filePath.split("/").pop() || "";
  const dotIndex = base.lastIndexOf(".");
  return dotIndex > 0 ? base.slice(dotIndex).toLowerCase() : "";
}

function detectPrimaryLanguage(files) {
  const counts = {};

  for (const file of files) {
    if (!file.path || SKIP_FOR_LANGUAGE_DETECTION.test(file.path)) continue;
    const lang = EXTENSION_LANGUAGE_MAP[extnameOf(file.path)];
    if (!lang) continue;
    counts[lang] = (counts[lang] || 0) + 1;
  }

  let best = null;
  let bestCount = 0;
  for (const [lang, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = lang;
      bestCount = count;
    }
  }
  return best;
}

// ======================
// Shared helper: push a set of files onto a branch as a single commit.
// Used by both /push (new repo, first commit) and /commit (existing repo,
// later commits) so the blob/tree/commit logic only lives in one place.
// ======================
async function pushFilesToRepo(octokit, { owner, repo, branch, files, message }) {
  const targetBranch = branch || "main";

  const { data: refData } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${targetBranch}`,
  });
  const baseCommitSha = refData.object.sha;

  const { data: baseCommit } = await octokit.rest.git.getCommit({
    owner,
    repo,
    commit_sha: baseCommitSha,
  });
  const baseTreeSha = baseCommit.tree.sha;

  const blobs = [];
  for (const file of files) {
    if (!file.path || typeof file.content !== "string") continue;
    const { data: blob } = await octokit.rest.git.createBlob({
      owner,
      repo,
      content: file.content,
      encoding: "base64",
    });
    blobs.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
  }

  if (blobs.length === 0) {
    const err = new Error("No valid files to push.");
    err.status = 400;
    throw err;
  }

  const { data: newTree } = await octokit.rest.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: blobs,
  });

  const { data: newCommit } = await octokit.rest.git.createCommit({
    owner,
    repo,
    message: message || "Upload project files via DeployX",
    tree: newTree.sha,
    parents: [baseCommitSha],
  });

  await octokit.rest.git.updateRef({
    owner,
    repo,
    ref: `heads/${targetBranch}`,
    sha: newCommit.sha,
  });

  return { filesPushed: blobs.length, commitSha: newCommit.sha, commitUrl: newCommit.html_url };
}

// ======================
// GET /api/repo/check-name?name=my-project
// ======================
router.get("/check-name", requireAuth, async (req, res) => {
  const { name } = req.query;

  if (!name || !/^[a-zA-Z0-9._-]+$/.test(name)) {
    return res.status(400).json({
      success: false,
      message: "Invalid repo name. Use letters, numbers, dashes, dots, underscores only.",
    });
  }

  try {
    const octokit = getOctokit(req);
    const { data: me } = await octokit.rest.users.getAuthenticated();

    try {
      await octokit.rest.repos.get({ owner: me.login, repo: name });
      return res.json({ success: true, available: false });
    } catch (err) {
      if (err.status === 404) {
        return res.json({ success: true, available: true });
      }
      throw err;
    }
  } catch (err) {
    console.error("repo/check-name error:", err.message);
    res.status(500).json({ success: false, message: "Failed to check name availability." });
  }
});

// ======================
// GET /api/repo/list
// Returns every repo owned by the authenticated user, with GitHub-style stats
// ======================
router.get("/list", requireAuth, async (req, res) => {
  try {
    const octokit = getOctokit(req);
    const { data: me } = await octokit.rest.users.getAuthenticated();

    const [repos, storedRecords] = await Promise.all([
      octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
        affiliation: "owner",
        sort: "updated",
        per_page: 100,
      }),
      store.getForOwner(me.login),
    ]);

    // GitHub's Linguist can take a while to populate `language` on a repo
    // right after it's created/pushed to, so fall back to whatever we
    // detected ourselves at push time (stored alongside the record).
    const languageByProject = new Map(
      storedRecords.filter((r) => r.language).map((r) => [r.project, r.language])
    );

    res.json({
      success: true,
      repos: repos.map((r) => ({
        name: r.name,
        owner: r.owner.login,
        fullName: r.full_name,
        description: r.description,
        htmlUrl: r.html_url,
        cloneUrl: r.clone_url,
        defaultBranch: r.default_branch,
        private: r.private,
        language: r.language || languageByProject.get(r.name) || null,
        stars: r.stargazers_count,
        forks: r.forks_count,
        openIssues: r.open_issues_count,
        updatedAt: r.updated_at,
        pushedAt: r.pushed_at,
      })),
    });
  } catch (err) {
    console.error("repo/list error:", err.message);
    res.status(500).json({ success: false, message: "Failed to load repositories." });
  }
});

// ======================
// GET /api/repo/recent-commits
// Pulls recent commit activity across the user's most recently updated
// repos. Capped to keep this fast and avoid hammering the GitHub API.
// ======================
router.get("/recent-commits", requireAuth, async (req, res) => {
  const MAX_REPOS = 8;
  const COMMITS_PER_REPO = 5;

  try {
    const octokit = getOctokit(req);
    const repos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
      affiliation: "owner",
      sort: "pushed",
      per_page: MAX_REPOS,
    });

    const limitedRepos = repos.slice(0, MAX_REPOS);

    const results = await Promise.all(
      limitedRepos.map(async (repo) => {
        try {
          const { data: commits } = await octokit.rest.repos.listCommits({
            owner: repo.owner.login,
            repo: repo.name,
            per_page: COMMITS_PER_REPO,
          });
          return commits.map((c) => ({
            type: "commit",
            repo: repo.name,
            owner: repo.owner.login,
            sha: c.sha.slice(0, 7),
            message: c.commit.message.split("\n")[0],
            author: c.commit.author?.name || repo.owner.login,
            time: c.commit.author?.date || c.commit.committer?.date,
            url: c.html_url,
          }));
        } catch {
          // empty repo (no commits yet) or a transient error — skip it, don't fail the whole request
          return [];
        }
      })
    );

    const commits = results.flat().sort((a, b) => new Date(b.time) - new Date(a.time));

    res.json({ success: true, commits });
  } catch (err) {
    console.error("repo/recent-commits error:", err.message);
    res.status(500).json({ success: false, message: "Failed to load recent commit activity." });
  }
});

// ======================
// POST /api/repo/create
// ======================
router.post("/create", requireAuth, async (req, res) => {
  const { name, private: isPrivate = false, description = "" } = req.body;

  if (!name || !/^[a-zA-Z0-9._-]+$/.test(name)) {
    return res.status(400).json({
      success: false,
      message: "Invalid repo name. Use letters, numbers, dashes, dots, underscores only.",
    });
  }

  try {
    const octokit = getOctokit(req);
    const { data } = await octokit.rest.repos.createForAuthenticatedUser({
      name,
      private: isPrivate,
      description,
      auto_init: true,
    });

    const [owner, repo] = data.full_name.split("/");

    await store.upsertRecord(owner, repo, {
      provider: "GitHub",
      status: "pushed",
      url: data.html_url,
    });

    res.json({
      success: true,
      repo: {
        name: data.name,
        full_name: data.full_name,
        html_url: data.html_url,
        clone_url: data.clone_url,
        default_branch: data.default_branch,
      },
    });
  } catch (err) {
    if (err.status === 422) {
      return res.status(409).json({
        success: false,
        message: "A repo with that name already exists on your account.",
      });
    }
    console.error("repo/create error:", err.message);
    res.status(500).json({ success: false, message: "Failed to create repo." });
  }
});

// ======================
// POST /api/repo/push
// body: { owner, repo, branch, files }
// First commit for a freshly created repo (used by the New Repository flow)
// ======================
router.post("/push", requireAuth, async (req, res) => {
  const { owner, repo, branch, files } = req.body;

  if (!owner || !repo || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({
      success: false,
      message: "owner, repo, and a non-empty files array are required.",
    });
  }

  try {
    const octokit = getOctokit(req);
    const result = await pushFilesToRepo(octokit, {
      owner,
      repo,
      branch,
      files,
      message: "Upload project files via DeployX",
    });

    const detectedLanguage = detectPrimaryLanguage(files);
    await store.upsertRecord(owner, repo, {
      provider: "GitHub",
      status: "pushed",
      ...(detectedLanguage ? { language: detectedLanguage } : {}),
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error("repo/push error:", err.message);
    res.status(err.status === 400 ? 400 : 500).json({
      success: false,
      message: err.status === 400 ? err.message : "Failed to push files to repo.",
    });
  }
});

// ======================
// POST /api/repo/commit
// body: { owner, repo, branch, message, files }
// Commits changes to an EXISTING repo (used by My Repositories -> Commit changes)
// ======================
router.post("/commit", requireAuth, async (req, res) => {
  const { owner, repo, branch, message, files } = req.body;

  if (!owner || !repo || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({
      success: false,
      message: "owner, repo, and a non-empty files array are required.",
    });
  }

  try {
    const octokit = getOctokit(req);
    const result = await pushFilesToRepo(octokit, {
      owner,
      repo,
      branch,
      files,
      message: message && message.trim() ? message.trim() : "Update via DeployX",
    });

    const detectedLanguage = detectPrimaryLanguage(files);
    await store.upsertRecord(owner, repo, {
      provider: "GitHub",
      ...(detectedLanguage ? { language: detectedLanguage } : {}),
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error("repo/commit error:", err.message);
    res.status(err.status === 400 ? 400 : 500).json({
      success: false,
      message: err.status === 400 ? err.message : "Failed to commit changes.",
    });
  }
});

// ======================
// DELETE /api/repo/:owner/:repo
// Deletes the repo from GitHub and removes its dashboard record
// ======================
router.delete("/:owner/:repo", requireAuth, async (req, res) => {
  const { owner, repo } = req.params;

  try {
    const octokit = getOctokit(req);
    await octokit.rest.repos.delete({ owner, repo });
    await store.removeRecord(owner, repo);

    res.json({ success: true });
  } catch (err) {
    console.error("repo/delete error:", {
      status: err.status,
      message: err.message,
      githubMessage: err.response?.data?.message,
      documentation: err.response?.data?.documentation_url,
    });

    if (err.status === 404) {
      return res.status(404).json({ success: false, message: "Repository not found." });
    }
    if (err.status === 403) {
      return res.status(403).json({
        success: false,
        message:
          err.response?.data?.message ||
          "GitHub refused the delete — your token may be missing the 'delete_repo' scope.",
      });
    }
    res.status(500).json({ success: false, message: "Failed to delete repository." });
  }
});

// ======================
// POST /api/repo/readme-patch
// ======================
router.post("/readme-patch", requireAuth, async (req, res) => {
  const { owner, repo, branch, deployedUrl } = req.body;
  if (!owner || !repo || !deployedUrl) {
    return res.status(400).json({ success: false, message: "owner, repo, and deployedUrl are required." });
  }

  const octokit = getOctokit(req);
  const targetBranch = branch || "main";
  const marker = "## Live Deployment";

  try {
    let existingContent = "";
    let sha;
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: "README.md",
        ref: targetBranch,
      });
      existingContent = Buffer.from(data.content, "base64").toString("utf-8");
      sha = data.sha;
    } catch (err) {
      if (err.status !== 404) throw err;
    }

    const deploymentBlock = `${marker}\n\nDeployed at: ${deployedUrl}\n`;

    let updatedContent;
    if (existingContent.includes(marker)) {
      // already patched before (e.g. redeploy) — just refresh the URL in place
      updatedContent = existingContent.replace(
        new RegExp(`${marker}[\\s\\S]*?(?=\\n## |$)`),
        deploymentBlock
      );
    } else if (existingContent.trim()) {
      // insert right after the title line (first "# ..." heading) rather
      // than at the bottom — the deployed link reads better right under
      // the project name than buried after everything else
      const lines = existingContent.split("\n");
      const titleIndex = lines.findIndex((line) => /^#\s+/.test(line));

      if (titleIndex === -1) {
        updatedContent = `${deploymentBlock}\n${existingContent}`;
      } else {
        const before = lines.slice(0, titleIndex + 1).join("\n");
        const after = lines.slice(titleIndex + 1).join("\n");
        updatedContent = `${before}\n\n${deploymentBlock}${after}`;
      }
    } else {
      updatedContent = `${deploymentBlock}\n`;
    }

    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: "README.md",
      message: "Update README with live deployment link",
      content: Buffer.from(updatedContent, "utf-8").toString("base64"),
      branch: targetBranch,
      sha,
    });

    await store.upsertRecord(owner, repo, {
      provider: "GitHub + Render",
      status: "live",
      url: deployedUrl,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("repo/readme-patch error:", err.message);
    res.status(500).json({ success: false, message: "Failed to update README." });
  }
});

module.exports = router;