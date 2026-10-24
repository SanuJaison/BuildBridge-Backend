const express = require("express");
const uploads = require("../controllers/uploadController");
const { optionalAuth, requireAuth } = require("../middleware/auth");
const { upload } = require("../middleware/upload");

const router = express.Router();

router.post("/", requireAuth, upload.single("file"), uploads.createUpload);
router.get("/:id/file", optionalAuth, uploads.serveUpload);
router.delete("/:id", requireAuth, uploads.deleteUpload);

module.exports = router;
