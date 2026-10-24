const Service = require("../models/Service");
const ProviderProfile = require("../models/ProviderProfile");
const Category = require("../models/Category");
const ApiError = require("../utils/ApiError");
const { getPagination, escapeRegex } = require("../utils/helpers");

const SERVICE_PROVIDER_FIELDS = "displayName slug type avatar ratingAvg ratingCount verified startingBudget currency";

async function resolveCategoryIds(slug) {
  const category = await Category.findOne({ slug, isActive: true });
  if (!category) return [];
  const children = await Category.find({ parent: category._id, isActive: true }).distinct("_id");
  return [category._id, ...children];
}

async function buildServiceFilter(query) {
  const filter = { status: "published" };

  const providerFilter = { status: "published" };
  const types = String(query.providerType || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (types.length) providerFilter.type = { $in: types };
  if (query.provider) providerFilter.slug = query.provider;
  const providerIds = await ProviderProfile.find(providerFilter).distinct("_id");
  filter.provider = { $in: providerIds };

  const categoryIds = query.category ? await resolveCategoryIds(query.category) : [];
  if (query.category) filter.category = { $in: categoryIds };
  if (query.subcategory) {
    const sub = await Category.findOne({ slug: query.subcategory, isActive: true });
    filter.subcategory = sub ? sub._id : null;
  }

  const q = String(query.q || "").trim();
  if (q) {
    const regex = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ title: regex }, { description: regex }, { tags: regex }];
  }

  const minPrice = Number(query.minPrice);
  const maxPrice = Number(query.maxPrice);
  if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
    filter.startingPrice = {};
    if (Number.isFinite(minPrice)) filter.startingPrice.$gte = minPrice;
    if (Number.isFinite(maxPrice)) filter.startingPrice.$lte = maxPrice;
  }
  if (["fixed", "hourly", "custom"].includes(query.pricingType)) {
    filter.pricingType = query.pricingType;
  }
  if (query.available === "true") filter.status = "published";

  return filter;
}

function serviceSort(sort) {
  switch (sort) {
    case "price_asc":
      return { startingPrice: 1 };
    case "price_desc":
      return { startingPrice: -1 };
    case "popular":
      return { views: -1, createdAt: -1 };
    case "newest":
      return { createdAt: -1 };
    default:
      return { createdAt: -1 };
  }
}

async function listServices(req, res, next) {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = await buildServiceFilter(req.query);
    const [items, total] = await Promise.all([
      Service.find(filter)
        .select(
          "title slug description startingPrice maxPrice currency pricingType deliveryDays images tags provider category createdAt"
        )
        .populate("provider", SERVICE_PROVIDER_FIELDS)
        .populate("category", "name slug icon")
        .sort(serviceSort(req.query.sort))
        .skip(skip)
        .limit(limit)
        .lean(),
      Service.countDocuments(filter),
    ]);

    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)), limit });
  } catch (error) {
    next(error);
  }
}

async function getService(req, res, next) {
  try {
    const service = await Service.findOne({ slug: req.params.slug, status: "published" })
      .populate(
        "provider",
        "displayName slug type headline avatar coverImage ratingAvg ratingCount verified availability startingBudget currency location skills status"
      )
      .populate("category", "name slug icon")
      .populate("subcategory", "name slug icon")
      .lean();
    if (!service || !service.provider || service.provider.status !== "published") {
      throw ApiError.notFound("Service not found or not yet published");
    }
    Service.updateOne({ _id: service._id }, { $inc: { views: 1 } }).catch(() => {});

    const related = await Service.find({
      _id: { $ne: service._id },
      status: "published",
      category: service.category?._id,
      provider: { $ne: service.provider._id },
    })
      .select("title slug description startingPrice currency pricingType deliveryDays images tags provider category")
      .populate("provider", SERVICE_PROVIDER_FIELDS)
      .sort({ views: -1 })
      .limit(3)
      .lean();

    const providerServices = await Service.find({
      provider: service.provider._id,
      status: "published",
      _id: { $ne: service._id },
    })
      .select("title slug startingPrice currency pricingType deliveryDays")
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();

    res.json({ service, related, providerServices });
  } catch (error) {
    next(error);
  }
}

module.exports = { listServices, getService, buildServiceFilter };
