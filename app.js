const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const env = require("./config/env");
const { generalLimiter } = require("./middleware/rateLimits");
const { notFoundHandler, errorHandler } = require("./middleware/error");
const ApiError = require("./utils/ApiError");

const authRoutes = require("./routes/authRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const providerRoutes = require("./routes/providerRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const projectRoutes = require("./routes/projectRoutes");
const marketplaceRoutes = require("./routes/marketplaceRoutes");
const inquiryRoutes = require("./routes/inquiryRoutes");
const proposalRoutes = require("./routes/proposalRoutes");
const conversationRoutes = require("./routes/conversationRoutes");
const favoriteRoutes = require("./routes/favoriteRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const reportRoutes = require("./routes/reportRoutes");
const contactRoutes = require("./routes/contactRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const providerDashboardRoutes = require("./routes/providerDashboardRoutes");
const teamRoutes = require("./routes/teamRoutes");
const adminRoutes = require("./routes/adminRoutes");
const settingsRoutes = require("./routes/settingsRoutes");

function allowedOrigin(origin) {
  if (!origin) return true;
  if (env.clientUrls.includes(origin)) return true;
  if (!env.isProduction && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return true;
  return false;
}

function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: false,
    })
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (allowedOrigin(origin)) return callback(null, true);
        return callback(new ApiError(403, "This origin is not allowed to access the API"));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));
  app.use(cookieParser());
  app.use("/static", express.static(env.publicDir, { maxAge: "7d", fallthrough: true }));
  app.use("/api", generalLimiter);

  app.get("/", (_req, res) => {
    res.json({
      service: "BuildBridge API",
      version: "1.0.0",
      docs: "See README.md for endpoint documentation",
      health: "/api/health",
    });
  });

  app.get("/api/health", (_req, res) => {
    const connected = mongoose.connection.readyState === 1;
    res.status(connected ? 200 : 503).json({
      status: connected ? "ok" : "degraded",
      database: connected ? "connected" : "disconnected",
      service: "BuildBridge API",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/categories", categoryRoutes);
  app.use("/api/providers", providerRoutes);
  app.use("/api/services", serviceRoutes);
  app.use("/api/portfolio", projectRoutes);
  app.use("/api/marketplace", marketplaceRoutes);
  app.use("/api/inquiries", inquiryRoutes);
  app.use("/api/proposals", proposalRoutes);
  app.use("/api/conversations", conversationRoutes);
  app.use("/api/favorites", favoriteRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/reviews", reviewRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/contact", contactRoutes);
  app.use("/api/uploads", uploadRoutes);
  app.use("/api/provider", providerDashboardRoutes);
  app.use("/api/team", teamRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/settings", settingsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp, allowedOrigin };
