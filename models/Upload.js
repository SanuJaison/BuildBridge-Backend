const mongoose = require("mongoose");
const { schemaOptions } = require("./plugins");

const uploadSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    originalName: { type: String, required: true },
    storedName: { type: String, required: true, unique: true },
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
