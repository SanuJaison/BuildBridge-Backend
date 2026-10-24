const jwt = require("jsonwebtoken");
const env = require("./config/env");
const User = require("./models/User");
const Conversation = require("./models/Conversation");
const { conversationAccess } = require("./utils/conversation");

function readCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function configureSockets(io) {
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers.authorization || "").replace(/^Bearer\s+/i, "") ||
        readCookie(socket.handshake.headers.cookie, env.cookieName);
      if (!token) throw new Error("Missing token");
      const payload = jwt.verify(token, env.jwtSecret);
      const user = await User.findById(payload.sub).select("name role status");
      if (!user || user.status !== "active") throw new Error("Account unavailable");
      socket.user = user;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${String(socket.user._id)}`);

    socket.on("conversation:join", async (conversationId, acknowledge) => {
      try {
        if (!/^[a-f\d]{24}$/i.test(String(conversationId || ""))) {
          return acknowledge?.({ error: "Invalid conversation" });
        }
        const conversation = await Conversation.findById(conversationId).select("_id participants inquiry");
        if (!conversation) return acknowledge?.({ error: "You do not have access to this conversation" });
        if (!(await conversationAccess(conversation, socket.user))) {
          return acknowledge?.({ error: "You do not have access to this conversation" });
        }
        socket.join(`conversation:${conversation._id}`);
        acknowledge?.({ ok: true });
      } catch {
        acknowledge?.({ error: "Unable to join conversation" });
      }
    });

    socket.on("conversation:leave", (conversationId) => {
      if (/^[a-f\d]{24}$/i.test(String(conversationId || ""))) {
        socket.leave(`conversation:${conversationId}`);
      }
    });
  });
}

module.exports = { configureSockets };
