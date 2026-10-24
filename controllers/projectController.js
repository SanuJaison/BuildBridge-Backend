const PortfolioProject = require("../models/PortfolioProject");
const ProviderProfile = require("../models/ProviderProfile");
const Category = require("../models/Category");
const ApiError = require("../utils/ApiError");
const { getPagination, escapeRegex } = require("../utils/helpers");

const PROJECT_PROVIDER_FIELDS =
  "displayName slug type headline avatar ratingAvg ratingCount verified startingBudget currency location";

async function listProjects(req, res, next) {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = { status: "published" };

    const providerFilter = { status: "published" };
    if (req.query.provider) providerFilter.slug = req.query.provider;
    if (req.query.providerType) {
      providerFilter.type = { $in: String(req.query.providerType).split(",").map((item) => item.trim()) };
    }
    const providerIds = await ProviderProfile.find(providerFilter).distinct("_id");
    filter.provider = { $in: providerIds };

    if (req.query.category) {
      const category = await Category.findOne({ slug: req.query.category, isActive: true });
      if (category) {
        const children = await Category.find({ parent: category._id, isActive: true }).distinct("_id");
        filter.category = { $in: [category._id, ...children] };
      } else {
        filter.category = null;
      }
    }
    if (req.query.featured === "true") filter.featured = true;

    const q = String(req.query.q || "").trim();
    if (q) {
      const regex = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ title: regex }, { summary: regex }, { description: regex }, { technologies: regex }];
    }

    const sort = req.query.sort === "popular" ? { views: -1 } : { featured: -1, createdAt: -1 };
    const [items, total] = await Promise.all([
      PortfolioProject.find(filter)
        .select(
          "title slug summary description images technologies skills category completionDate role featured views provider createdAt"
        )
        .populate("provider", PROJECT_PROVIDER_FIELDS)
        .populate("category", "name slug icon")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      PortfolioProject.countDocuments(filter),
    ]);

    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)), limit });
  } catch (error) {
    next(error);
  }
}

async function getProject(req, res, next) {
  try {
    const project = await PortfolioProject.findOneAndUpdate(
      { slug: req.params.slug, status: "published" },
      { $inc: { views: 1 } },
      { new: true }
    )
      .populate("provider", `${PROJECT_PROVIDER_FIELDS} bio skills technologies githubUrl portfolioUrl website`)
      .populate("category", "name slug icon")
      .populate("subcategory", "name slug icon")
      .lean();
    if (!project || !project.provider) throw ApiError.notFound("Project not found or not yet published");

    const providerPublished = await ProviderProfile.exists({
      _id: project.provider._id,
      status: "published",
    });
    if (!providerPublished) throw ApiError.notFound("Project not found or not yet published");

    const related = await PortfolioProject.find({
      _id: { $ne: project._id },
      status: "published",
      category: project.category?._id,
    })
      .select("title slug summary images technologies provider createdAt")
      .populate("provider", "displayName slug avatar type verified")
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();

    const providerProjects = await PortfolioProject.find({
      provider: project.provider._id,
      status: "published",
      _id: { $ne: project._id },
    })
      .select("title slug summary images technologies createdAt")
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();

    res.json({ project, related, providerProjects });
  } catch (error) {
    next(error);
  }
}

module.exports = { listProjects, getProject };
