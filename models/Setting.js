const mongoose = require("mongoose");
const { schemaOptions } = require("./plugins");

const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: mongoose.Schema.Types.Mixed },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  schemaOptions
);

module.exports = mongoose.model("Setting", settingSchema);
