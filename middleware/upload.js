const multer = require("multer");
const ApiError = require("../utils/ApiError");
const { IMAGE_TYPES } = require("../utils/fileStorage");

const DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

function fileFilter(_req, file, callback) {
  if (IMAGE_TYPES.has(file.mimetype) || DOCUMENT_TYPES.has(file.mimetype)) {
    return callback(null, true);
  }
  return callback(
    ApiError.badRequest("Unsupported file type. Upload an image, PDF, document, spreadsheet, zip, or text file.")
  );
}

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 12 * 1024 * 1024, files: 1 },
});

module.exports = { upload, IMAGE_TYPES, DOCUMENT_TYPES };
