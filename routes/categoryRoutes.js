const express = require("express");
const categories = require("../controllers/categoryController");

const router = express.Router();

router.get("/", categories.listCategories);
router.get("/:slug", categories.getCategory);

module.exports = router;
