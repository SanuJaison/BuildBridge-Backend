const jwt = require("jsonwebtoken");
const env = require("../config/env");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const { resolveProviderWorkspace } = require("../utils/providerWorkspace");

function extractToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  if (req.cookies && req.cookies[env.cookieName]) return req.cookies[env.cookieName];
  return null;
}

async function resolveUser(token) {
  const payload = jwt.verify(token, env.jwtSecret);
  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized("Your account could not be found");
  if (user.status === "suspended") {
    throw ApiError.forbidden("This account is suspended. Contact support for assistance.");
  }
  return user;
}

async function optionalAuth(req, _res, next) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    req.user = await resolveUser(token);
    req.authToken = token;
  } catch {
    // Public endpoints remain accessible with an invalid or expired session.
  }
  next();
}

async function requireAuth(req, _res, next) {
  try {
    if (req.user) return next();
    const token = extractToken(req);
    if (!token) throw ApiError.unauthorized("Sign in to continue");
    req.user = await resolveUser(token);
    req.authToken = token;
    next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    return next(ApiError.unauthorized("Your session has expired. Please sign in again."));
  }
}

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized("Sign in to continue"));
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden("Your account does not have access to this area"));
    }
    next();
  };
}

async function requireProvider(req, _res, next) {
  try {
    if (!req.user) throw ApiError.unauthorized("Sign in to continue");
    const workspace = await resolveProviderWorkspace(req.user);
    if (!workspace) {
      throw ApiError.forbidden("Create a provider profile or join an organization workspace before using provider tools");
    }
    if (workspace.provider.status === "suspended") {
      throw ApiError.forbidden("This provider profile is suspended");
    }
    req.provider = workspace.provider;
    req.providerMembership = workspace.membership;
    req.providerIsOwner = workspace.isOwner;
    next();
  } catch (error) {
    next(error);
  }
}

function requireAdmin(req, _res, next) {
  if (!req.user) return next(ApiError.unauthorized("Sign in to continue"));
  if (req.user.role !== "admin") return next(ApiError.forbidden("Administrator access required"));
  next();
}

module.exports = { optionalAuth, requireAuth, requireRole, requireProvider, requireAdmin, extractToken };
