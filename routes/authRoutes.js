const express = require("express");
const auth = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { authLimiter } = require("../middleware/rateLimits");

const router = express.Router();

router.post("/register", authLimiter, validate(auth.registerSchema), auth.register);
router.post("/login", authLimiter, validate(auth.loginSchema), auth.login);
router.post("/logout", auth.logout);
router.post("/forgot-password", authLimiter, validate(auth.forgotSchema), auth.forgotPassword);
router.post("/reset-password", authLimiter, validate(auth.resetSchema), auth.resetPassword);
router.get("/me", requireAuth, auth.me);
router.put("/me", requireAuth, validate(auth.updateMeSchema), auth.updateMe);
router.put("/password", requireAuth, validate(auth.changePasswordSchema), auth.changePassword);

module.exports = router;
