const express = require("express");
const marketplace = require("../controllers/marketplaceController");

const router = express.Router();

router.get("/home", marketplace.home);
router.get("/search", marketplace.search);

module.exports = router;
