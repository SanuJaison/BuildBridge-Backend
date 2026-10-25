const fs = require("fs");
const path = require("path");
const Upload = require("../models/Upload");
const Inquiry = require("../models/Inquiry");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");
const { IMAGE_TYPES } = require("../middleware/upload");
const { storeFile, removeStoredFile, signedDownloadUrl } = require("../utils/fileStorage");

const IMAGE_PURPOSES = new Set(["avatar", "logo", "cover", "portfolio", "service"]);
const ALLOWED_PURPOSES = new Set([...IMAGE_PURPOSES, "attachment"]);

async function createUpload(req, res, next) {
  let stored;
  try {
    if (!req.file) throw ApiError.badRequest("Choose a file to upload");
    const purpose = req.body.purpose || "portfolio";
    if (!ALLOWED_PURPOSES.has(purpose)) throw ApiError.badRequest("Unknown upload purpose");
    if (IMAGE_PURPOSES.has(purpose) && !IMAGE_TYPES.has(req.file.mimetype)) {
      throw ApiError.badRequest("This upload requires a JPEG, PNG, WebP, or GIF image");
    }

    stored = await storeFile(req.file, purpose);
    const isPublic = purpose !== "attachment";
    const upload = await Upload.create({
      owner: req.user._id,
      originalName: req.file.originalname,
      storedName: stored.storedName,
      storage: stored.storage,
      publicId: stored.publicId,
      resourceType: stored.resourceType,
      deliveryType: stored.deliveryType,
      format: stored.format,
      url: stored.url,
      mimeType: req.file.mimetype,
      size: stored.bytes || req.file.size,
      purpose,
      isPublic,
    });

    res.status(201).json({
      upload: {
        ...upload.toJSON(),
        url: upload.storage === "cloudinary" && isPublic ? upload.url : `/api/uploads/${upload._id}/file`,
      },
    });
  } catch (error) {
    if (stored) {
      await removeStoredFile({
        storage: stored.storage,
        publicId: stored.publicId,
        storedName: stored.storedName,
        resourceType: stored.resourceType,
        deliveryType: stored.deliveryType,
      });
    }
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
      res.setHeader("Cache-Control", "private, no-store");
    } else {
      res.setHeader("Cache-Control", "public, max-age=86400");
    }

    if (upload.storage === "cloudinary" && upload.publicId) {
      const target = upload.isPublic ? upload.url : signedDownloadUrl(upload);
      if (!target) throw ApiError.notFound("The stored file is no longer available");
      return res.redirect(302, target);
    }

    res.setHeader("Content-Type", upload.mimeType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Disposition",
      `${IMAGE_TYPES.has(upload.mimeType) ? "inline" : "attachment"}; filename="${encodeURIComponent(upload.originalName)}"`
    );
    const absolutePath = path.join(env.uploadDir, upload.storedName);
    if (!fs.existsSync(absolutePath)) throw ApiError.notFound("The stored file is no longer available");
    return res.sendFile(absolutePath);
  } catch (error) {
    next(error);
  }
}

async function deleteUpload(req, res, next) {
  try {
    const upload = await Upload.findOne({ _id: req.params.id, owner: req.user._id });
    if (!upload) throw ApiError.notFound("Upload not found");
    await removeStoredFile(upload);
    await upload.deleteOne();
    res.json({ message: "File removed" });
  } catch (error) {
    next(error);
  }
}

module.exports = { createUpload, serveUpload, deleteUpload };
