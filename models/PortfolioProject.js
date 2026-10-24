const mongoose = require("mongoose");
const { schemaOptions } = require("./plugins");

const portfolioProjectSchema = new mongoose.Schema(
  {
    provider: { type: mongoose.Schema.Types.ObjectId, ref: "ProviderProfile", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    summary: { type: String, trim: true, maxlength: 400, default: "" },
    description: { type: String, required: true, trim: true, maxlength: 8000 },
    images: [{ type: String }],
    technologies: [{ type: String, trim: true }],
    skills: [{ type: String, trim: true }],
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true, index: true },
    subcategory: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    completionDate: { type: Date, default: null },
    role: { type: String, trim: true, maxlength: 200, default: "" },
    liveUrl: { type: String, trim: true, default: "" },
    repoUrl: { type: String, trim: true, default: "" },
    outcomes: { type: String, trim: true, maxlength: 1200, default: "" },
    clientName: { type: String, trim: true, default: "" },
    featured: { type: Boolean, default: false, index: true },
    status: { type: String, enum: ["draft", "published", "suspended"], default: "draft", index: true },
    views: { type: Number, default: 0 },
    isDemo: { type: Boolean, default: false },
  },
  schemaOptions
);

portfolioProjectSchema.index({ provider: 1, status: 1 });
portfolioProjectSchema.index({ category: 1, status: 1 });
portfolioProjectSchema.index({ createdAt: -1 });

module.exports = mongoose.model("PortfolioProject", portfolioProjectSchema);
