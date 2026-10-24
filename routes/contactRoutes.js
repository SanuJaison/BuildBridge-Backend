const express = require("express");
const reports = require("../controllers/reportController");
const { validate } = require("../middleware/validate");
const { publicFormLimiter } = require("../middleware/rateLimits");

const router = express.Router();

router.post("/", publicFormLimiter, validate(reports.contactSchema), reports.submitContact);

module.exports = router;
