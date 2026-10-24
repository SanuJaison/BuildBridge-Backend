const mongoose = require("mongoose");
const { schemaOptions } = require("./plugins");

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 140 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    logo: { type: String, default: "" },
    description: { type: String, trim: true, maxlength: 3000, default: "" },
    industry: { type: String, trim: true, default: "" },
    website: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "" },
    companySize: { type: String, trim: true, default: "" },
    yearEstablished: { type: Number, min: 1900, max: 2100, default: null },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    isDemo: { type: Boolean, default: false },
  },
  schemaOptions
);

module.exports = mongoose.model("Organization", organizationSchema);
