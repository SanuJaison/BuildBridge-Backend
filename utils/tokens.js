const jwt = require("jsonwebtoken");
const env = require("../config/env");

function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

function setAuthCookie(res, token) {
  res.cookie(env.cookieName, token, cookieOptions());
}

function clearAuthCookie(res) {
  res.clearCookie(env.cookieName, { ...cookieOptions(), maxAge: undefined });
}

module.exports = { signToken, verifyToken, setAuthCookie, clearAuthCookie };
