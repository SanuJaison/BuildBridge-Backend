const express = require("express");
const favorites = require("../controllers/favoriteController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);
router.get("/", favorites.listFavorites);
router.post("/:providerId", favorites.addFavorite);
router.delete("/:providerId", favorites.removeFavorite);

module.exports = router;
