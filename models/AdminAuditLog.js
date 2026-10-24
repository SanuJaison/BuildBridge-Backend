const mongoose = require("mongoose");
const { schemaOptions } = require("./plugins");

const adminAuditLogSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, required: true, trim: true, maxlength: 120 },
    targetType: { type: String, trim: true, default: "" },
    targetId: { type: String, default: "" },
    details: { type: String, default: "" },
    ip: { type: String, default: "" },
  },
  { ...schemaOptions, timestamps: { createdAt: true, updatedAt: false } }
);

adminAuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AdminAuditLog", adminAuditLogSchema);
