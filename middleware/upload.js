const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const env = require("../config/env");

fs.mkdirSync(env.uploadDir, { recursive: true });

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, env.uploadDir),
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase().slice(0, 10);
    callback(null, `${crypto.randomBytes(20).toString("hex")}${extension}`);
  },
});

function fileFilter(_req, file, callback) {
  if (IMAGE_TYPES.has(file.mimetype) || DOCUMENT_TYPES.has(file.mimetype)) {
    return callback(null, true);
  }
  callback(new Error("Unsupported file type. Upload an image, PDF, document, spreadsheet, zip, or text file."));
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 12 * 1024 * 1024, files: 1 },
});

module.exports = { upload, IMAGE_TYPES, DOCUMENT_TYPES };
