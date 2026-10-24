const { z } = require("zod");
const User = require("../models/User");
const ProviderProfile = require("../models/ProviderProfile");
const Organization = require("../models/Organization");
const OrganizationMember = require("../models/OrganizationMember");
const Category = require("../models/Category");
const Service = require("../models/Service");
const PortfolioProject = require("../models/PortfolioProject");
const Inquiry = require("../models/Inquiry");
const Proposal = require("../models/Proposal");
const Review = require("../models/Review");
const Report = require("../models/Report");
const Message = require("../models/Message");
const ContactMessage = require("../models/ContactMessage");
const AdminAuditLog = require("../models/AdminAuditLog");
const ApiError = require("../utils/ApiError");
const { getPagination, uniqueSlug } = require("../utils/helpers");
const { buildCategoryPayload } = require("./categoryController");
const { recalculateProviderRating } = require("./reviewController");
const { recordAudit } = require("../utils/audit");
const { createNotification } = require("../utils/notifications");

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid identifier");

const userStatusSchema = z.object({
  status: z.enum(["active", "suspended"]),
  suspensionReason: z.string().trim().max(500).optional(),
});

const providerAdminSchema = z.object({
  status: z.enum(["draft", "published", "suspended"]).optional(),
  featured: z.boolean().optional(),
  verified: z.boolean().optional(),
});

const categorySchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1000).optional(),
  icon: z.string().trim().max(40).optional(),
  parent: z.union([objectId, z.literal(""), z.null()]).optional(),
  order: z.number().int().min(0).max(999).optional(),
  isActive: z.boolean().optional(),
  featured: z.boolean().optional(),
});
const categoryUpdateSchema = categorySchema.partial();

const reviewModerationSchema = z.object({
  status: z.enum(["published", "hidden", "removed"]),
  moderationNote: z.string().trim().max(500).optional(),
});

const reportUpdateSchema = z.object({
  status: z.enum(["reviewing", "resolved", "dismissed"]),
  resolutionNote: z.string().trim().max(1000).optional(),
});

const contactStatusSchema = z.object({ status: z.enum(["new", "read", "resolved"]) });

async function stats(_req, res, next) {
  try {
    const since = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    since.setHours(0, 0, 0, 0);

    const [
      customers,
      providerUsers,
      admins,
      suspendedUsers,
      publishedProviders,
      draftProviders,
      featuredProviders,
      services,
      publishedServices,
      publishedProjects,
      completedInquiries,
      proposals,
      reviews,
      openReports,
      newContactMessages,
      inquiryRows,
      recentUsers,
      recentInquiries,
      audits,
      signupRows,
    ] = await Promise.all([
      User.countDocuments({ role: "customer" }),
      User.countDocuments({ role: "provider" }),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ status: "suspended" }),
      ProviderProfile.countDocuments({ status: "published" }),
      ProviderProfile.countDocuments({ status: "draft" }),
      ProviderProfile.countDocuments({ featured: true }),
      Service.countDocuments(),
      Service.countDocuments({ status: "published" }),
      PortfolioProject.countDocuments({ status: "published" }),
      Inquiry.countDocuments({ status: "completed" }),
      Proposal.countDocuments(),
      Review.countDocuments(),
      Report.countDocuments({ status: { $in: ["open", "reviewing"] } }),
      ContactMessage.countDocuments({ status: "new" }),
      Inquiry.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      User.find().select("name email role status avatar createdAt").sort({ createdAt: -1 }).limit(5).lean(),
      Inquiry.find()
        .select("title status createdAt customer")
        .populate("customer", "name avatar")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      AdminAuditLog.find().populate("admin", "name").sort({ createdAt: -1 }).limit(6).lean(),
      User.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const inquiryByStatus = {};
    inquiryRows.forEach((row) => {
      inquiryByStatus[row._id] = row.count;
    });
    const totalInquiries = Object.values(inquiryByStatus).reduce((sum, value) => sum + value, 0);

    res.json({
      counts: {
        customers,
        providerUsers,
        admins,
        suspendedUsers,
        publishedProviders,
        draftProviders,
        featuredProviders,
        services,
        publishedServices,
        publishedProjects,
        totalInquiries,
        completedInquiries,
        proposals,
        reviews,
        openReports,
        newContactMessages,
      },
      inquiryByStatus,
      recentUsers,
      recentInquiries,
      audits,
      signupSeries: signupRows.map((row) => ({ date: row._id, count: row.count })),
    });
  } catch (error) {
    next(error);
  }
}

async function listUsers(req, res, next) {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.q) {
      const q = String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [{ name: new RegExp(q, "i") }, { email: new RegExp(q, "i") }];
    }
    const [users, total] = await Promise.all([
      User.find(filter)
        .select("name email role status avatar createdAt lastLoginAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);
    const profiles = await ProviderProfile.find({ user: { $in: users.map((user) => user._id) } })
      .select("user displayName slug type status featured")
      .lean();
    const profileMap = new Map(profiles.map((profile) => [String(profile.user), profile]));

    res.json({
      items: users.map((user) => ({ ...user, providerProfile: profileMap.get(String(user._id)) || null })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      limit,
    });
  } catch (error) {
    next(error);
  }
}

async function getUserDetail(req, res, next) {
  try {
    const user = await User.findById(req.params.id).select("name email role status avatar phone company location bio createdAt lastLoginAt suspensionReason").lean();
    if (!user) throw ApiError.notFound("User not found");
    const [providerProfile, memberships] = await Promise.all([
      ProviderProfile.findOne({ user: req.params.id }).populate("primaryCategory", "name slug").lean(),
      OrganizationMember.find({ user: req.params.id, status: { $ne: "removed" } })
        .populate("organization", "name slug")
        .lean(),
    ]);
    res.json({ user, providerProfile, memberships });
  } catch (error) {
    next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) throw ApiError.notFound("User not found");
    if (user.role === "admin") throw ApiError.forbidden("Administrator accounts cannot be suspended or edited here");
    if (String(user._id) === String(req.user._id)) throw ApiError.badRequest("You cannot change your own account status");

    user.status = req.body.status;
    user.suspensionReason = req.body.status === "suspended" ? req.body.suspensionReason || "Policy violation" : "";
    await user.save({ validateBeforeSave: false });

    if (user.role === "provider") {
      const profile = await ProviderProfile.findOne({ user: user._id });
      if (profile) {
        if (req.body.status === "suspended") profile.status = "suspended";
        if (req.body.status === "active" && profile.status === "suspended") {
          profile.status =
            profile.headline && profile.bio && profile.primaryCategory && profile.skills?.length ? "published" : "draft";
        }
        await profile.save();
      }
    }
    await recordAudit(
      req,
      "user.status.update",
      "user",
      user._id,
      `Set ${user.email} to ${req.body.status}`
    );
    res.json({ user, message: `Account ${req.body.status === "suspended" ? "suspended" : "reactivated"}` });
  } catch (error) {
    next(error);
  }
}

async function listProviders(req, res, next) {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.type) filter.type = req.query.type;
    if (req.query.featured === "true") filter.featured = true;
    if (req.query.q) {
      filter.displayName = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    }
    const [items, total] = await Promise.all([
      ProviderProfile.find(filter)
        .select("displayName slug type headline status featured verified avatar ratingAvg ratingCount createdAt user")
        .populate("user", "name email status")
        .populate("primaryCategory", "name slug")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ProviderProfile.countDocuments(filter),
    ]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)), limit });
  } catch (error) {
    next(error);
  }
}

async function updateProvider(req, res, next) {
  try {
    const provider = await ProviderProfile.findById(req.params.id).populate("user", "name email status");
    if (!provider) throw ApiError.notFound("Provider not found");
    if (req.body.status === "published" && provider.user?.status === "suspended") {
      throw ApiError.badRequest("Reactivate the owning account before publishing this provider profile");
    }
    const changes = [];
    if (req.body.status !== undefined) {
      provider.status = req.body.status;
      changes.push(`status → ${req.body.status}`);
    }
    if (req.body.featured !== undefined) {
      provider.featured = req.body.featured;
      changes.push(req.body.featured ? "featured" : "unfeatured");
    }
    if (req.body.verified !== undefined) {
      provider.verified = req.body.verified;
      changes.push(req.body.verified ? "verified" : "verification removed");
    }
    await provider.save();
    await recordAudit(req, "provider.update", "provider", provider._id, changes.join(", ") || "Provider updated");

    if (req.body.status === "suspended" && provider.user) {
      await createNotification(req.app, {
        user: provider.user._id,
        type: "admin",
        title: "Provider profile suspended",
        message: "Your provider profile was suspended after an administrator review. Visit the contact page for assistance.",
        link: "/contact",
      });
    }
    if (req.body.status === "published" && provider.user) {
      await createNotification(req.app, {
        user: provider.user._id,
        type: "admin",
        title: "Provider profile published",
        message: "An administrator published your provider profile.",
        link: `/providers/${provider.slug}`,
      });
    }

    res.json({ provider, message: "Provider updated" });
  } catch (error) {
    next(error);
  }
}

async function listCategories(_req, res, next) {
  try {
    const payload = await buildCategoryPayload({ includeInactive: true });
    res.json(payload);
  } catch (error) {
    next(error);
  }
}

async function validateParent(parentId, selfId = null) {
  if (!parentId) return null;
  if (selfId && String(parentId) === String(selfId)) throw ApiError.badRequest("A category cannot be its own parent");
  const parent = await Category.findById(parentId);
  if (!parent) throw ApiError.badRequest("Parent category not found");
  if (parent.parent) throw ApiError.badRequest("Only two category levels are supported");
  return parent._id;
}

async function createCategory(req, res, next) {
  try {
    const data = req.body;
    const parent = await validateParent(data.parent);
    let order = data.order;
    if (order === undefined) {
      const last = await Category.findOne({ parent: parent || null }).sort({ order: -1 }).select("order").lean();
      order = (last?.order ?? -1) + 1;
    }
    const category = await Category.create({
      name: data.name,
      slug: await uniqueSlug(Category, data.name),
      description: data.description || "",
      icon: data.icon || "layers",
      parent,
      order,
      isActive: data.isActive !== undefined ? data.isActive : true,
      featured: Boolean(data.featured),
    });
    await recordAudit(req, "category.create", "category", category._id, category.name);
    res.status(201).json({ category, message: "Category created" });
  } catch (error) {
    next(error);
  }
}

async function updateCategory(req, res, next) {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) throw ApiError.notFound("Category not found");
    const data = req.body;
    if (data.parent !== undefined) {
      const parent = await validateParent(data.parent, category._id);
      const childCount = await Category.countDocuments({ parent: category._id });
      if (parent && childCount > 0) {
        throw ApiError.badRequest("Move or delete child categories before making this a subcategory");
      }
      category.parent = parent;
    }
    ["name", "description", "icon", "order", "isActive", "featured"].forEach((field) => {
      if (data[field] !== undefined) category[field] = data[field];
    });
    await category.save();
    await recordAudit(req, "category.update", "category", category._id, category.name);
    res.json({ category, message: "Category updated" });
  } catch (error) {
    next(error);
  }
}

async function deleteCategory(req, res, next) {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) throw ApiError.notFound("Category not found");
    const [children, services, projects, providers] = await Promise.all([
      Category.countDocuments({ parent: category._id }),
      Service.countDocuments({ $or: [{ category: category._id }, { subcategory: category._id }] }),
      PortfolioProject.countDocuments({ $or: [{ category: category._id }, { subcategory: category._id }] }),
      ProviderProfile.countDocuments({
        $or: [{ primaryCategory: category._id }, { subcategories: category._id }],
      }),
    ]);
    if (children || services || projects || providers) {
      throw ApiError.conflict(
        "This category is in use. Disable it instead, or move its children and content first."
      );
    }
    await category.deleteOne();
    await recordAudit(req, "category.delete", "category", category._id, category.name);
    res.json({ message: "Category deleted" });
  } catch (error) {
    next(error);
  }
}

async function listReviews(req, res, next) {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const [items, total] = await Promise.all([
      Review.find(filter)
        .populate("customer", "name email avatar")
        .populate("provider", "displayName slug")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.countDocuments(filter),
    ]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)), limit });
  } catch (error) {
    next(error);
  }
}

async function moderateReview(req, res, next) {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) throw ApiError.notFound("Review not found");
    review.status = req.body.status;
    review.moderationNote = req.body.moderationNote || "";
    review.moderatedBy = req.user._id;
    await review.save();
    await recalculateProviderRating(review.provider);
    await recordAudit(
      req,
      "review.moderate",
      "review",
      review._id,
      `Status ${req.body.status}${req.body.moderationNote ? ` — ${req.body.moderationNote}` : ""}`
    );
    res.json({ review, message: "Review moderation saved" });
  } catch (error) {
    next(error);
  }
}

async function resolveTargets(reports) {
  const grouped = { user: [], provider: [], review: [], portfolio: [], service: [], message: [] };
  reports.forEach((report) => {
    if (grouped[report.targetType]) grouped[report.targetType].push(report.targetId);
  });
  const [users, providers, reviews, projects, services, messages] = await Promise.all([
    User.find({ _id: { $in: grouped.user } }).select("name email").lean(),
    ProviderProfile.find({ _id: { $in: grouped.provider } }).select("displayName slug").lean(),
    Review.find({ _id: { $in: grouped.review } }).select("comment rating provider").populate("provider", "displayName slug").lean(),
    PortfolioProject.find({ _id: { $in: grouped.portfolio } }).select("title slug").lean(),
    Service.find({ _id: { $in: grouped.service } }).select("title slug").lean(),
    Message.find({ _id: { $in: grouped.message } }).select("body system").lean(),
  ]);
  const map = new Map();
  users.forEach((doc) => map.set(`user:${doc._id}`, { label: `${doc.name} (${doc.email})`, link: null }));
  providers.forEach((doc) => map.set(`provider:${doc._id}`, { label: doc.displayName, link: `/providers/${doc.slug}` }));
  reviews.forEach((doc) =>
    map.set(`review:${doc._id}`, {
      label: `Review by ${doc.provider?.displayName || "provider"} · ${doc.rating}/5 · “${doc.comment.slice(0, 80)}”`,
      link: doc.provider ? `/providers/${doc.provider.slug}` : null,
    })
  );
  projects.forEach((doc) => map.set(`portfolio:${doc._id}`, { label: doc.title, link: `/portfolio/${doc.slug}` }));
  services.forEach((doc) => map.set(`service:${doc._id}`, { label: doc.title, link: `/services/${doc.slug}` }));
  messages.forEach((doc) =>
    map.set(`message:${doc._id}`, { label: doc.system ? "System message" : `Message: ${doc.body.slice(0, 100)}`, link: null })
  );
  return map;
}

async function listReports(req, res, next) {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const [reports, total] = await Promise.all([
      Report.find(filter)
        .populate("reporter", "name email avatar")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Report.countDocuments(filter),
    ]);
    const targetMap = await resolveTargets(reports);
    res.json({
      items: reports.map((report) => ({
        ...report,
        targetPreview: targetMap.get(`${report.targetType}:${report.targetId}`) || null,
      })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      limit,
    });
  } catch (error) {
    next(error);
  }
}

async function updateReport(req, res, next) {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) throw ApiError.notFound("Report not found");
    report.status = req.body.status;
    report.resolutionNote = req.body.resolutionNote || "";
    report.handledBy = req.user._id;
    await report.save();
    await recordAudit(
      req,
      "report.update",
      "report",
      report._id,
      `Status ${req.body.status}${req.body.resolutionNote ? ` — ${req.body.resolutionNote}` : ""}`
    );
    await createNotification(req.app, {
      user: report.reporter,
      type: "admin",
      title: "Your report was reviewed",
      message: `A moderator marked your report as ${req.body.status}.`,
      link: "/dashboard/notifications",
    });
    res.json({ report, message: "Report updated" });
  } catch (error) {
    next(error);
  }
}

async function listContactMessages(req, res, next) {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const [items, total] = await Promise.all([
      ContactMessage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ContactMessage.countDocuments(filter),
    ]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)), limit });
  } catch (error) {
    next(error);
  }
}

async function updateContactMessage(req, res, next) {
  try {
    const contact = await ContactMessage.findByIdAndUpdate(
      req.params.id,
      { $set: { status: req.body.status } },
      { new: true }
    );
    if (!contact) throw ApiError.notFound("Contact message not found");
    await recordAudit(req, "contact.status", "contact", contact._id, `Status ${req.body.status}`);
    res.json({ contact, message: "Contact message updated" });
  } catch (error) {
    next(error);
  }
}

async function listAuditLogs(req, res, next) {
  try {
    const { page, limit, skip } = getPagination({ ...req.query, limit: req.query.limit || 20 });
    const [items, total] = await Promise.all([
      AdminAuditLog.find()
        .populate("admin", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AdminAuditLog.countDocuments(),
    ]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)), limit });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  stats,
  listUsers,
  getUserDetail,
  updateUser,
  listProviders,
  updateProvider,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listReviews,
  moderateReview,
  listReports,
  updateReport,
  listContactMessages,
  updateContactMessage,
  listAuditLogs,
  userStatusSchema,
  providerAdminSchema,
  categorySchema,
  categoryUpdateSchema,
  reviewModerationSchema,
  reportUpdateSchema,
  contactStatusSchema,
};
