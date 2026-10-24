const mongoose = require("mongoose");
const { schemaOptions } = require("./plugins");

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true, maxlength: 300 },
    answer: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { _id: false }
);

const serviceSchema = new mongoose.Schema(
  {
    provider: { type: mongoose.Schema.Types.ObjectId, ref: "ProviderProfile", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true, index: true },
    subcategory: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    images: [{ type: String }],
    startingPrice: { type: Number, min: 0, default: 0 },
    maxPrice: { type: Number, min: 0, default: null },
    currency: { type: String, default: "USD" },
    pricingType: { type: String, enum: ["fixed", "hourly", "custom"], default: "fixed" },
    deliveryDays: { type: Number, min: 1, max: 365, default: 14 },
    deliverables: [{ type: String, trim: true }],
    requirements: [{ type: String, trim: true }],
    tags: [{ type: String, trim: true }],
    faqs: [faqSchema],
    status: { type: String, enum: ["draft", "published", "paused", "suspended"], default: "draft", index: true },
    views: { type: Number, default: 0 },
    isDemo: { type: Boolean, default: false },
  },
  schemaOptions
);

serviceSchema.index({ provider: 1, status: 1 });
serviceSchema.index({ category: 1, status: 1 });
serviceSchema.index({ startingPrice: 1 });

module.exports = mongoose.model("Service", serviceSchema);
