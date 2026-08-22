const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "user_tokens.db");

// A user's Vercel/Railway/etc. token is a live credential to their real
// hosting account — meaningfully more sensitive than what's in the flat
// deployments.json store, so this lives in its own encrypted-at-rest file
// instead. Set TOKEN_ENCRYPTION_KEY to a 64-char hex string (or a base64
// string that decodes to exactly 32 bytes), e.g.:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  console.warn(
    "[userTokensStore] TOKEN_ENCRYPTION_KEY is not set — connected-account " +
      "tokens cannot be stored until this is configured."
  );
}

function getKeyBuffer() {
  if (!ENCRYPTION_KEY) {
    throw new Error("TOKEN_ENCRYPTION_KEY is not configured on the server.");
  }
  if (/^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY)) {
    return Buffer.from(ENCRYPTION_KEY, "hex");
  }
  const buf = Buffer.from(ENCRYPTION_KEY, "base64");
  if (buf.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (a 64-char hex string, or base64).");
  }
  return buf;
}

function encrypt(plaintext) {
  const key = getKeyBuffer();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // iv + authTag + ciphertext, all in one base64 blob per row
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

function decrypt(payload) {
  const key = getKeyBuffer();
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf-8");
}

let db;
function getDb() {
  if (db) return db;
  const fs = require("fs");
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_provider_tokens (
      username TEXT NOT NULL,
      provider TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      account_label TEXT,
      expires_at INTEGER,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (username, provider)
    );
  `);
  return db;
}

// username: the DeployX (GitHub) username the tokens belong to
// provider: e.g. "vercel"
function saveTokens(username, provider, { accessToken, refreshToken = null, expiresAt = null, accountLabel = null }) {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO user_provider_tokens (username, provider, access_token, refresh_token, account_label, expires_at, updated_at)
       VALUES (@username, @provider, @accessToken, @refreshToken, @accountLabel, @expiresAt, @updatedAt)
       ON CONFLICT(username, provider) DO UPDATE SET
         access_token = excluded.access_token,
         refresh_token = COALESCE(excluded.refresh_token, user_provider_tokens.refresh_token),
         account_label = excluded.account_label,
         expires_at = excluded.expires_at,
         updated_at = excluded.updated_at`
    )
    .run({
      username,
      provider,
      accessToken: encrypt(accessToken),
      refreshToken: refreshToken ? encrypt(refreshToken) : null,
      accountLabel,
      expiresAt,
      updatedAt: new Date().toISOString(),
    });
}

function getTokens(username, provider) {
  const database = getDb();
  const row = database
    .prepare(`SELECT * FROM user_provider_tokens WHERE username = ? AND provider = ?`)
    .get(username, provider);
  if (!row) return null;
  return {
    accessToken: decrypt(row.access_token),
    refreshToken: row.refresh_token ? decrypt(row.refresh_token) : null,
    accountLabel: row.account_label,
    expiresAt: row.expires_at,
    updatedAt: row.updated_at,
  };
}

function deleteTokens(username, provider) {
  const database = getDb();
  database.prepare(`DELETE FROM user_provider_tokens WHERE username = ? AND provider = ?`).run(username, provider);
}

function listConnectedProviders(username) {
  const database = getDb();
  return database
    .prepare(`SELECT provider, account_label, updated_at FROM user_provider_tokens WHERE username = ?`)
    .all(username)
    .map((r) => ({ provider: r.provider, accountLabel: r.account_label, updatedAt: r.updated_at }));
}

module.exports = { saveTokens, getTokens, deleteTokens, listConnectedProviders };