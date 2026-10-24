const mongoose = require("mongoose");
const { schemaOptions } = require("./plugins");

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, default: "", maxlength: 1000 },
    icon: { type: String, trim: true, default: "layers" },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null, index: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    featured: { type: Boolean, default: false },
  },
  schemaOptions
);

categorySchema.index({ parent: 1, order: 1 });

module.exports = mongoose.model("Category", categorySchema);
