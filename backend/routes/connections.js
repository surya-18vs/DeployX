const express = require("express");
const axios = require("axios");
const tokenStore = require("../store/userTokensStore");

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.user || !req.user.username) {
    return res.status(401).json({ success: false, message: "Not logged in" });
  }
  next();
}

// APP_BASE_URL: the publicly reachable base URL of THIS backend, e.g.
// https://api.yourdomain.com — used to build the redirect_uri and must
// exactly match what's registered in the Vercel Integration Console.
const APP_BASE_URL = process.env.APP_BASE_URL;
const FRONTEND_URL = process.env.FRONTEND_URL || "/";

const VERCEL_CLIENT_ID = process.env.VERCEL_CLIENT_ID;
const VERCEL_CLIENT_SECRET = process.env.VERCEL_CLIENT_SECRET;
const VERCEL_TOKEN_URL = "https://api.vercel.com/v2/oauth/access_token";

// The "Add Integration" URL Vercel gives you once the integration exists
// (Integration Console -> your integration -> this is shown on the page).
// It's specific to the integration you create, so it can't be derived here.
const VERCEL_INSTALL_URL = process.env.VERCEL_INSTALL_URL;

// Only allow redirecting back to a same-app relative path after the OAuth
// round-trip — e.g. "/settings" or "/newrepo". Anything else (a full URL,
// a protocol-relative "//evil.com", etc.) falls back to the app root
// instead, so this can't be turned into an open-redirect vector.
function sanitizeReturnPath(value) {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

// ======================
// GET /api/connections
// Which providers the logged-in user currently has connected.
// ======================
router.get("/", requireAuth, (req, res) => {
  const connections = tokenStore.listConnectedProviders(req.user.username);
  res.json({ success: true, connections });
});

// ======================
// DELETE /api/connections/:provider
// ======================
router.delete("/:provider", requireAuth, (req, res) => {
  const { provider } = req.params;
  if (provider !== "vercel") {
    return res.status(400).json({ success: false, message: "Unknown provider." });
  }
  tokenStore.deleteTokens(req.user.username, provider);
  res.json({ success: true });
});

// ======================
// GET /api/connections/vercel/install-url?returnTo=/settings
// Frontend calls this to know where to send the "Connect Vercel" button —
// the actual URL lives in env config since it's tied to the integration
// you created in Vercel's console. An optional returnTo is threaded through
// as OAuth "state" so the callback can send the user back to wherever they
// started the connect flow (Settings, New Repository, etc.) instead of
// always landing on the app root.
// ======================
router.get("/vercel/install-url", requireAuth, (req, res) => {
  if (!VERCEL_INSTALL_URL) {
    return res.status(500).json({ success: false, message: "VERCEL_INSTALL_URL is not configured on the server." });
  }
  const returnTo = sanitizeReturnPath(req.query.returnTo);
  const url = new URL(VERCEL_INSTALL_URL);
  url.searchParams.set("state", returnTo);
  res.json({ success: true, url: url.toString() });
});

// ======================
// GET /api/connections/vercel/callback
// Vercel redirects here after the user approves installing the integration
// on their own account/team.
// ======================
router.get("/vercel/callback", requireAuth, async (req, res) => {
  const { code, teamId, state } = req.query;
  if (!code) {
    return res.status(400).send("Missing code from Vercel.");
  }
  if (!VERCEL_CLIENT_ID || !VERCEL_CLIENT_SECRET || !APP_BASE_URL) {
    return res.status(500).send("Vercel integration is not configured on the server.");
  }

  const returnTo = sanitizeReturnPath(state);

  try {
    const { data } = await axios.post(
      VERCEL_TOKEN_URL,
      new URLSearchParams({
        client_id: VERCEL_CLIENT_ID,
        client_secret: VERCEL_CLIENT_SECRET,
        code,
        redirect_uri: `${APP_BASE_URL}/api/connections/vercel/callback`,
      }),
      { headers: { "content-type": "application/x-www-form-urlencoded" } }
    );

    tokenStore.saveTokens(req.user.username, "vercel", {
      accessToken: data.access_token,
      accountLabel: teamId ? `team:${teamId}` : "personal",
    });

    res.redirect(`${FRONTEND_URL}${returnTo}?connected=vercel`);
  } catch (err) {
    console.error("connections/vercel/callback error:", err.response?.data || err.message);
    res.status(500).send("Failed to complete the Vercel connection. You can close this tab and try again.");
  }
});

module.exports = router;