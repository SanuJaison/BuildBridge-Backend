const Notification = require("../models/Notification");
const ApiError = require("../utils/ApiError");
const { getPagination } = require("../utils/helpers");

async function listNotifications(req, res, next) {
  try {
    const { page, limit, skip } = getPagination({ ...req.query, limit: req.query.limit || 20 });
    const filter = { user: req.user._id };
    if (req.query.unread === "true") filter.readAt = null;
    const [items, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ user: req.user._id, readAt: null }),
    ]);
    res.json({ items, total, unreadCount, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) {
    next(error);
  }
}

async function markRead(req, res, next) {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { $set: { readAt: new Date() } },
      { new: true }
    );
    if (!notification) throw ApiError.notFound("Notification not found");
    res.json({ notification });
  } catch (error) {
    next(error);
  }
}

async function markAllRead(req, res, next) {
  try {
    await Notification.updateMany({ user: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    next(error);
  }
}

module.exports = { listNotifications, markRead, markAllRead };
