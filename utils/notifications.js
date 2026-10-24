const Notification = require("../models/Notification");

async function createNotification(app, payload) {
  const { user, type = "system", title, message = "", link = "", meta = {} } = payload;
  const notification = await Notification.create({ user, type, title, message, link, meta });
  const io = app && app.get ? app.get("io") : null;
  if (io) {
    io.to(`user:${String(user)}`).emit("notification:new", notification.toJSON());
  }
  return notification;
}

module.exports = { createNotification };
