const rateLimit = require("express-rate-limit");
const env = require("../config/env");

const shared = {
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => env.isTest,
};

const generalLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 1200,
  message: { message: "Too many requests. Please slow down and try again shortly." },
});

const authLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 40,
  message: { message: "Too many authentication attempts. Please wait 15 minutes." },
});

const writeLimiter = rateLimit({
  ...shared,
  windowMs: 10 * 60 * 1000,
  limit: 200,
  message: { message: "You are sending requests too quickly. Please try again shortly." },
});

const publicFormLimiter = rateLimit({
  ...shared,
  windowMs: 60 * 60 * 1000,
  limit: 15,
  message: { message: "Too many submissions. Please try again later." },
});

module.exports = { generalLimiter, authLimiter, writeLimiter, publicFormLimiter };
