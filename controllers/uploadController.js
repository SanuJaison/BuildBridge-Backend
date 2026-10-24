const fs = require("fs");
const path = require("path");
const Upload = require("../models/Upload");
const Inquiry = require("../models/Inquiry");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");
const { IMAGE_TYPES } = require("../middleware/upload");

const IMAGE_PURPOSES = new Set(["avatar", "logo", "cover", "portfolio", "service"]);

function removeFile(filename) {
  if (!filename) return;
  fs.unlink(path.join(env.uploadDir, filename), () => {});
}

async function createUpload(req, res, next) {
  try {
    if (!req.file) throw ApiError.badRequest("Choose a file to upload");
    const purpose = req.body.purpose || "portfolio";
    if (!["avatar", "logo", "cover", "portfolio", "service", "attachment"].includes(purpose)) {
      removeFile(req.file.filename);
      throw ApiError.badRequest("Unknown upload purpose");
    }
    if (IMAGE_PURPOSES.has(purpose) && !IMAGE_TYPES.has(req.file.mimetype)) {
      removeFile(req.file.filename);
      throw ApiError.badRequest("This upload requires a JPEG, PNG, WebP, or GIF image");
    }

    const upload = await Upload.create({
      owner: req.user._id,
      originalName: req.file.originalname,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      purpose,
      isPublic: purpose !== "attachment",
    });

    res.status(201).json({
      upload: {
        ...upload.toJSON(),
        url: `/api/uploads/${upload._id}/file`,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function serveUpload(req, res, next) {
  try {
    const upload = await Upload.findById(req.params.id);
    if (!upload) throw ApiError.notFound("File not found");

    if (!upload.isPublic) {
      if (!req.user) throw ApiError.unauthorized("Sign in to access this attachment");
      let allowed = req.user.role === "admin" || String(upload.owner) === String(req.user._id);
      if (!allowed && upload.purpose === "attachment") {
        const linked = await Inquiry.exists({
          "attachments.upload": upload._id,
          $or: [{ customer: req.user._id }, { providerUser: req.user._id }],
        });
        allowed = Boolean(linked);
      }
      if (!allowed) throw ApiError.forbidden("You do not have access to this file");
      res.setHeader("Cache-Control", "private, max-age=300");
    } else {
      res.setHeader("Cache-Control", "public, max-age=86400");
    }

    const absolutePath = path.join(env.uploadDir, upload.storedName);
    if (!fs.existsSync(absolutePath)) throw ApiError.notFound("The stored file is no longer available");
    res.setHeader("Content-Type", upload.mimeType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Disposition",
      `${IMAGE_TYPES.has(upload.mimeType) ? "inline" : "attachment"}; filename="${encodeURIComponent(upload.originalName)}"`
    );
    res.sendFile(absolutePath);
  } catch (error) {
    next(error);
  }
}

async function deleteUpload(req, res, next) {
  try {
    const upload = await Upload.findOne({ _id: req.params.id, owner: req.user._id });
    if (!upload) throw ApiError.notFound("Upload not found");
    removeFile(upload.storedName);
    await upload.deleteOne();
    res.json({ message: "File removed" });
  } catch (error) {
    next(error);
  }
}

module.exports = { createUpload, serveUpload, deleteUpload };
