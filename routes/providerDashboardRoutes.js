const express = require("express");
const profile = require("../controllers/providerDashboardController");
const services = require("../controllers/providerServiceController");
const projects = require("../controllers/providerPortfolioController");
const { requireAuth, requireProvider } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { writeLimiter } = require("../middleware/rateLimits");

const router = express.Router();

router.use(requireAuth);

router.get("/profile", requireProvider, profile.getMyProfile);
router.put(
  "/profile",
  requireProvider,
  writeLimiter,
  validate(profile.profileSchema),
  profile.updateMyProfile
);
router.post("/publish", requireProvider, profile.publishMyProfile);
router.get("/overview", requireProvider, profile.overview);

router.get("/organization", requireProvider, profile.getMyOrganization);
router.put(
  "/organization",
  requireProvider,
  writeLimiter,
  validate(profile.organizationSchema),
  profile.updateMyOrganization
);
router.post(
  "/members",
  requireProvider,
  writeLimiter,
  validate(profile.inviteSchema),
  profile.inviteMember
);
router.patch(
  "/members/:memberId",
  requireProvider,
  validate(profile.memberSchema),
  profile.updateMember
);
router.delete("/members/:memberId", requireProvider, profile.removeMember);

router.get("/services", requireProvider, services.myServices);
router.post("/services", requireProvider, validate(services.serviceSchema), services.createService);
router.put(
  "/services/:id",
  requireProvider,
  validate(services.serviceUpdateSchema),
  services.updateService
);
router.delete("/services/:id", requireProvider, services.deleteService);

router.get("/portfolio", requireProvider, projects.myProjects);
router.post("/portfolio", requireProvider, validate(projects.projectSchema), projects.createProject);
router.put(
  "/portfolio/:id",
  requireProvider,
  validate(projects.projectUpdateSchema),
  projects.updateProject
);
router.delete("/portfolio/:id", requireProvider, projects.deleteProject);

module.exports = router;
