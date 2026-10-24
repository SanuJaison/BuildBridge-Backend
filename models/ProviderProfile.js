const mongoose = require("mongoose");
const { schemaOptions } = require("./plugins");

const providerProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    type: {
      type: String,
      enum: ["freelancer", "developer", "company", "agency", "studio"],
      required: true,
      index: true,
    },
    displayName: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    headline: { type: String, trim: true, maxlength: 160, default: "" },
    bio: { type: String, trim: true, maxlength: 4000, default: "" },
    avatar: { type: String, default: "" },
    coverImage: { type: String, default: "" },
    primaryCategory: { type: mongoose.Schema.Types.ObjectId, ref: "Category", index: true },
    subcategories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
    skills: [{ type: String, trim: true }],
    technologies: [{ type: String, trim: true }],
    languages: [{ type: String, trim: true }],
    location: { type: String, trim: true, default: "" },
    remote: { type: Boolean, default: true },
    experienceYears: { type: Number, min: 0, max: 60, default: 0 },
    startingBudget: { type: Number, min: 0, default: null },
    hourlyRate: { type: Number, min: 0, default: null },
    currency: { type: String, default: "USD" },
    availability: {
      type: String,
      enum: ["available", "limited", "unavailable"],
      default: "available",
      index: true,
    },
    engagementTypes: [{ type: String, trim: true }],
    status: { type: String, enum: ["draft", "published", "suspended"], default: "draft", index: true },
    featured: { type: Boolean, default: false, index: true },
    verified: { type: Boolean, default: false },
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0 },
    profileViews: { type: Number, default: 0 },
    inquiriesCount: { type: Number, default: 0 },
    completedProjects: { type: Number, default: 0 },
    website: { type: String, trim: true, default: "" },
    githubUrl: { type: String, trim: true, default: "" },
    portfolioUrl: { type: String, trim: true, default: "" },
    linkedinUrl: { type: String, trim: true, default: "" },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", default: null },
    teamSize: { type: Number, min: 0, default: null },
    yearEstablished: { type: Number, min: 1900, max: 2100, default: null },
    isDemo: { type: Boolean, default: false },
  },
  schemaOptions
);

providerProfileSchema.index({ displayName: 1 });
providerProfileSchema.index({ status: 1, featured: 1, ratingAvg: -1 });
providerProfileSchema.index({ type: 1, status: 1 });
providerProfileSchema.index({ primaryCategory: 1, status: 1 });

module.exports = mongoose.model("ProviderProfile", providerProfileSchema);
