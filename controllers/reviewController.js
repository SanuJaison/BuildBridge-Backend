const { z } = require("zod");
const Review = require("../models/Review");
const Inquiry = require("../models/Inquiry");
const ProviderProfile = require("../models/ProviderProfile");
const Conversation = require("../models/Conversation");
const ApiError = require("../utils/ApiError");
const { createNotification } = require("../utils/notifications");
const { addSystemMessage } = require("../utils/conversation");

const reviewSchema = z.object({
  inquiryId: z.string().regex(/^[a-f\d]{24}$/i, "Select a valid engagement"),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  comment: z.string().trim().min(10, "Write at least 10 characters").max(2000),
});

async function recalculateProviderRating(providerId) {
  const rows = await Review.aggregate([
    { $match: { provider: providerId, status: "published" } },
    {
      $group: {
        _id: null,
        average: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);
  const average = rows[0]?.average || 0;
  const count = rows[0]?.count || 0;
  await ProviderProfile.updateOne(
    { _id: providerId },
    { $set: { ratingAvg: Math.round(average * 10) / 10, ratingCount: count } }
  );
  return { ratingAvg: Math.round(average * 10) / 10, ratingCount: count };
}

async function createReview(req, res, next) {
  try {
    const inquiry = await Inquiry.findById(req.body.inquiryId);
    if (!inquiry) throw ApiError.notFound("Engagement not found");
    if (String(inquiry.customer) !== String(req.user._id)) {
      throw ApiError.forbidden("Only the customer on this engagement can leave a review");
    }
    if (inquiry.status !== "completed") {
      throw ApiError.badRequest("Reviews can be submitted after an accepted engagement is marked complete");
    }
    const existing = await Review.findOne({ inquiry: inquiry._id });
    if (existing) throw ApiError.conflict("A review already exists for this engagement");

    const review = await Review.create({
      provider: inquiry.provider,
      customer: req.user._id,
      inquiry: inquiry._id,
      rating: req.body.rating,
      title: req.body.title || "",
      comment: req.body.comment,
      status: "published",
    });
    const aggregate = await recalculateProviderRating(inquiry.provider);
    const provider = await ProviderProfile.findById(inquiry.provider).select("displayName");
    const conversation = await Conversation.findOne({ inquiry: inquiry._id });
    await addSystemMessage(conversation, "The customer left a review for this completed engagement.", [
      req.user._id,
    ]);
    await createNotification(req.app, {
      user: inquiry.providerUser,
      type: "review",
      title: "New review received",
      message: `A customer rated the completed “${inquiry.title}” engagement ${req.body.rating}/5.`,
      link: `/providers/${provider?.slug || ""}`,
    });

    res.status(201).json({ review, providerRating: aggregate, message: "Review published" });
  } catch (error) {
    next(error);
  }
}

async function myReviews(req, res, next) {
  try {
    const items = await Review.find({ customer: req.user._id })
      .populate("provider", "displayName slug avatar type")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ items });
  } catch (error) {
    next(error);
  }
}

module.exports = { createReview, myReviews, recalculateProviderRating, reviewSchema };
