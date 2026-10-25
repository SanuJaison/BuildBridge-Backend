const { z } = require("zod");
const User = require("../models/User");
const ProviderProfile = require("../models/ProviderProfile");
const { PROVIDER_ROLE_VALUES, primaryRoleFor } = require("../config/providerRoles");
const Organization = require("../models/Organization");
const OrganizationMember = require("../models/OrganizationMember");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");
const { signToken, setAuthCookie, clearAuthCookie } = require("../utils/tokens");
const { getAccount } = require("../utils/account");
const { hashToken, randomToken, uniqueSlug } = require("../utils/helpers");

const PROVIDER_TYPES = ["freelancer", "developer", "company", "agency", "studio"];
const ORGANIZATION_TYPES = ["company", "agency", "studio"];

const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name").max(80),
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters").max(100),
    role: z.enum(["customer", "provider"]).default("customer"),
    providerType: z.enum(PROVIDER_TYPES).optional(),
    roles: z.array(z.enum(PROVIDER_ROLE_VALUES)).max(4).optional(),
    primaryRole: z.enum(PROVIDER_ROLE_VALUES).optional(),
    companyName: z.string().trim().max(140).optional(),
    joinTeam: z.boolean().optional().default(false),
  })
  .refine((data) => data.role === "provider" || !data.joinTeam, {
    message: "Only provider accounts can join a team",
    path: ["joinTeam"],
  })
  .refine((data) => data.role !== "provider" || data.joinTeam || data.providerType, {
    message: "Choose the type of provider account you need",
    path: ["providerType"],
  });

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

const updateMeSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().max(30).optional(),
  company: z.string().trim().max(120).optional(),
  location: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(600).optional(),
  website: z.string().trim().max(300).optional(),
  avatar: z.string().trim().max(1000).optional(),
  emailNotifications: z.boolean().optional(),
});

async function register(req, res, next) {
  let user;
  try {
    const data = req.body;
    const existing = await User.findOne({ email: data.email });
    if (existing) throw ApiError.conflict("An account with that email already exists");

    user = await User.create({
      name: data.name,
      email: data.email,
      password: data.password,
      role: data.role,
    });

    let providerProfile = null;
    if (data.role === "provider" && !data.joinTeam) {
      const isOrganization = ORGANIZATION_TYPES.includes(data.providerType);
      const displayName = isOrganization ? data.companyName || data.name : data.name;
      const slug = await uniqueSlug(ProviderProfile, displayName);

      let organization = null;
      if (isOrganization) {
        organization = await Organization.create({
          name: displayName,
          slug: await uniqueSlug(Organization, displayName),
          owner: user._id,
        });
        await OrganizationMember.create({
          organization: organization._id,
          user: user._id,
          role: "owner",
          status: "active",
          joinedAt: new Date(),
        });
      }

      const roles = [...new Set(data.roles || [])];
      providerProfile = await ProviderProfile.create({
        user: user._id,
        type: data.providerType,
        roles,
        primaryRole: roles.includes(data.primaryRole) ? data.primaryRole : primaryRoleFor(roles),
        displayName,
        slug,
        organization: organization ? organization._id : null,
      });
    }

    const token = signToken(user);
    setAuthCookie(res, token);
    const payload = await getAccount(user);
    res.status(201).json({ ...payload, token, nextStep: data.role === "provider" ? "provider-onboarding" : "discovery" });
  } catch (error) {
    if (user) {
      await Promise.allSettled([
        ProviderProfile.deleteOne({ user: user._id }),
        OrganizationMember.deleteMany({ user: user._id }),
        Organization.deleteMany({ owner: user._id }),
      ]);
      await User.deleteOne({ _id: user._id });
    }
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+password");
    if (!user) throw ApiError.unauthorized("Email or password is incorrect");
    const matches = await user.comparePassword(password);
    if (!matches) throw ApiError.unauthorized("Email or password is incorrect");
    if (user.status === "suspended") {
      throw ApiError.forbidden("This account is suspended. Contact support for assistance.");
    }

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user);
    setAuthCookie(res, token);
    res.json({ ...(await getAccount(user)), token });
  } catch (error) {
    next(error);
  }
}

async function logout(_req, res) {
  clearAuthCookie(res);
  res.json({ message: "Signed out" });
}

async function me(req, res, next) {
  try {
    res.json(await getAccount(req.user));
  } catch (error) {
    next(error);
  }
}

async function updateMe(req, res, next) {
  try {
    const allowed = ["name", "phone", "company", "location", "bio", "website", "avatar", "emailNotifications"];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) req.user[field] = req.body[field];
    });
    await req.user.save();
    res.json(await getAccount(req.user));
  } catch (error) {
    next(error);
  }
}

async function changePassword(req, res, next) {
  try {
    const user = await User.findById(req.user._id).select("+password");
    const matches = await user.comparePassword(req.body.currentPassword);
    if (!matches) throw ApiError.badRequest("Your current password is incorrect");
    if (req.body.currentPassword === req.body.newPassword) {
      throw ApiError.badRequest("Choose a password different from your current one");
    }
    user.password = req.body.newPassword;
    await user.save();
    const token = signToken(user);
    setAuthCookie(res, token);
    res.json({ message: "Password updated", token });
  } catch (error) {
    next(error);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const user = await User.findOne({ email: req.body.email });
    let devResetToken;
    if (user) {
      const token = randomToken(32);
      user.resetPasswordHash = hashToken(token);
      user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
      await user.save({ validateBeforeSave: false });
      if (!env.isProduction) devResetToken = token;
    }
    res.json({
      message: "If an account matches that email, password reset instructions are on their way.",
      ...(devResetToken ? { devResetToken } : {}),
    });
  } catch (error) {
    next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    const user = await User.findOne({
      resetPasswordHash: hashToken(req.body.token),
      resetPasswordExpires: { $gt: new Date() },
    }).select("+resetPasswordHash +resetPasswordExpires");
    if (!user) throw ApiError.badRequest("This reset link is invalid or has expired");
    user.password = req.body.password;
    user.resetPasswordHash = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    clearAuthCookie(res);
    res.json({ message: "Password reset. You can now sign in." });
  } catch (error) {
    next(error);
  }
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(100),
});

const forgotSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});

const resetSchema = z.object({
  token: z.string().min(10, "Enter the reset token"),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
});

module.exports = {
  register,
  login,
  logout,
  me,
  updateMe,
  changePassword,
  forgotPassword,
  resetPassword,
  registerSchema,
  loginSchema,
  updateMeSchema,
  changePasswordSchema,
  forgotSchema,
  resetSchema,
  PROVIDER_TYPES,
  ORGANIZATION_TYPES,
};
