const mongoose = require("mongoose");
const { schemaOptions } = require("./plugins");

const uploadSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    originalName: { type: String, required: true },
    storedName: { type: String, required: true, unique: true },
    storage: { type: String, enum: ["local", "cloudinary"], default: "local" },
    publicId: { type: String, default: "" },
    resourceType: { type: String, default: "" },
    deliveryType: { type: String, default: "" },
    format: { type: String, default: "" },
    url: { type: String, default: "" },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    purpose: {
      type: String,
      enum: ["avatar", "logo", "cover", "portfolio", "service", "attachment"],
      default: "portfolio",
    },
    isPublic: { type: Boolean, default: true },
  },
  schemaOptions
);

module.exports = mongoose.model("Upload", uploadSchema);
