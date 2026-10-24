const { z } = require("zod");
const PortfolioProject = require("../models/PortfolioProject");
const Category = require("../models/Category");
const ApiError = require("../utils/ApiError");
const { uniqueSlug } = require("../utils/helpers");
const { optionalShape } = require("../utils/validation");

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Select a valid category");
const stringList = (maxItems, maxLength) =>
  z.array(z.string().trim().min(1).max(maxLength)).max(maxItems).optional();

const projectSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(160),
  summary: z.string().trim().max(400).optional(),
  description: z.string().trim().min(30, "Describe the project in at least 30 characters").max(8000),
  images: z.array(z.string().trim().max(1000)).max(8).optional(),
  technologies: stringList(20, 50),
  skills: stringList(20, 50),
  category: objectId,
  subcategory: z.union([objectId, z.literal(""), z.null()]).optional(),
  completionDate: z.union([z.string(), z.null()]).optional(),
  role: z.string().trim().max(200).optional(),
  liveUrl: z.string().trim().max(500).optional(),
  repoUrl: z.string().trim().max(500).optional(),
  outcomes: z.string().trim().max(1200).optional(),
  clientName: z.string().trim().max(120).optional(),
  status: z.enum(["draft", "published"]).default("draft"),
  featured: z.boolean().optional(),
});

const projectUpdateSchema = optionalShape(projectSchema);

async function validateCategory(categoryId, subcategoryId) {
  const category = await Category.findOne({ _id: categoryId, isActive: true });
  if (!category) throw ApiError.badRequest("Choose an active project category");
  if (category.parent) throw ApiError.badRequest("Choose a top-level project category");
  if (subcategoryId) {
    const subcategory = await Category.findOne({ _id: subcategoryId, isActive: true });
    if (!subcategory) throw ApiError.badRequest("Choose a valid subcategory");
    if (String(subcategory.parent) !== String(categoryId)) {
      throw ApiError.badRequest("The subcategory does not belong to that category");
    }
  }
  return { category, subcategoryId: subcategoryId || null };
}

async function myProjects(req, res, next) {
  try {
    const items = await PortfolioProject.find({ provider: req.provider._id })
      .populate("category", "name slug icon")
      .populate("subcategory", "name slug icon")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ items });
  } catch (error) {
    next(error);
  }
}

async function createProject(req, res, next) {
  try {
    const data = req.body;
    if (data.status === "published" && req.provider.status !== "published") {
      throw ApiError.badRequest("Publish your provider profile before publishing portfolio projects");
    }
    const { category, subcategoryId } = await validateCategory(data.category, data.subcategory);
    const project = await PortfolioProject.create({
      ...data,
      category: category._id,
      subcategory: subcategoryId,
      completionDate: data.completionDate ? new Date(data.completionDate) : null,
      provider: req.provider._id,
      slug: await uniqueSlug(PortfolioProject, data.title),
      featured: false,
      isDemo: false,
    });
    res.status(201).json({ project, message: "Portfolio project created" });
  } catch (error) {
    next(error);
  }
}

async function updateProject(req, res, next) {
  try {
    const project = await PortfolioProject.findOne({ _id: req.params.id, provider: req.provider._id });
    if (!project) throw ApiError.notFound("Portfolio project not found");
    if (project.status === "suspended") {
      throw ApiError.forbidden("This project was suspended by an administrator and cannot be edited");
    }
    const data = req.body;
    if (data.status === "published" && req.provider.status !== "published") {
      throw ApiError.badRequest("Publish your provider profile before publishing portfolio projects");
    }
    if (data.category || data.subcategory !== undefined) {
      const categoryId = data.category || project.category;
      const subcategoryId = data.subcategory === "" ? null : data.subcategory ?? project.subcategory;
      const validated = await validateCategory(categoryId, subcategoryId);
      project.category = validated.category._id;
      project.subcategory = validated.subcategoryId;
      delete data.category;
      delete data.subcategory;
    }
    if (data.completionDate !== undefined) {
      project.completionDate = data.completionDate ? new Date(data.completionDate) : null;
      delete data.completionDate;
    }
    delete data.featured;
    const allowed = Object.keys(projectSchema.shape).filter(
      (field) => !["category", "subcategory", "completionDate", "featured"].includes(field)
    );
    allowed.forEach((field) => {
      if (data[field] !== undefined) project[field] = data[field];
    });
    await project.save();
    res.json({ project, message: "Portfolio project updated" });
  } catch (error) {
    next(error);
  }
}

async function deleteProject(req, res, next) {
  try {
    const project = await PortfolioProject.findOne({ _id: req.params.id, provider: req.provider._id });
    if (!project) throw ApiError.notFound("Portfolio project not found");
    await project.deleteOne();
    res.json({ message: "Portfolio project deleted" });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  myProjects,
  createProject,
  updateProject,
  deleteProject,
  projectSchema,
  projectUpdateSchema,
};
