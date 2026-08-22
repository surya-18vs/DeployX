const express = require("express");
const cors = require("cors");
const session = require("express-session");
const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
require("dotenv").config();

const repoRoutes = require("./routes/repo");
const deployRoutes = require("./routes/deploy");
const dashboardRoutes = require("./routes/dashboard");
const connectionsRoutes = require("./routes/connections");

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const CLIENT_URL = process.env.CLIENT_URL || process.env.FRONTEND_URL || "http://localhost:5173";

const CALLBACK_URL =
  process.env.GITHUB_CALLBACK_URL ||
  `${process.env.APP_BASE_URL || `http://localhost:${PORT}`}/auth/github/callback`;

if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
  console.error(
    "GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in backend/.env."
  );
}
if (!process.env.SESSION_SECRET) {
  console.warn(
    "SESSION_SECRET is not set — using an insecure default. Set a real random secret in backend/.env before deploying."
  );
}

// ======================
// Middleware
// ======================
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);

// Folder uploads are sent as base64 JSON — bump the limit up from Express's 100kb default
app.use(express.json({ limit: "50mb" }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev_only_insecure_secret_change_me",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

// ======================
// Passport
// ======================
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: CALLBACK_URL,
    },
    (accessToken, refreshToken, profile, done) => {
      profile.accessToken = accessToken;
      return done(null, profile);
    }
  )
);

// ======================
// Routes
// ======================

app.get("/", (req, res) => {
  res.send("DeployX Backend Running 🚀");
});

// Login Route — "repo" is required to create/push repos, "delete_repo" to allow deleting them from the app
app.get(
  "/auth/github",
  passport.authenticate("github", {
    scope: ["user:email", "repo", "delete_repo"],
  })
);

// Callback Route
app.get(
  "/auth/github/callback",
  passport.authenticate("github", {
    failureRedirect: `${CLIENT_URL}/?error=github_oauth_failed`,
  }),
  (req, res) => {
    res.redirect(`${CLIENT_URL}/dashboard`);
  }
);

// Logged-in user
app.get("/user", (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Not logged in",
    });
  }

  res.json({
    success: true,
    user: {
      username: req.user.username,
      displayName: req.user.displayName,
      avatar: req.user.photos?.[0]?.value,
      accessToken: req.user.accessToken,
    },
  });
});

// Logout
app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return res.status(500).json(err);
    }
    res.redirect(CLIENT_URL);
  });
});

// Login Failed
app.get("/login-failed", (req, res) => {
  res.status(401).send("GitHub Login Failed");
});

// New feature routes
app.use("/api/repo", repoRoutes);
app.use("/api/deploy", deployRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/connections", connectionsRoutes);

// ======================
// 404 handler for unmatched /api/* routes
//
// Without this, a missing or unmounted route falls through to Express's
// default 404 page, which is HTML ("Cannot GET /api/...") — the frontend
// then tries to res.json() that HTML and fails with a confusing
// "Unexpected token '<'... is not valid JSON" error that points nowhere
// near the actual problem. This turns that into a clear, correctly-shaped
// JSON 404 so the real cause (route not mounted, wrong path, etc.) is
// obvious immediately instead of masquerading as a JSON-parsing bug.
// ======================
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: `No API route matches ${req.method} ${req.originalUrl}.`,
  });
});

// ======================
// Error Handler
// ======================
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send(err.message);
});

// ======================
// Start Server
// ======================
app.listen(PORT, () => {
  console.log(`🚀 DeployX backend running on port ${PORT}`);
});