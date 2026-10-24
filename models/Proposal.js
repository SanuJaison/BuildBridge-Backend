const mongoose = require("mongoose");
const { schemaOptions } = require("./plugins");

const proposalSchema = new mongoose.Schema(
  {
    inquiry: { type: mongoose.Schema.Types.ObjectId, ref: "Inquiry", required: true, unique: true },
    provider: { type: mongoose.Schema.Types.ObjectId, ref: "ProviderProfile", required: true, index: true },
    providerUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    message: { type: String, required: true, trim: true, maxlength: 4000 },
    estimatedCost: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD" },
    timelineDays: { type: Number, required: true, min: 1, max: 730 },
    deliverables: [{ type: String, trim: true }],
    assumptions: { type: String, trim: true, maxlength: 2000, default: "" },
    status: { type: String, enum: ["sent", "accepted", "declined", "withdrawn"], default: "sent" },
    validUntil: { type: Date, default: null },
  },
  schemaOptions
);

proposalSchema.index({ providerUser: 1, createdAt: -1 });

module.exports = mongoose.model("Proposal", proposalSchema);
