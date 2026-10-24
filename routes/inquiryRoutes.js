const express = require("express");
const inquiries = require("../controllers/inquiryController");
const proposals = require("../controllers/proposalController");
const { requireAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { writeLimiter } = require("../middleware/rateLimits");

const router = express.Router();

router.use(requireAuth);

router.get("/", inquiries.listInquiries);
router.post("/", writeLimiter, validate(inquiries.inquirySchema), inquiries.createInquiry);
router.get("/:id", inquiries.getInquiry);
router.patch("/:id/status", validate(inquiries.statusSchema), inquiries.updateStatus);
router.post("/:id/conversation", inquiries.startConversation);
router.post("/:id/proposals", validate(proposals.proposalSchema), proposals.createOrResendProposal);

module.exports = router;
