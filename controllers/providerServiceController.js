const { z } = require("zod");
const Service = require("../models/Service");
const Category = require("../models/Category");
const Inquiry = require("../models/Inquiry");
const ApiError = require("../utils/ApiError");
const { uniqueSlug } = require("../utils/helpers");
const { optionalShape } = require("../utils/validation");

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Select a valid category");
const stringList = (maxItems, maxLength) =>
  z.array(z.string().trim().min(1).max(maxLength)).max(maxItems).optional();

const serviceSchema = z.object({
  title: z.string().trim().min(5, "Title must be at least 5 characters").max(160),
  description: z.string().trim().min(30, "Describe the service in at least 30 characters").max(5000),
  category: objectId,
  subcategory: z.union([objectId, z.literal(""), z.null()]).optional(),
  images: z.array(z.string().trim().max(1000)).max(8).optional(),
  startingPrice: z.number().min(0).default(0),
  maxPrice: z.union([z.number().min(0), z.null()]).optional(),
  pricingType: z.enum(["fixed", "hourly", "custom"]).default("fixed"),
  deliveryDays: z.number().int().min(1).max(365).default(14),
  deliverables: stringList(20, 200),
  requirements: stringList(20, 300),
  tags: stringList(15, 40),
  faqs: z
    .array(
      z.object({
        question: z.string().trim().min(3).max(300),
        answer: z.string().trim().min(3).max(2000),
      })
    )
    .max(10)
    .optional(),
  status: z.enum(["draft", "published", "paused"]).default("draft"),
});

const serviceUpdateSchema = optionalShape(serviceSchema);

async function validateCategory(categoryId, subcategoryId) {
  const category = await Category.findOne({ _id: categoryId, isActive: true });
  if (!category) throw ApiError.badRequest("Choose an active service category");
  if (category.parent) throw ApiError.badRequest("Choose a top-level service category");
  if (subcategoryId) {
    const subcategory = await Category.findOne({ _id: subcategoryId, isActive: true });
    if (!subcategory) throw ApiError.badRequest("Choose a valid subcategory");
    if (String(subcategory.parent) !== String(categoryId)) {
      throw ApiError.badRequest("The subcategory does not belong to that category");
    }
  }
  return { category, subcategoryId: subcategoryId || null };
}

async function myServices(req, res, next) {
  try {
    const items = await Service.find({ provider: req.provider._id })
      .populate("category", "name slug icon")
      .populate("subcategory", "name slug icon")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ items });
  } catch (error) {
    next(error);
  }
}

async function createService(req, res, next) {
  try {
    const data = req.body;
    if (data.status === "published" && req.provider.status !== "published") {
      throw ApiError.badRequest("Publish your provider profile before publishing services");
    }
    const { category, subcategoryId } = await validateCategory(data.category, data.subcategory);
    if (data.startingPrice > 0 && data.maxPrice !== null && data.maxPrice !== undefined && data.maxPrice < data.startingPrice) {
      throw ApiError.badRequest("Maximum price cannot be lower than the starting price");
    }

    const service = await Service.create({
      ...data,
      subcategory: subcategoryId,
      category: category._id,
      provider: req.provider._id,
      slug: await uniqueSlug(Service, data.title),
      isDemo: false,
    });
    res.status(201).json({ service, message: "Service created" });
  } catch (error) {
    next(error);
  }
}

async function updateService(req, res, next) {
  try {
    const service = await Service.findOne({ _id: req.params.id, provider: req.provider._id });
    if (!service) throw ApiError.notFound("Service not found");
    if (service.status === "suspended") {
      throw ApiError.forbidden("This service was suspended by an administrator and cannot be edited");
    }
    const data = req.body;
    if (data.status === "published" && req.provider.status !== "published") {
      throw ApiError.badRequest("Publish your provider profile before publishing services");
    }
    if (data.category || data.subcategory !== undefined) {
      const categoryId = data.category || service.category;
      const subcategoryId = data.subcategory === "" ? null : data.subcategory ?? service.subcategory;
      const validated = await validateCategory(categoryId, subcategoryId);
      service.category = validated.category._id;
      service.subcategory = validated.subcategoryId;
      delete data.category;
      delete data.subcategory;
    }
    const startingPrice = data.startingPrice ?? service.startingPrice;
    const maxPrice = data.maxPrice !== undefined ? data.maxPrice : service.maxPrice;
    if (startingPrice > 0 && maxPrice !== null && maxPrice < startingPrice) {
      throw ApiError.badRequest("Maximum price cannot be lower than the starting price");
    }
    const allowed = Object.keys(serviceSchema.shape).filter((field) => field !== "category" && field !== "subcategory");
    allowed.forEach((field) => {
      if (data[field] !== undefined) service[field] = data[field];
    });
    await service.save();
    res.json({ service, message: "Service updated" });
  } catch (error) {
    next(error);
  }
}

async function deleteService(req, res, next) {
  try {
    const service = await Service.findOne({ _id: req.params.id, provider: req.provider._id });
    if (!service) throw ApiError.notFound("Service not found");
    await Promise.all([
      service.deleteOne(),
      Inquiry.updateMany({ service: service._id }, { $set: { service: null } }),
    ]);
    res.json({ message: "Service deleted" });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  myServices,
  createService,
  updateService,
  deleteService,
  serviceSchema,
  serviceUpdateSchema,
};
