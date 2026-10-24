const { z } = require("zod");
const Report = require("../models/Report");
const User = require("../models/User");
const ProviderProfile = require("../models/ProviderProfile");
const Review = require("../models/Review");
const PortfolioProject = require("../models/PortfolioProject");
const Service = require("../models/Service");
const Message = require("../models/Message");
const ContactMessage = require("../models/ContactMessage");
const ApiError = require("../utils/ApiError");
const { createNotification } = require("../utils/notifications");

const reportSchema = z.object({
  targetType: z.enum(["user", "provider", "review", "portfolio", "service", "message"]),
  targetId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid report target"),
  reason: z.string().trim().min(3, "Choose or write a reason").max(200),
  details: z.string().trim().max(2000).optional(),
});

const TARGET_MODELS = {
  user: User,
  provider: ProviderProfile,
  review: Review,
  portfolio: PortfolioProject,
  service: Service,
  message: Message,
};

async function createReport(req, res, next) {
  try {
    const { targetType, targetId, reason, details } = req.body;
    const exists = await TARGET_MODELS[targetType].exists({ _id: targetId });
    if (!exists) throw ApiError.notFound("The reported item could not be found");
    const duplicate = await Report.findOne({
      reporter: req.user._id,
      targetType,
      targetId,
      status: { $in: ["open", "reviewing"] },
    });
    if (duplicate) throw ApiError.conflict("You already have an open report for this item");

    const report = await Report.create({
      reporter: req.user._id,
      targetType,
      targetId,
      reason,
      details: details || "",
    });
    res.status(201).json({ report, message: "Report submitted for administrator review" });
  } catch (error) {
    next(error);
  }
}

const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  subject: z.string().trim().min(3, "Give your message a subject").max(160),
  message: z.string().trim().min(20, "Write at least 20 characters").max(3000),
});

async function submitContact(req, res, next) {
  try {
    const contact = await ContactMessage.create(req.body);
    const admins = await User.find({ role: "admin", status: "active" }).select("_id").lean();
    await Promise.all(
      admins.map((admin) =>
        createNotification(req.app, {
          user: admin._id,
          type: "admin",
          title: "New contact message",
          message: `${req.body.name} · ${req.body.subject}`,
          link: "/admin/messages",
        })
      )
    );
    res.status(201).json({ message: "Message sent. The BuildBridge team will follow up by email." });
  } catch (error) {
    next(error);
  }
}

module.exports = { createReport, submitContact, reportSchema, contactSchema };
