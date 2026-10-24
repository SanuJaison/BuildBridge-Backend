const express = require("express");
const profile = require("../controllers/providerDashboardController");
const { requireAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

const router = express.Router();

router.use(requireAuth);
router.get("/invitations", profile.myInvitations);
router.post("/invitations/:id/respond", validate(profile.invitationResponseSchema), profile.respondInvitation);

module.exports = router;
