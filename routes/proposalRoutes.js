const express = require("express");
const proposals = require("../controllers/proposalController");
const { requireAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

const router = express.Router();

router.use(requireAuth);

router.put("/:id", validate(proposals.proposalUpdateSchema), proposals.updateProposal);
router.post("/:id/accept", proposals.acceptProposal);
router.post("/:id/decline", proposals.declineProposal);
router.post("/:id/withdraw", proposals.withdrawProposal);

module.exports = router;
