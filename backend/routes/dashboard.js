const express = require("express");
const store = require("../store/deploymentStore");

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.user || !req.user.accessToken) {
    return res.status(401).json({ success: false, message: "Not logged in" });
  }
  next();
}

// ======================
// GET /api/dashboard
// Returns stat counts + a list of this user's projects/deployments
// ======================
router.get("/", requireAuth, async (req, res) => {
  try {
    // NOTE: assumes req.user.username holds the GitHub login (same value
    // used as "owner" when creating repos via createForAuthenticatedUser).
    // If your auth strategy stores it under a different field, swap it here.
    const owner = req.user.username;

    if (!owner) {
      return res.status(500).json({
        success: false,
        message: "Couldn't resolve the logged-in GitHub username from the session.",
      });
    }

    const records = await store.getForOwner(owner);

    res.json({
      success: true,
      stats: store.computeStats(records),
      deployments: store.toDashboardRows(records),
    });
  } catch (err) {
    console.error("dashboard error:", err.message);
    res.status(500).json({ success: false, message: "Failed to load dashboard data." });
  }
});

// ======================
// DELETE /api/dashboard/:project
// Removes a deployment record from the dashboard only (does NOT delete
// the underlying GitHub repo, Render service, or Vercel project).
// ======================
router.delete("/:project", requireAuth, async (req, res) => {
  const owner = req.user.username;
  const { project } = req.params;

  if (!owner) {
    return res.status(500).json({ success: false, message: "Couldn't resolve the logged-in GitHub username." });
  }

  try {
    const removed = await store.removeRecord(owner, project);
    if (!removed) {
      return res.status(404).json({ success: false, message: "Deployment record not found." });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("dashboard/delete error:", err.message);
    res.status(500).json({ success: false, message: "Failed to remove deployment record." });
  }
});

module.exports = router;