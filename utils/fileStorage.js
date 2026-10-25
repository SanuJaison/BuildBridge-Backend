const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const env = require("../config/env");
const cloudinary = require("../config/cloudinary");

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const CDN_TRANSFORMATION = "c_limit,w_2400/q_auto,f_auto";

function usesCloudinary() {
  return env.uploadDriver === "cloudinary";
}

function extensionFor(fileName, mimetype) {
  const fromName = path.extname(fileName || "").toLowerCase().slice(0, 12);
  if (fromName) return fromName.replace(".", "");
  const byMime = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "application/pdf": "pdf",
    "application/zip": "zip",
    "text/plain": "txt",
  };
  return byMime[mimetype] || "bin";
}

function uploadToCloudinary(file, purpose) {
  return new Promise((resolve, reject) => {
    const privateFile = purpose === "attachment";
    const resourceType = IMAGE_TYPES.has(file.mimetype) ? "image" : "raw";
    const publicId = crypto.randomBytes(20).toString("hex");

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${env.cloudinaryFolder}/${purpose}`,
        resource_type: resourceType,
        type: privateFile ? "private" : "upload",
        public_id: publicId,
        use_filename: false,
        unique_filename: false,
        overwrite: false,
        invalidate: true,
      },
      (error, result) => {
        if (error) return reject(error);
        const isImage = resourceType === "image";
        const deliveryUrl = isImage
          ? result.secure_url.replace("/image/upload/", `/image/upload/${CDN_TRANSFORMATION}/`)
          : result.secure_url;
        return resolve({
          storage: "cloudinary",
          storedName: `${publicId}.${extensionFor(file.originalname, file.mimetype)}`,
          publicId: result.public_id,
          resourceType: result.resource_type || resourceType,
          deliveryType: privateFile ? "private" : "upload",
          format: result.format || extensionFor(file.originalname, file.mimetype),
          url: privateFile ? "" : deliveryUrl,
          bytes: result.bytes || file.size,
        });
      }
    );
    stream.end(file.buffer);
  });
}

function uploadToLocal(file) {
  fs.mkdirSync(env.uploadDir, { recursive: true });
  const extension = path.extname(file.originalname).toLowerCase().slice(0, 12);
  const storedName = `${crypto.randomBytes(20).toString("hex")}${extension}`;
  fs.writeFileSync(path.join(env.uploadDir, storedName), file.buffer);
  return {
    storage: "local",
    storedName,
    publicId: "",
    resourceType: "",
    deliveryType: "",
    format: extensionFor(file.originalname, file.mimetype),
    url: "",
    bytes: file.size,
  };
}

let warnedAboutCloudinary = false;

async function storeFile(file, purpose) {
  if (!usesCloudinary()) return uploadToLocal(file);
  try {
    return await uploadToCloudinary(file, purpose);
  } catch (error) {
    const status = Number(error?.http_code || error?.error?.http_code || error?.statusCode || 0);
    const detail = `${error?.message || ""} ${error?.error?.message || ""} ${error?.error?.name || ""}`;
    const credentialIssue =
      status === 401 || status === 403 || /signature|api_secret|cloud_name|api_key|credentials/i.test(detail);
    if (!credentialIssue || env.uploadStrict) throw error;
    if (!warnedAboutCloudinary) {
      warnedAboutCloudinary = true;
      console.warn(
        "Cloudinary rejected the configured credentials. Uploads are temporarily stored on local disk. Check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
      );
    }
    return uploadToLocal(file);
  }
}

async function removeStoredFile(upload) {
  if (upload.storage === "cloudinary" && upload.publicId) {
    await cloudinary.uploader
      .destroy(upload.publicId, {
        resource_type: upload.resourceType || "image",
        type: upload.deliveryType || "upload",
        invalidate: true,
      })
      .catch(() => {});
    return;
  }
  if (upload.storedName) {
    fs.unlink(path.join(env.uploadDir, upload.storedName), () => {});
  }
}

function signedDownloadUrl(upload) {
  return cloudinary.utils.private_download_url(upload.publicId, upload.format || "", {
    resource_type: upload.resourceType || "raw",
    type: upload.deliveryType || "private",
    attachment: true,
    expires_at: Math.floor(Date.now() / 1000) + 10 * 60,
  });
}

module.exports = {
  IMAGE_TYPES,
  usesCloudinary,
  storeFile,
  removeStoredFile,
  signedDownloadUrl,
};
