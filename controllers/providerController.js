const Category = require("../models/Category");
const ProviderProfile = require("../models/ProviderProfile");
const Service = require("../models/Service");
const PortfolioProject = require("../models/PortfolioProject");
const Review = require("../models/Review");
const Favorite = require("../models/Favorite");
const OrganizationMember = require("../models/OrganizationMember");
const ApiError = require("../utils/ApiError");
const { getPagination } = require("../utils/helpers");
const { buildProviderFilter, providerSort, PROVIDER_CARD_FIELDS } = require("../utils/providerSearch");

const PUBLIC_CATEGORY_FIELDS = "name slug icon";

async function listProviders(req, res, next) {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = await buildProviderFilter(req.query);
    const [items, total] = await Promise.all([
      ProviderProfile.find(filter)
        .select(PROVIDER_CARD_FIELDS)
        .populate("primaryCategory", PUBLIC_CATEGORY_FIELDS)
        .sort(providerSort(req.query.sort))
        .skip(skip)
        .limit(limit)
        .lean(),
      ProviderProfile.countDocuments(filter),
    ]);

    res.json({
      items,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      limit,
    });
  } catch (error) {
    next(error);
  }
}

async function getProvider(req, res, next) {
  try {
    const provider = await ProviderProfile.findOne({ slug: req.params.slug, status: "published" })
      .populate("primaryCategory", PUBLIC_CATEGORY_FIELDS)
      .populate("subcategories", PUBLIC_CATEGORY_FIELDS)
      .populate("organization", "name slug logo industry location companySize yearEstablished website")
      .lean();
    if (!provider) throw ApiError.notFound("Provider not found or not yet published");

    const [services, projects, reviews, ratingRows, teamCount, saved] = await Promise.all([
      Service.find({ provider: provider._id, status: "published" })
        .select("title slug startingPrice currency pricingType deliveryDays images tags faqs createdAt")
        .sort({ createdAt: -1 })
        .limit(12)
        .lean(),
      PortfolioProject.find({ provider: provider._id, status: "published" })
        .select("title slug summary images technologies category completionDate featured createdAt")
        .populate("category", PUBLIC_CATEGORY_FIELDS)
        .sort({ featured: -1, createdAt: -1 })
        .limit(12)
        .lean(),
      Review.find({ provider: provider._id, status: "published" })
        .select("rating title comment createdAt")
        .populate("customer", "name avatar")
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
      Review.aggregate([
        { $match: { provider: provider._id, status: "published" } },
        { $group: { _id: "$rating", count: { $sum: 1 } } },
      ]),
      provider.organization
        ? OrganizationMember.countDocuments({ organization: provider.organization._id, status: "active" })
        : 0,
      req.user ? Favorite.exists({ user: req.user._id, provider: provider._id }) : null,
    ]);

    const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    ratingRows.forEach((row) => {
      breakdown[row._id] = row.count;
    });

    const related = provider.primaryCategory
      ? await ProviderProfile.find({
          _id: { $ne: provider._id },
          status: "published",
          primaryCategory: provider.primaryCategory._id,
        })
          .select(PROVIDER_CARD_FIELDS)
          .populate("primaryCategory", PUBLIC_CATEGORY_FIELDS)
          .sort({ ratingAvg: -1 })
          .limit(3)
          .lean()
      : [];

    res.json({
      provider,
      services,
      projects,
      reviews,
      ratingBreakdown: breakdown,
      teamCount,
      related,
      isSaved: Boolean(saved),
    });
  } catch (error) {
    next(error);
  }
}

async function recordProviderView(req, res, next) {
  try {
    const updated = await ProviderProfile.findOneAndUpdate(
      { slug: req.params.slug, status: "published" },
      { $inc: { profileViews: 1 } },
      { new: true, select: "profileViews" }
    );
    if (!updated) throw ApiError.notFound("Provider not found");
    res.json({ profileViews: updated.profileViews });
  } catch (error) {
    next(error);
  }
}

async function listFeaturedProviders(req, res, next) {
  try {
    const limit = Math.min(12, Math.max(1, parseInt(req.query.limit, 10) || 6));
    const types = String(req.query.type || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const filter = { status: "published", featured: true };
    if (types.length) filter.type = { $in: types };
    const items = await ProviderProfile.find(filter)
      .select(PROVIDER_CARD_FIELDS)
      .populate("primaryCategory", PUBLIC_CATEGORY_FIELDS)
      .sort({ ratingAvg: -1 })
      .limit(limit)
      .lean();
    res.json({ items });
  } catch (error) {
    next(error);
  }
}

module.exports = { listProviders, getProvider, recordProviderView, listFeaturedProviders };
