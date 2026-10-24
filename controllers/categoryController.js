const Category = require("../models/Category");
const ProviderProfile = require("../models/ProviderProfile");
const Service = require("../models/Service");
const ApiError = require("../utils/ApiError");

function plainCategory(category) {
  return {
    id: String(category._id),
    name: category.name,
    slug: category.slug,
    description: category.description,
    icon: category.icon,
    order: category.order,
    featured: category.featured,
    isActive: category.isActive,
    parent: category.parent ? String(category.parent) : null,
  };
}

async function getCategoryCounts() {
  const [providerCounts, serviceCounts] = await Promise.all([
    ProviderProfile.aggregate([
      { $match: { status: "published" } },
      { $group: { _id: "$primaryCategory", count: { $sum: 1 } } },
    ]),
    Service.aggregate([
      { $match: { status: "published" } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]),
  ]);

  const providers = {};
  const services = {};
  providerCounts.forEach((row) => {
    if (row._id) providers[String(row._id)] = row.count;
  });
  serviceCounts.forEach((row) => {
    if (row._id) services[String(row._id)] = row.count;
  });
  return { providers, services };
}

async function buildCategoryPayload({ includeInactive = false } = {}) {
  const query = includeInactive ? {} : { isActive: true };
  const categories = await Category.find(query).sort({ order: 1, name: 1 }).lean();
  const counts = await getCategoryCounts();
  const flat = categories.map((category) => ({
    ...plainCategory(category),
    providerCount: counts.providers[String(category._id)] || 0,
    serviceCount: counts.services[String(category._id)] || 0,
  }));

  const byParent = new Map();
  flat.forEach((category) => {
    if (!category.parent) return;
    if (!byParent.has(category.parent)) byParent.set(category.parent, []);
    byParent.get(category.parent).push(category);
  });

  const tree = flat
    .filter((category) => !category.parent)
    .map((category) => {
      const children = byParent.get(category.id) || [];
      return {
        ...category,
        providerCount: category.providerCount + children.reduce((sum, child) => sum + child.providerCount, 0),
        serviceCount: category.serviceCount + children.reduce((sum, child) => sum + child.serviceCount, 0),
        children,
      };
    });

  return { flat, tree };
}

async function listCategories(req, res, next) {
  try {
    const includeInactive = req.user?.role === "admin" && req.query.includeInactive === "true";
    const payload = await buildCategoryPayload({ includeInactive });
    res.json(payload);
  } catch (error) {
    next(error);
  }
}

async function getCategory(req, res, next) {
  try {
    const includeInactive = req.user?.role === "admin";
    const query = includeInactive ? { slug: req.params.slug } : { slug: req.params.slug, isActive: true };
    const category = await Category.findOne(query).lean();
    if (!category) throw ApiError.notFound("Category not found");

    const [children, parent, counts] = await Promise.all([
      Category.find({ parent: category._id, ...(includeInactive ? {} : { isActive: true }) })
        .sort({ order: 1, name: 1 })
        .lean(),
      category.parent ? Category.findById(category.parent).lean() : null,
      getCategoryCounts(),
    ]);

    res.json({
      category: {
        ...plainCategory(category),
        providerCount: counts.providers[String(category._id)] || 0,
        serviceCount: counts.services[String(category._id)] || 0,
        children: children.map((child) => ({
          ...plainCategory(child),
          providerCount: counts.providers[String(child._id)] || 0,
          serviceCount: counts.services[String(child._id)] || 0,
        })),
        parent: parent
          ? { id: String(parent._id), name: parent.name, slug: parent.slug }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { listCategories, getCategory, buildCategoryPayload, getCategoryCounts };
