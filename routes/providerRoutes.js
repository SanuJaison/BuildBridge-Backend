const express = require("express");
const providers = require("../controllers/providerController");
const { optionalAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", providers.listProviders);
router.get("/featured", providers.listFeaturedProviders);
router.get("/:slug", optionalAuth, providers.getProvider);
router.post("/:slug/view", providers.recordProviderView);

module.exports = router;
