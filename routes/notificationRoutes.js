const express = require("express");
const notifications = require("../controllers/notificationController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);
router.get("/", notifications.listNotifications);
router.patch("/:id/read", notifications.markRead);
router.post("/read-all", notifications.markAllRead);

module.exports = router;
