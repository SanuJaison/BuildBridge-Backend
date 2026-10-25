const path = require("path");

require("dotenv").config();

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

if (!process.env.MONGODB_URL) {
  throw new Error("MONGODB_URL is required. Copy .env.example to .env and configure it.");
}
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required. Generate a strong random value for local development.");
}

const nodeEnv = process.env.NODE_ENV || "development";
const port = toNumber(process.env.PORT, 3000);

const requestedUploadDriver = String(process.env.UPLOAD_DRIVER || "auto").toLowerCase();
const hasCloudinaryCredentials = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
);
const uploadDriver =
  requestedUploadDriver === "cloudinary"
    ? "cloudinary"
    : requestedUploadDriver === "local"
      ? "local"
      : hasCloudinaryCredentials
        ? "cloudinary"
        : "local";

module.exports = {
  nodeEnv,
  isProduction: nodeEnv === "production",
  isTest: nodeEnv === "test",
  port,
  mongoUri: process.env.MONGODB_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  clientUrls: (process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean),
  publicUrl: (process.env.PUBLIC_URL || `http://localhost:${port}`).replace(/\/$/, ""),
  uploadDir: path.join(__dirname, "..", "uploads"),
  publicDir: path.join(__dirname, "..", "public", "static"),
  cookieName: "bb_token",
  uploadDriver,
  uploadStrict: requestedUploadDriver === "cloudinary",
  cloudinaryFolder: process.env.CLOUDINARY_FOLDER || "buildbridge",
};
