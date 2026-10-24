const mongoose = require("mongoose");
const { schemaOptions } = require("./plugins");

const attachmentSchema = new mongoose.Schema(
  {
    upload: { type: mongoose.Schema.Types.ObjectId, ref: "Upload" },
    name: { type: String, trim: true },
    mimeType: { type: String },
    size: { type: Number },
  },
  { _id: false }
);

const inquirySchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    provider: { type: mongoose.Schema.Types.ObjectId, ref: "ProviderProfile", required: true, index: true },
    providerUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: "Service", default: null },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, trim: true, maxlength: 6000 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    subcategory: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    features: { type: String, trim: true, maxlength: 3000, default: "" },
    budgetMin: { type: Number, min: 0, default: null },
    budgetMax: { type: Number, min: 0, default: null },
    timeline: { type: String, trim: true, maxlength: 200, default: "" },
    referenceLinks: [{ type: String, trim: true }],
    attachments: [attachmentSchema],
    communicationPreference: {
      type: String,
      enum: ["in_app", "email", "video_call", "phone"],
      default: "in_app",
    },
    status: {
      type: String,
      enum: ["new", "in_discussion", "proposal_sent", "accepted", "declined", "completed", "cancelled"],
      default: "new",
      index: true,
    },
    providerReadAt: { type: Date },
    customerReadAt: { type: Date },
    lastActivityAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    isDemo: { type: Boolean, default: false },
  },
  schemaOptions
);

inquirySchema.index({ customer: 1, createdAt: -1 });
inquirySchema.index({ providerUser: 1, createdAt: -1 });
inquirySchema.index({ provider: 1, status: 1 });

module.exports = mongoose.model("Inquiry", inquirySchema);
