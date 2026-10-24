const mongoose = require("mongoose");
const { schemaOptions } = require("./plugins");

const favoriteSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    provider: { type: mongoose.Schema.Types.ObjectId, ref: "ProviderProfile", required: true, index: true },
  },
  schemaOptions
);

favoriteSchema.index({ user: 1, provider: 1 }, { unique: true });

module.exports = mongoose.model("Favorite", favoriteSchema);
