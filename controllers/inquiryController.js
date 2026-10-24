const { z } = require("zod");
const Inquiry = require("../models/Inquiry");
const ProviderProfile = require("../models/ProviderProfile");
const Service = require("../models/Service");
const Category = require("../models/Category");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Proposal = require("../models/Proposal");
const Review = require("../models/Review");
const Upload = require("../models/Upload");
const ApiError = require("../utils/ApiError");
const { getPagination } = require("../utils/helpers");
const { inquiryAccess, providerSide } = require("../utils/inquiryAccess");
const { accessibleProviderIds } = require("../utils/providerWorkspace");
const { createNotification } = require("../utils/notifications");

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Select a valid option");

const inquirySchema = z
  .object({
    providerId: objectId,
    serviceId: z.union([objectId, z.literal(""), z.null()]).optional(),
    title: z.string().trim().min(5, "Give your project a clear title").max(160),
    description: z.string().trim().min(30, "Describe your project in at least 30 characters").max(6000),
    category: objectId,
    subcategory: z.union([objectId, z.literal(""), z.null()]).optional(),
    features: z.string().trim().max(3000).optional(),
    budgetMin: z.union([z.number().min(0), z.null()]).optional(),
    budgetMax: z.union([z.number().min(0), z.null()]).optional(),
    timeline: z.string().trim().max(200).optional(),
    referenceLinks: z.array(z.string().url("Enter valid reference URLs")).max(5).optional(),
    attachments: z
      .array(z.object({ uploadId: objectId, name: z.string().trim().max(200).optional() }))
      .max(3)
      .optional(),
    communicationPreference: z.enum(["in_app", "email", "video_call", "phone"]).default("in_app"),
  })
  .refine(
    (data) =>
      data.budgetMin == null || data.budgetMax == null || data.budgetMax >= data.budgetMin,
    { message: "Maximum budget must be at least the minimum budget", path: ["budgetMax"] }
  );

const statusSchema = z.object({
  status: z.enum(["in_discussion", "completed", "cancelled"]),
  note: z.string().trim().max(500).optional(),
});

function initialsMessage(text, conversation) {
  conversation.lastMessageText = text;
  conversation.lastMessageAt = new Date();
  conversation.lastMessageSender = null;
}

async function addSystemMessage(conversation, body, readBy = []) {
  if (!conversation) return;
  await Message.create({ conversation: conversation._id, body, system: true, readBy });
  initialsMessage(body, conversation);
  await conversation.save();
}

async function createInquiry(req, res, next) {
  try {
    const data = req.body;
    const provider = await ProviderProfile.findOne({ _id: data.providerId, status: "published" });
    if (!provider) throw ApiError.notFound("Provider not found or not available");
    if (String(provider.user) === String(req.user._id)) {
      throw ApiError.badRequest("You cannot send an inquiry to your own provider profile");
    }

    const category = await Category.findOne({ _id: data.category, isActive: true });
    if (!category) throw ApiError.badRequest("Choose a valid project category");
    if (category.parent) throw ApiError.badRequest("Choose a top-level category");

    let service = null;
    if (data.serviceId) {
      service = await Service.findOne({ _id: data.serviceId, provider: provider._id, status: "published" });
      if (!service) throw ApiError.badRequest("The selected service is not available");
    }
    let subcategory = null;
    if (data.subcategory) {
      subcategory = await Category.findOne({ _id: data.subcategory, isActive: true });
      if (!subcategory || String(subcategory.parent) !== String(category._id)) {
        throw ApiError.badRequest("Choose a subcategory that belongs to the selected category");
      }
    }

    const attachments = [];
    if (data.attachments?.length) {
      const uploadIds = data.attachments.map((item) => item.uploadId);
      const uploads = await Upload.find({ _id: { $in: uploadIds }, owner: req.user._id });
      if (uploads.length !== new Set(uploadIds).size) {
        throw ApiError.badRequest("One or more attachments are invalid");
      }
      data.attachments.forEach((item) => {
        const upload = uploads.find((file) => String(file._id) === String(item.uploadId));
        attachments.push({
          upload: upload._id,
          name: item.name || upload.originalName,
          mimeType: upload.mimeType,
          size: upload.size,
        });
      });
    }

    const inquiry = await Inquiry.create({
      customer: req.user._id,
      provider: provider._id,
      providerUser: provider.user,
      service: service ? service._id : null,
      title: data.title,
      description: data.description,
      category: category._id,
      subcategory: subcategory ? subcategory._id : null,
      features: data.features || "",
      budgetMin: data.budgetMin ?? null,
      budgetMax: data.budgetMax ?? null,
      timeline: data.timeline || "",
      referenceLinks: data.referenceLinks || [],
      attachments,
      communicationPreference: data.communicationPreference,
      status: "new",
      providerReadAt: null,
      customerReadAt: new Date(),
      lastActivityAt: new Date(),
    });

    const conversation = await Conversation.create({
      inquiry: inquiry._id,
      participants: [req.user._id, provider.user],
      lastMessageText: "Inquiry submitted",
      lastMessageAt: new Date(),
      lastMessageSender: req.user._id,
    });
    await addSystemMessage(
      conversation,
      `Inquiry “${inquiry.title}” was submitted to ${provider.displayName}.`,
      [req.user._id]
    );

    await Promise.all([
      ProviderProfile.updateOne({ _id: provider._id }, { $inc: { inquiriesCount: 1 } }),
      createNotification(req.app, {
        user: provider.user,
        type: "inquiry",
        title: `New inquiry from ${req.user.name}`,
        message: inquiry.title,
        link: `/dashboard/inquiries/${inquiry._id}`,
        meta: { inquiryId: String(inquiry._id) },
      }),
    ]);

    res.status(201).json({ inquiry, conversationId: conversation._id, message: "Inquiry sent to the provider" });
  } catch (error) {
    next(error);
  }
}

async function listInquiries(req, res, next) {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};
    if (req.user.role === "admin") {
      if (req.query.customer) filter.customer = req.query.customer;
    } else if (req.user.role === "provider") {
      const providerIds = await accessibleProviderIds(req.user);
      filter.provider = { $in: providerIds };
    } else {
      filter.customer = req.user._id;
    }
    if (req.query.status) {
      const statuses = String(req.query.status).split(",").filter(Boolean);
      filter.status = { $in: statuses };
    }
    if (req.query.q) {
      const q = String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.title = new RegExp(q, "i");
    }

    const [items, total] = await Promise.all([
      Inquiry.find(filter)
        .select(
          "title description status budgetMin budgetMax timeline createdAt lastActivityAt provider customer providerReadAt customerReadAt"
        )
        .populate("provider", "displayName slug avatar type ratingAvg ratingCount")
        .populate("customer", "name email avatar")
        .sort({ lastActivityAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Inquiry.countDocuments(filter),
    ]);

    const ids = items.map((item) => item._id);
    const [proposals, conversations] = await Promise.all([
      ids.length ? Proposal.find({ inquiry: { $in: ids } }).select("inquiry status estimatedCost currency").lean() : [],
      ids.length ? Conversation.find({ inquiry: { $in: ids } }).select("inquiry lastMessageAt").lean() : [],
    ]);
    const proposalMap = new Map(proposals.map((proposal) => [String(proposal.inquiry), proposal]));
    const conversationMap = new Map(conversations.map((item) => [String(item.inquiry), item]));

    res.json({
      items: items.map((item) => ({
        ...item,
        proposal: proposalMap.get(String(item._id)) || null,
        conversationId: conversationMap.get(String(item._id))?._id || null,
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

async function getInquiry(req, res, next) {
  try {
    const inquiry = await Inquiry.findById(req.params.id)
      .populate("provider", "displayName slug avatar type ratingAvg ratingCount user")
      .populate("customer", "name email avatar")
      .populate("category", "name slug icon")
      .populate("subcategory", "name slug icon")
      .populate("service", "title slug startingPrice currency");
    if (!inquiry) throw ApiError.notFound("Inquiry not found");
    const access = await inquiryAccess(inquiry, req.user);
    if (!access) throw ApiError.forbidden("You do not have access to this inquiry");

    const update = {};
    if (access === "provider") update.providerReadAt = new Date();
    if (access === "customer") update.customerReadAt = new Date();
    if (Object.keys(update).length) {
      await Inquiry.updateOne({ _id: inquiry._id }, { $set: update });
      Object.assign(inquiry, update);
    }

    const [proposal, conversation, review] = await Promise.all([
      Proposal.findOne({ inquiry: inquiry._id }).lean(),
      Conversation.findOne({ inquiry: inquiry._id }).select("_id lastMessageAt").lean(),
      Review.findOne({ inquiry: inquiry._id }).select("rating comment createdAt").lean(),
    ]);

    res.json({
      inquiry,
      proposal,
      conversationId: conversation ? conversation._id : null,
      review: review || null,
      access,
      canReview: access === "customer" && inquiry.status === "completed" && !review,
    });
  } catch (error) {
    next(error);
  }
}

async function updateStatus(req, res, next) {
  try {
    const inquiry = await Inquiry.findById(req.params.id);
    if (!inquiry) throw ApiError.notFound("Inquiry not found");
    const access = await inquiryAccess(inquiry, req.user);
    if (!access) throw ApiError.forbidden("You do not have access to this inquiry");

    const { status, note } = req.body;
    let message = "";
    let notifyUser = null;
    let notifyTitle = "";

    if (status === "in_discussion") {
      if (!providerSide(access)) throw ApiError.forbidden("Only the provider can start a discussion");
      if (inquiry.status !== "new") throw ApiError.badRequest("This inquiry is not waiting for a provider response");
      inquiry.status = "in_discussion";
      message = `${req.user.name} opened the discussion.`;
      notifyUser = inquiry.customer;
      notifyTitle = "Your inquiry is in discussion";
    } else if (status === "completed") {
      if (access !== "customer") throw ApiError.forbidden("Only the customer can mark a project complete");
      if (inquiry.status !== "accepted") throw ApiError.badRequest("Only an accepted engagement can be completed");
      inquiry.status = "completed";
      inquiry.completedAt = new Date();
      await ProviderProfile.updateOne({ _id: inquiry.provider }, { $inc: { completedProjects: 1 } });
      message = "The customer marked this engagement complete. The customer can now leave a review.";
      notifyUser = inquiry.providerUser;
      notifyTitle = "Engagement marked complete";
    } else if (status === "cancelled") {
      if (!["new", "in_discussion", "proposal_sent", "accepted"].includes(inquiry.status)) {
        throw ApiError.badRequest("This inquiry can no longer be cancelled");
      }
      inquiry.status = "cancelled";
      inquiry.cancelledAt = new Date();
      await Proposal.updateOne({ inquiry: inquiry._id, status: "sent" }, { $set: { status: "withdrawn" } });
      message = `The inquiry was cancelled by ${access === "customer" ? "the customer" : "the provider"}.`;
      notifyUser = access === "customer" ? inquiry.providerUser : inquiry.customer;
      notifyTitle = "An inquiry was cancelled";
    } else {
      throw ApiError.badRequest("Unsupported status update");
    }

    inquiry.lastActivityAt = new Date();
    if (access === "provider") inquiry.providerReadAt = new Date();
    if (access === "customer") inquiry.customerReadAt = new Date();
    await inquiry.save();

    const conversation = await Conversation.findOne({ inquiry: inquiry._id });
    if (conversation) {
      await addSystemMessage(conversation, note ? `${message} Note: ${note}` : message);
    }
    if (notifyUser) {
      await createNotification(req.app, {
        user: notifyUser,
        type: "status",
        title: notifyTitle,
        message: inquiry.title,
        link: `/dashboard/inquiries/${inquiry._id}`,
        meta: { inquiryId: String(inquiry._id), status: inquiry.status },
      });
    }
    if (conversation && req.app.get("io")) {
      req.app.get("io").to(`conversation:${conversation._id}`).emit("conversation:updated", {
        conversationId: String(conversation._id),
      });
    }

    res.json({ inquiry, message: "Inquiry updated" });
  } catch (error) {
    next(error);
  }
}

async function startConversation(req, res, next) {
  try {
    const inquiry = await Inquiry.findById(req.params.id);
    if (!inquiry) throw ApiError.notFound("Inquiry not found");
    const access = await inquiryAccess(inquiry, req.user);
    if (!access) throw ApiError.forbidden("You do not have access to this inquiry");
    let conversation = await Conversation.findOne({ inquiry: inquiry._id });
    if (!conversation) {
      conversation = await Conversation.create({
        inquiry: inquiry._id,
        participants: [inquiry.customer, inquiry.providerUser],
        lastMessageAt: new Date(),
        lastMessageText: "Conversation started",
      });
    }
    res.json({ conversationId: conversation._id });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createInquiry,
  listInquiries,
  getInquiry,
  updateStatus,
  startConversation,
  inquirySchema,
  statusSchema,
  addSystemMessage,
};
