const express = require("express");
const services = require("../controllers/serviceController");

const router = express.Router();

router.get("/", services.listServices);
router.get("/:slug", services.getService);

module.exports = router;
