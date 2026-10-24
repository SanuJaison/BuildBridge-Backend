const express = require("express");
const projects = require("../controllers/projectController");

const router = express.Router();

router.get("/", projects.listProjects);
router.get("/:slug", projects.getProject);

module.exports = router;
