const mongoose = require("mongoose");
const { schemaOptions } = require("./plugins");

const reportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    targetType: {
      type: String,
      enum: ["user", "provider", "review", "portfolio", "service", "message"],
      required: true,
    },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    reason: { type: String, required: true, trim: true, maxlength: 200 },
    details: { type: String, trim: true, maxlength: 2000, default: "" },
    status: { type: String, enum: ["open", "reviewing", "resolved", "dismissed"], default: "open", index: true },
    resolutionNote: { type: String, default: "" },
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  schemaOptions
);

reportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Report", reportSchema);
