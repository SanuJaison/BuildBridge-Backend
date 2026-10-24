const { z } = require("zod");
const Inquiry = require("../models/Inquiry");
const Proposal = require("../models/Proposal");
const Conversation = require("../models/Conversation");
const ProviderProfile = require("../models/ProviderProfile");
const ApiError = require("../utils/ApiError");
const { inquiryAccess } = require("../utils/inquiryAccess");
const { createNotification } = require("../utils/notifications");
const { addSystemMessage } = require("../utils/conversation");

const proposalSchema = z.object({
  message: z.string().trim().min(20, "Write at least 20 characters").max(4000),
  estimatedCost: z.number().min(0),
  currency: z.string().trim().length(3).optional(),
  timelineDays: z.number().int().min(1).max(730),
  deliverables: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  assumptions: z.string().trim().max(2000).optional(),
  validUntil: z.union([z.string(), z.null()]).optional(),
});

async function notifyCustomer(req, inquiry, title, message, proposal) {
  await createNotification(req.app, {
    user: inquiry.customer,
    type: "proposal",
    title,
    message,
    link: `/dashboard/inquiries/${inquiry._id}`,
    meta: { inquiryId: String(inquiry._id), proposalId: String(proposal._id) },
  });
}

async function createOrResendProposal(req, res, next) {
  try {
    const inquiry = await Inquiry.findById(req.params.id);
    if (!inquiry) throw ApiError.notFound("Inquiry not found");
    const access = await inquiryAccess(inquiry, req.user);
    if (access !== "provider") throw ApiError.forbidden("Only the receiving provider can send a proposal");
    if (!["new", "in_discussion"].includes(inquiry.status)) {
      throw ApiError.badRequest("A proposal cannot be sent while this inquiry is in its current state");
    }
    const provider = await ProviderProfile.findById(inquiry.provider);
    if (!provider || provider.status !== "published") {
      throw ApiError.badRequest("Publish your provider profile before sending proposals");
    }

    const data = req.body;
    const existing = await Proposal.findOne({ inquiry: inquiry._id });
    if (existing && existing.status !== "withdrawn") {
      throw ApiError.conflict(
        existing.status === "sent"
          ? "A proposal is already waiting for the customer"
          : `This proposal is already ${existing.status}`
      );
    }

    let proposal;
    if (existing) {
      Object.assign(existing, {
        message: data.message,
        estimatedCost: data.estimatedCost,
        currency: data.currency || "USD",
        timelineDays: data.timelineDays,
        deliverables: data.deliverables || [],
        assumptions: data.assumptions || "",
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        status: "sent",
      });
      proposal = await existing.save();
    } else {
      proposal = await Proposal.create({
        inquiry: inquiry._id,
        provider: provider._id,
        providerUser: req.user._id,
        customer: inquiry.customer,
        message: data.message,
        estimatedCost: data.estimatedCost,
        currency: data.currency || "USD",
        timelineDays: data.timelineDays,
        deliverables: data.deliverables || [],
        assumptions: data.assumptions || "",
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        status: "sent",
      });
    }

    inquiry.status = "proposal_sent";
    inquiry.providerReadAt = new Date();
    inquiry.lastActivityAt = new Date();
    await inquiry.save();

    const conversation = await Conversation.findOne({ inquiry: inquiry._id });
    await addSystemMessage(
      conversation,
      `A proposal was sent: $${data.estimatedCost.toLocaleString()} over ${data.timelineDays} days. Acceptance does not process payment.`
    );
    await notifyCustomer(
      req,
      inquiry,
      "New proposal received",
      `${provider.displayName} sent a proposal for “${inquiry.title}”.`,
      proposal
    );
    if (conversation && req.app.get("io")) {
      req.app.get("io").to(`conversation:${conversation._id}`).emit("conversation:updated", {
        conversationId: String(conversation._id),
      });
    }

    res.status(201).json({ proposal, message: existing ? "Proposal sent again" : "Proposal sent" });
  } catch (error) {
    next(error);
  }
}

async function updateProposal(req, res, next) {
  try {
    const proposal = await Proposal.findById(req.params.id);
    if (!proposal) throw ApiError.notFound("Proposal not found");
    const inquiry = await Inquiry.findById(proposal.inquiry);
    if (!inquiry) throw ApiError.notFound("Inquiry not found");
    const access = await inquiryAccess(inquiry, req.user);
    if (access !== "provider") throw ApiError.forbidden("Only the provider can update this proposal");
    if (proposal.status !== "sent") throw ApiError.badRequest("Only proposals awaiting a response can be updated");

    Object.assign(proposal, req.body);
    if (req.body.validUntil !== undefined) {
      proposal.validUntil = req.body.validUntil ? new Date(req.body.validUntil) : null;
    }
    await proposal.save();

    inquiry.lastActivityAt = new Date();
    await inquiry.save();
    const conversation = await Conversation.findOne({ inquiry: inquiry._id });
    await addSystemMessage(conversation, "The provider updated their proposal.");
    await notifyCustomer(req, inquiry, "Proposal updated", `The proposal for “${inquiry.title}” was updated.`, proposal);

    res.json({ proposal, message: "Proposal updated" });
  } catch (error) {
    next(error);
  }
}

async function acceptProposal(req, res, next) {
  try {
    const proposal = await Proposal.findById(req.params.id);
    if (!proposal) throw ApiError.notFound("Proposal not found");
    const inquiry = await Inquiry.findById(proposal.inquiry);
    if (!inquiry) throw ApiError.notFound("Inquiry not found");
    const access = await inquiryAccess(inquiry, req.user);
    if (access !== "customer") throw ApiError.forbidden("Only the customer can accept this proposal");
    if (proposal.status !== "sent") throw ApiError.badRequest("This proposal is no longer awaiting a response");
    if (inquiry.status !== "proposal_sent") throw ApiError.badRequest("This inquiry is not awaiting a proposal decision");

    proposal.status = "accepted";
    inquiry.status = "accepted";
    inquiry.lastActivityAt = new Date();
    inquiry.providerReadAt = new Date();
    await Promise.all([proposal.save(), inquiry.save()]);

    const conversation = await Conversation.findOne({ inquiry: inquiry._id });
    await addSystemMessage(
      conversation,
      "The customer accepted the proposal. This records an agreement in principle; it is not a payment confirmation or a legal contract."
    );
    await createNotification(req.app, {
      user: proposal.providerUser,
      type: "proposal",
      title: "Proposal accepted",
      message: `Your proposal for “${inquiry.title}” was accepted.`,
      link: `/dashboard/inquiries/${inquiry._id}`,
    });
    if (conversation && req.app.get("io")) {
      req.app.get("io").to(`conversation:${conversation._id}`).emit("conversation:updated", {
        conversationId: String(conversation._id),
      });
    }

    res.json({ proposal, inquiry, message: "Proposal accepted" });
  } catch (error) {
    next(error);
  }
}

async function declineProposal(req, res, next) {
  try {
    const proposal = await Proposal.findById(req.params.id);
    if (!proposal) throw ApiError.notFound("Proposal not found");
    const inquiry = await Inquiry.findById(proposal.inquiry);
    if (!inquiry) throw ApiError.notFound("Inquiry not found");
    const access = await inquiryAccess(inquiry, req.user);
    if (access !== "customer") throw ApiError.forbidden("Only the customer can decline this proposal");
    if (proposal.status !== "sent") throw ApiError.badRequest("This proposal is no longer awaiting a response");

    proposal.status = "declined";
    inquiry.status = "declined";
    inquiry.lastActivityAt = new Date();
    inquiry.providerReadAt = new Date();
    await Promise.all([proposal.save(), inquiry.save()]);

    const conversation = await Conversation.findOne({ inquiry: inquiry._id });
    await addSystemMessage(conversation, "The customer declined the proposal. The conversation remains available.");
    await createNotification(req.app, {
      user: proposal.providerUser,
      type: "proposal",
      title: "Proposal declined",
      message: `The proposal for “${inquiry.title}” was declined.`,
      link: `/dashboard/inquiries/${inquiry._id}`,
    });

    res.json({ proposal, inquiry, message: "Proposal declined" });
  } catch (error) {
    next(error);
  }
}

async function withdrawProposal(req, res, next) {
  try {
    const proposal = await Proposal.findById(req.params.id);
    if (!proposal) throw ApiError.notFound("Proposal not found");
    const inquiry = await Inquiry.findById(proposal.inquiry);
    if (!inquiry) throw ApiError.notFound("Inquiry not found");
    const access = await inquiryAccess(inquiry, req.user);
    if (access !== "provider") throw ApiError.forbidden("Only the provider can withdraw this proposal");
    if (proposal.status !== "sent") throw ApiError.badRequest("Only a sent proposal can be withdrawn");

    proposal.status = "withdrawn";
    inquiry.status = "in_discussion";
    inquiry.lastActivityAt = new Date();
    inquiry.customerReadAt = new Date();
    await Promise.all([proposal.save(), inquiry.save()]);

    const conversation = await Conversation.findOne({ inquiry: inquiry._id });
    await addSystemMessage(conversation, "The provider withdrew the proposal. The inquiry is back in discussion.");
    await notifyCustomer(req, inquiry, "Proposal withdrawn", `The proposal for “${inquiry.title}” was withdrawn.`, proposal);

    res.json({ proposal, inquiry, message: "Proposal withdrawn" });
  } catch (error) {
    next(error);
  }
}

const proposalUpdateSchema = proposalSchema.partial();

module.exports = {
  createOrResendProposal,
  updateProposal,
  acceptProposal,
  declineProposal,
  withdrawProposal,
  proposalSchema,
  proposalUpdateSchema,
};
