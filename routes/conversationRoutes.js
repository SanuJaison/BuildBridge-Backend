const express = require("express");
const messages = require("../controllers/conversationController");
const { requireAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { writeLimiter } = require("../middleware/rateLimits");

const router = express.Router();

router.use(requireAuth);

router.get("/", messages.listConversations);
router.get("/:id", messages.getConversation);
router.post("/:id/messages", writeLimiter, validate(messages.messageSchema), messages.sendMessage);

module.exports = router;
