const { z } = require("zod");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Inquiry = require("../models/Inquiry");
const ApiError = require("../utils/ApiError");
const { createNotification } = require("../utils/notifications");
const { conversationAccess } = require("../utils/conversation");
const { accessibleProviderIds } = require("../utils/providerWorkspace");

const messageSchema = z.object({
  body: z.string().trim().min(1, "Write a message").max(5000),
});

async function listConversations(req, res, next) {
  try {
    let filter = { participants: req.user._id };
    if (req.user.role === "provider") {
      const providerIds = await accessibleProviderIds(req.user);
      if (providerIds.length) {
        const inquiryIds = await Inquiry.find({ provider: { $in: providerIds } }).distinct("_id");
        filter = {
          $or: [{ participants: req.user._id }, { inquiry: { $in: inquiryIds } }],
        };
      }
    }
    const conversations = await Conversation.find(filter)
      .populate("participants", "name avatar role")
      .populate("inquiry", "title status")
      .sort({ lastMessageAt: -1 })
      .limit(100)
      .lean();

    const ids = conversations.map((item) => item._id);
    const unreadRows = ids.length
      ? await Message.aggregate([
          {
            $match: {
              conversation: { $in: ids },
              sender: { $ne: req.user._id },
              readBy: { $ne: req.user._id },
            },
          },
          { $group: { _id: "$conversation", count: { $sum: 1 } } },
        ])
      : [];
    const unreadMap = new Map(unreadRows.map((row) => [String(row._id), row.count]));

    res.json({
      items: conversations.map((conversation) => ({
        ...conversation,
        unreadCount: unreadMap.get(String(conversation._id)) || 0,
        otherParticipants: (conversation.participants || []).filter(
          (participant) => String(participant._id) !== String(req.user._id)
        ),
      })),
    });
  } catch (error) {
    next(error);
  }
}

async function getConversation(req, res, next) {
  try {
    const conversation = await Conversation.findById(req.params.id)
      .populate("participants", "name avatar role")
      .populate("inquiry", "title status")
      .lean();
    if (!conversation) throw ApiError.notFound("Conversation not found");
    if (!(await conversationAccess(conversation, req.user))) {
      throw ApiError.forbidden("You do not have access to this conversation");
    }

    await Message.updateMany(
      {
        conversation: conversation._id,
        sender: { $ne: req.user._id },
        readBy: { $ne: req.user._id },
      },
      { $addToSet: { readBy: req.user._id } }
    );

    if (conversation.inquiry) {
      const inquiry = await Inquiry.findById(conversation.inquiry._id).select("customer providerUser");
      if (inquiry) {
        const update =
          String(inquiry.customer) === String(req.user._id)
            ? { customerReadAt: new Date() }
            : { providerReadAt: new Date() };
        await Inquiry.updateOne({ _id: inquiry._id }, { $set: update });
      }
    }

    const messages = await Message.find({ conversation: conversation._id })
      .populate("sender", "name avatar role")
      .sort({ createdAt: 1 })
      .limit(500)
      .lean();

    res.json({ conversation, messages });
  } catch (error) {
    next(error);
  }
}

async function sendMessage(req, res, next) {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) throw ApiError.notFound("Conversation not found");
    if (!(await conversationAccess(conversation, req.user))) {
      throw ApiError.forbidden("You do not have access to this conversation");
    }

    const message = await Message.create({
      conversation: conversation._id,
      sender: req.user._id,
      body: req.body.body,
      readBy: [req.user._id],
    });

    conversation.lastMessageText = req.body.body.slice(0, 240);
    conversation.lastMessageAt = new Date();
    conversation.lastMessageSender = req.user._id;
    await conversation.save();

    if (conversation.inquiry) {
      await Inquiry.updateOne({ _id: conversation.inquiry }, { $set: { lastActivityAt: new Date() } });
    }

    const others = conversation.participants.filter((participant) => String(participant) !== String(req.user._id));
    await Promise.all(
      others.map((participant) =>
        createNotification(req.app, {
          user: participant,
          type: "message",
          title: `New message from ${req.user.name}`,
          message: req.body.body.slice(0, 160),
          link: `/dashboard/messages/${conversation._id}`,
          meta: { conversationId: String(conversation._id) },
        })
      )
    );

    const io = req.app.get("io");
    if (io) {
      const populated = await Message.findById(message._id).populate("sender", "name avatar role").lean();
      io.to(`conversation:${conversation._id}`).emit("message:new", {
        conversationId: String(conversation._id),
        message: populated,
      });
      others.forEach((participant) => {
        io.to(`user:${participant}`).emit("conversation:updated", {
          conversationId: String(conversation._id),
        });
      });
    }

    res.status(201).json({ message });
  } catch (error) {
    next(error);
  }
}

module.exports = { listConversations, getConversation, sendMessage, messageSchema };
