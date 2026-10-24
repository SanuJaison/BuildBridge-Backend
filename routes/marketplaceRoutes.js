const express = require("express");
const marketplace = require("../controllers/marketplaceController");

const router = express.Router();

router.get("/home", marketplace.home);

module.exports = router;
