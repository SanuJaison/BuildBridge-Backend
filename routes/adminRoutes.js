const express = require("express");
const admin = require("../controllers/adminController");
const settings = require("../controllers/settingsController");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get("/stats", admin.stats);
router.get("/users", admin.listUsers);
router.get("/users/:id", admin.getUserDetail);
router.patch("/users/:id", validate(admin.userStatusSchema), admin.updateUser);

router.get("/providers", admin.listProviders);
router.patch("/providers/:id", validate(admin.providerAdminSchema), admin.updateProvider);

router.get("/categories", admin.listCategories);
router.post("/categories", validate(admin.categorySchema), admin.createCategory);
router.patch("/categories/:id", validate(admin.categoryUpdateSchema), admin.updateCategory);
router.delete("/categories/:id", admin.deleteCategory);

router.get("/reviews", admin.listReviews);
router.patch("/reviews/:id", validate(admin.reviewModerationSchema), admin.moderateReview);

router.get("/reports", admin.listReports);
router.patch("/reports/:id", validate(admin.reportUpdateSchema), admin.updateReport);

router.get("/messages", admin.listContactMessages);
router.patch("/messages/:id", validate(admin.contactStatusSchema), admin.updateContactMessage);

router.get("/audit-logs", admin.listAuditLogs);

router.get("/settings", settings.adminGetSettings);
router.put("/settings", validate(settings.brandingSchema), settings.adminUpdateSettings);

module.exports = router;
