const Favorite = require("../models/Favorite");
const ProviderProfile = require("../models/ProviderProfile");
const ApiError = require("../utils/ApiError");

const PROVIDER_FIELDS =
  "displayName slug type headline avatar primaryCategory ratingAvg ratingCount startingBudget currency availability verified featured skills";

async function listFavorites(req, res, next) {
  try {
    const favorites = await Favorite.find({ user: req.user._id })
      .populate({
        path: "provider",
        select: PROVIDER_FIELDS,
        populate: { path: "primaryCategory", select: "name slug icon" },
      })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ items: favorites.filter((favorite) => favorite.provider) });
  } catch (error) {
    next(error);
  }
}

async function addFavorite(req, res, next) {
  try {
    const provider = await ProviderProfile.findOne({ _id: req.params.providerId, status: "published" }).select(
      "_id user"
    );
    if (!provider) throw ApiError.notFound("Provider not found or not published");
    if (String(provider.user) === String(req.user._id)) {
      throw ApiError.badRequest("You cannot save your own provider profile");
    }
    await Favorite.updateOne(
      { user: req.user._id, provider: provider._id },
      { $setOnInsert: { user: req.user._id, provider: provider._id } },
      { upsert: true }
    );
    res.status(201).json({ saved: true, message: "Saved to favorites" });
  } catch (error) {
    next(error);
  }
}

async function removeFavorite(req, res, next) {
  try {
    await Favorite.deleteOne({ user: req.user._id, provider: req.params.providerId });
    res.json({ saved: false, message: "Removed from favorites" });
  } catch (error) {
    next(error);
  }
}

module.exports = { listFavorites, addFavorite, removeFavorite };
