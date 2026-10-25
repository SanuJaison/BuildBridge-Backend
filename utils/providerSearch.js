const Category = require("../models/Category");
const Service = require("../models/Service");
const PortfolioProject = require("../models/PortfolioProject");
const { PROVIDER_ROLE_VALUES } = require("../config/providerRoles");
const { escapeRegex } = require("./helpers");

const PROVIDER_TYPES = ["freelancer", "developer", "company", "agency", "studio"];

async function buildProviderFilter(query = {}) {
  const filter = { status: "published" };
  const and = [];

  const types = String(query.type || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => PROVIDER_TYPES.includes(item));
  if (types.length) and.push({ type: { $in: types } });

  if (query.availability && ["available", "limited", "unavailable"].includes(query.availability)) {
    and.push({ availability: query.availability });
  }

  if (query.featured === "true") and.push({ featured: true });
  if (query.remote === "true") and.push({ remote: true });
  if (query.verified === "true") and.push({ verified: true });

  const roles = String(query.role || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => PROVIDER_ROLE_VALUES.includes(item));
  if (roles.length) and.push({ roles: { $in: roles } });

  const q = String(query.q || "").trim();
  if (q) {
    const regex = new RegExp(escapeRegex(q), "i");
    const [categoryIds, serviceProviders, projectProviders] = await Promise.all([
      Category.find({ isActive: true, name: regex }).distinct("_id"),
      Service.find({ status: "published", $or: [{ title: regex }, { tags: regex }] }).distinct("provider"),
      PortfolioProject.find({
        status: "published",
        $or: [{ title: regex }, { technologies: regex }, { summary: regex }],
      }).distinct("provider"),
    ]);
    and.push({
      $or: [
        { displayName: regex },
        { headline: regex },
        { bio: regex },
        { skills: regex },
        { technologies: regex },
        { roles: regex },
        { primaryCategory: { $in: categoryIds } },
        { subcategories: { $in: categoryIds } },
        { _id: { $in: [...serviceProviders, ...projectProviders] } },
      ],
    });
  }

  const categorySlug = String(query.category || "").trim();
  if (categorySlug) {
    const category = await Category.findOne({ slug: categorySlug, isActive: true });
    if (!category) {
      and.push({ _id: null });
    } else {
      const childIds = await Category.find({ parent: category._id, isActive: true }).distinct("_id");
      const ids = [category._id, ...childIds];
      if (query.subcategory) {
        const sub = await Category.findOne({ slug: query.subcategory, parent: category._id, isActive: true });
        if (!sub) and.push({ _id: null });
        else and.push({ subcategories: sub._id });
      } else {
        and.push({ $or: [{ primaryCategory: { $in: ids } }, { subcategories: { $in: ids } }] });
      }
    }
  }

  const skills = String(query.skills || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
  if (skills.length) {
    and.push({ skills: { $all: skills.map((skill) => new RegExp(`^${escapeRegex(skill)}$`, "i")) } });
  }

  const minBudget = Number(query.minBudget);
  const maxBudget = Number(query.maxBudget);
  if (Number.isFinite(minBudget) || Number.isFinite(maxBudget)) {
    const budgetFilter = { $ne: null };
    if (Number.isFinite(minBudget)) budgetFilter.$gte = minBudget;
    if (Number.isFinite(maxBudget)) budgetFilter.$lte = maxBudget;
    and.push({ startingBudget: budgetFilter });
  }

  const minRating = Number(query.minRating);
  if (Number.isFinite(minRating) && minRating > 0) and.push({ ratingAvg: { $gte: minRating } });

  const experienceMin = Number(query.experienceMin);
  if (Number.isFinite(experienceMin) && experienceMin > 0) {
    and.push({ experienceYears: { $gte: experienceMin } });
  }

  const location = String(query.location || "").trim();
  if (location) and.push({ location: new RegExp(escapeRegex(location), "i") });

  if (and.length) filter.$and = and;
  return filter;
}

function providerSort(sort) {
  switch (sort) {
    case "newest":
      return { createdAt: -1 };
    case "rating":
      return { ratingAvg: -1, ratingCount: -1 };
    case "price_asc":
      return { startingBudget: 1, ratingAvg: -1 };
    case "price_desc":
      return { startingBudget: -1, ratingAvg: -1 };
    case "relevance":
    default:
      return { featured: -1, ratingAvg: -1, ratingCount: -1, createdAt: -1 };
  }
}

const PROVIDER_CARD_FIELDS =
  "displayName slug type roles primaryRole headline avatar coverImage primaryCategory skills ratingAvg ratingCount startingBudget hourlyRate currency location availability verified featured experienceYears completedProjects teamSize organization createdAt";

module.exports = { buildProviderFilter, providerSort, PROVIDER_CARD_FIELDS, PROVIDER_TYPES };
