const fs = require("fs/promises");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "deployments.json");

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, "[]", "utf-8");
  }
}

async function readAll() {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(records) {
  await ensureFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(records, null, 2), "utf-8");
}

function makeId(owner, repo) {
  return `${owner}/${repo}`;
}

async function upsertRecord(owner, repo, patch = {}) {
  const records = await readAll();
  const id = makeId(owner, repo);
  const now = new Date().toISOString();
  const index = records.findIndex((r) => r.id === id);

  const base = index >= 0 ? records[index] : { id, owner, project: repo, provider: "GitHub", status: "pushed", url: null };

  const updated = {
    ...base,
    ...patch,
    id,
    owner,
    project: repo,
    time: now,
  };

  if (index >= 0) {
    records[index] = updated;
  } else {
    records.push(updated);
  }

  await writeAll(records);
  return updated;
}

// used when a repo is deleted from GitHub — clean the dashboard record up too
async function removeRecord(owner, repo) {
  const records = await readAll();
  const id = makeId(owner, repo);
  const filtered = records.filter((r) => r.id !== id);
  await writeAll(filtered);
  return filtered.length !== records.length;
}

async function getForOwner(owner) {
  const records = await readAll();
  return records.filter((r) => r.owner === owner);
}

function computeStats(records) {
  return {
    projects: records.length,
    deployments: records.filter((r) => ["deploying", "live", "failed"].includes(r.status)).length,
    active: records.filter((r) => r.status === "live").length,
    failed: records.filter((r) => r.status === "failed").length,
  };
}

function toDashboardRows(records) {
  return records
    .slice()
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .map((r) => ({
      id: r.id,
      project: r.project,
      provider: r.provider,
      status: r.status,
      time: r.time,
      url: r.url,
    }));
}

module.exports = { upsertRecord, removeRecord, getForOwner, computeStats, toDashboardRows };