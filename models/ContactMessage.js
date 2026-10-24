const mongoose = require("mongoose");
const { schemaOptions } = require("./plugins");

const contactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, lowercase: true, trim: true },
    subject: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, trim: true, maxlength: 3000 },
    status: { type: String, enum: ["new", "read", "resolved"], default: "new", index: true },
  },
  schemaOptions
);

module.exports = mongoose.model("ContactMessage", contactMessageSchema);
