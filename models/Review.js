const mongoose = require("mongoose");
const { schemaOptions } = require("./plugins");

const reviewSchema = new mongoose.Schema(
  {
    provider: { type: mongoose.Schema.Types.ObjectId, ref: "ProviderProfile", required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    inquiry: { type: mongoose.Schema.Types.ObjectId, ref: "Inquiry", required: true, unique: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 120, default: "" },
    comment: { type: String, required: true, trim: true, maxlength: 2000 },
    status: { type: String, enum: ["published", "hidden", "removed"], default: "published", index: true },
    moderationNote: { type: String, default: "" },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isDemo: { type: Boolean, default: false },
  },
  schemaOptions
);

reviewSchema.index({ provider: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("Review", reviewSchema);
