const express = require("express");
const settings = require("../controllers/settingsController");

const router = express.Router();

router.get("/public", settings.publicSettings);

module.exports = router;
