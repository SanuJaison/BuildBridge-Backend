const express = require("express");
const reports = require("../controllers/reportController");
const { requireAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { publicFormLimiter } = require("../middleware/rateLimits");

const router = express.Router();

router.post("/", requireAuth, publicFormLimiter, validate(reports.reportSchema), reports.createReport);

module.exports = router;
