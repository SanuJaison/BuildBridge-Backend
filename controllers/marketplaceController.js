const ProviderProfile = require("../models/ProviderProfile");
const Category = require("../models/Category");
const Service = require("../models/Service");
const PortfolioProject = require("../models/PortfolioProject");
const Inquiry = require("../models/Inquiry");
const Review = require("../models/Review");
const User = require("../models/User");
const { buildCategoryPayload } = require("./categoryController");
const { PROVIDER_CARD_FIELDS } = require("../utils/providerSearch");
const { PROVIDER_ROLES } = require("../config/providerRoles");
const { escapeRegex } = require("../utils/helpers");
const { getBranding } = require("../utils/branding");

async function home(req, res, next) {
  try {
    const [categoriesPayload, featuredProviders, recentProjects, recentServices, stats, branding, recentReviews] =
      await Promise.all([
        buildCategoryPayload(),
        ProviderProfile.find({ status: "published", featured: true })
          .select(PROVIDER_CARD_FIELDS)
          .populate("primaryCategory", "name slug icon")
          .sort({ ratingAvg: -1, createdAt: -1 })
          .limit(12)
          .lean(),
        PortfolioProject.find({ status: "published" })
          .select("title slug summary images technologies category provider createdAt")
          .populate("provider", "displayName slug avatar type verified ratingAvg")
          .populate("category", "name slug icon")
          .sort({ createdAt: -1 })
          .limit(6)
          .lean(),
        Service.find({ status: "published" })
          .select("title slug description startingPrice currency pricingType deliveryDays images tags provider category")
          .populate("provider", "displayName slug avatar type verified ratingAvg ratingCount status")
          .populate("category", "name slug icon")
          .sort({ views: -1, createdAt: -1 })
          .limit(6)
          .lean(),
        Promise.all([
          User.countDocuments({ role: { $in: ["customer", "provider"] }, status: "active" }),
          ProviderProfile.countDocuments({ status: "published" }),
          Service.countDocuments({ status: "published" }),
          PortfolioProject.countDocuments({ status: "published" }),
          Inquiry.countDocuments({ status: "completed" }),
          Review.countDocuments({ status: "published" }),
        ]),
        getBranding(),
        Review.find({ status: "published" })
          .select("rating title comment createdAt customer provider")
          .populate("customer", "name avatar")
          .populate("provider", "displayName slug type avatar")
          .sort({ createdAt: -1 })
          .limit(3)
          .lean(),
      ]);

    const liveServices = recentServices.filter((service) => service.provider && service.provider.status === "published");
    liveServices.forEach((service) => {
      if (service.provider) delete service.provider.status;
    });

    res.json({
      branding,
      categories: categoriesPayload.tree.slice(0, 11),
      featuredProviders,
      recentProjects,
      recentServices: liveServices,
      recentReviews,
      stats: {
        members: stats[0],
        providers: stats[1],
        services: stats[2],
        portfolioProjects: stats[3],
        completedProjects: stats[4],
        verifiedReviews: stats[5],
      },
    });
  } catch (error) {
    next(error);
  }
}

async function search(req, res, next) {
  try {
    const q = String(req.query.q || "").trim().slice(0, 80);
    if (q.length < 2) {
      return res.json({ q, providers: [], services: [], projects: [], categories: [], roles: [] });
    }
    const regex = new RegExp(escapeRegex(q), "i");
    const matchedRoles = PROVIDER_ROLES.filter(
      (role) => regex.test(role.label) || role.keywords.some((keyword) => regex.test(keyword))
    ).map((role) => role.value);

    const providerOr = [{ displayName: regex }, { headline: regex }, { skills: regex }, { technologies: regex }];
    if (matchedRoles.length) providerOr.push({ roles: { $in: matchedRoles } });

    const [providers, services, projects, categories] = await Promise.all([
      ProviderProfile.find({ status: "published", $or: providerOr })
        .select(PROVIDER_CARD_FIELDS)
        .populate("primaryCategory", "name slug icon")
        .sort({ featured: -1, ratingAvg: -1 })
        .limit(5)
        .lean(),
      Service.find({ status: "published", $or: [{ title: regex }, { description: regex }, { tags: regex }] })
        .select("title slug startingPrice currency pricingType images provider category")
        .populate("provider", "displayName slug avatar type verified ratingAvg roles primaryRole")
        .populate("category", "name slug icon")
        .sort({ views: -1, createdAt: -1 })
        .limit(5)
        .lean(),
      PortfolioProject.find({
        status: "published",
        $or: [{ title: regex }, { summary: regex }, { technologies: regex }],
      })
        .select("title slug summary images provider category createdAt")
        .populate("provider", "displayName slug avatar verified")
        .populate("category", "name slug icon")
        .sort({ featured: -1, createdAt: -1 })
        .limit(4)
        .lean(),
      Category.find({ isActive: true, $or: [{ name: regex }, { description: regex }, { slug: regex }] })
        .select("name slug icon parent")
        .sort({ order: 1 })
        .limit(6)
        .lean(),
    ]);

    res.json({
      q,
      providers,
      services: services.filter((item) => item.provider),
      projects: projects.filter((item) => item.provider),
      categories,
      roles: PROVIDER_ROLES.filter((role) => matchedRoles.includes(role.value)),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { home, search };
