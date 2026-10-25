const { z } = require("zod");
const ProviderProfile = require("../models/ProviderProfile");
const { PROVIDER_ROLE_VALUES, primaryRoleFor } = require("../config/providerRoles");
const Category = require("../models/Category");
const Organization = require("../models/Organization");
const OrganizationMember = require("../models/OrganizationMember");
const Service = require("../models/Service");
const PortfolioProject = require("../models/PortfolioProject");
const Inquiry = require("../models/Inquiry");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Favorite = require("../models/Favorite");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const { createNotification } = require("../utils/notifications");
const { canManageWorkspace } = require("../utils/providerWorkspace");

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Select a valid category");
const optionalUrl = z.string().trim().max(500).optional();
const optionalNumber = z.union([z.number().min(0), z.null()]).optional();

const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(120).optional(),
  roles: z.array(z.enum(PROVIDER_ROLE_VALUES)).max(4).optional(),
  primaryRole: z.union([z.enum(PROVIDER_ROLE_VALUES), z.literal(""), z.null()]).optional(),
  headline: z.string().trim().max(160).optional(),
  bio: z.string().trim().max(4000).optional(),
  avatar: z.string().trim().max(1000).optional(),
  coverImage: z.string().trim().max(1000).optional(),
  primaryCategory: z.union([objectId, z.literal(""), z.null()]).optional(),
  subcategories: z.array(objectId).max(8).optional(),
  skills: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
  technologies: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
  languages: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
  location: z.string().trim().max(120).optional(),
  remote: z.boolean().optional(),
  experienceYears: z.number().min(0).max(60).optional(),
  startingBudget: optionalNumber,
  hourlyRate: optionalNumber,
  availability: z.enum(["available", "limited", "unavailable"]).optional(),
  engagementTypes: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
  website: optionalUrl,
  githubUrl: optionalUrl,
  portfolioUrl: optionalUrl,
  linkedinUrl: optionalUrl,
  teamSize: optionalNumber,
  yearEstablished: optionalNumber,
});

const organizationSchema = z.object({
  name: z.string().trim().min(2).max(140).optional(),
  description: z.string().trim().max(3000).optional(),
  industry: z.string().trim().max(100).optional(),
  website: z.string().trim().max(300).optional(),
  location: z.string().trim().max(160).optional(),
  companySize: z.string().trim().max(40).optional(),
  yearEstablished: optionalNumber,
  logo: z.string().trim().max(1000).optional(),
});

async function loadProfile(providerId) {
  return ProviderProfile.findById(providerId)
    .populate("primaryCategory", "name slug icon")
    .populate("subcategories", "name slug icon")
    .populate("organization", "name slug logo description industry website location companySize yearEstablished");
}

async function getMyProfile(req, res, next) {
  try {
    const provider = await loadProfile(req.provider._id);
    const [organizationMembership, organization] = await Promise.all([
      OrganizationMember.findOne({ user: req.user._id, status: "active" })
        .populate("organization", "name slug logo industry")
        .lean(),
      provider?.organization ? Organization.findById(provider.organization._id).lean() : null,
    ]);
    res.json({
      provider,
      organization,
      membership: organizationMembership || null,
      isOwner: req.providerIsOwner,
      canManage: await canManageWorkspace(req.provider, req.user),
    });
  } catch (error) {
    next(error);
  }
}

async function updateMyProfile(req, res, next) {
  try {
    if (!(await canManageWorkspace(req.provider, req.user))) {
      throw ApiError.forbidden("Only organization owners and admins can edit the provider profile");
    }
    const data = { ...req.body };
    if (data.primaryCategory === "") data.primaryCategory = null;
    if (data.primaryRole === "") data.primaryRole = null;

    if (data.roles !== undefined) {
      data.roles = [...new Set(data.roles)];
      if (!data.roles.length) {
        data.primaryRole = null;
      } else if (!data.primaryRole) {
        data.primaryRole = primaryRoleFor(data.roles);
      }
    }
    if (data.primaryRole) {
      const effectiveRoles = data.roles !== undefined ? data.roles : req.provider.roles || [];
      if (!effectiveRoles.includes(data.primaryRole)) {
        throw ApiError.badRequest("Choose a primary role from the roles you selected");
      }
    }

    if (data.primaryCategory) {
      const category = await Category.findOne({ _id: data.primaryCategory, isActive: true });
      if (!category) throw ApiError.badRequest("Choose an active primary category");
      if (category.parent) throw ApiError.badRequest("Choose a top-level primary category");
    }

    if (data.subcategories?.length) {
      const cats = await Category.find({ _id: { $in: data.subcategories }, isActive: true });
      if (cats.length !== new Set(data.subcategories).size) {
        throw ApiError.badRequest("One or more subcategories are invalid");
      }
      if (data.primaryCategory) {
        const wrong = cats.find((item) => String(item.parent) !== String(data.primaryCategory));
        if (wrong) throw ApiError.badRequest(`“${wrong.name}” is not inside the selected primary category`);
      }
    }

    const allowed = Object.keys(profileSchema.shape);
    allowed.forEach((field) => {
      if (data[field] !== undefined) req.provider[field] = data[field];
    });
    if (req.provider.roles?.length && !req.provider.primaryRole) {
      req.provider.primaryRole = primaryRoleFor(req.provider.roles);
    }
    await req.provider.save();
    const provider = await loadProfile(req.provider._id);
    res.json({ provider, message: "Provider profile saved" });
  } catch (error) {
    next(error);
  }
}

async function publishMyProfile(req, res, next) {
  try {
    if (!(await canManageWorkspace(req.provider, req.user))) {
      throw ApiError.forbidden("Only organization owners and admins can publish the provider profile");
    }
    const provider = req.provider;
    if (provider.status === "suspended") throw ApiError.forbidden("This profile is suspended by an administrator");
    const missing = [];
    if (!provider.displayName || provider.displayName.length < 2) missing.push("a display name");
    if (!provider.headline || provider.headline.length < 8) missing.push("a professional headline");
    if (!provider.bio || provider.bio.length < 80) missing.push("a biography of at least 80 characters");
    if (!provider.primaryCategory) missing.push("a primary category");
    if (!provider.skills || provider.skills.length === 0) missing.push("at least one skill");
    if (!provider.location) missing.push("your location");

    if (missing.length) {
      throw ApiError.badRequest(`Before publishing, add ${missing.join(", ")}`);
    }
    provider.status = "published";
    await provider.save();
    res.json({ provider: await loadProfile(req.provider._id), message: "Your profile is now live" });
  } catch (error) {
    next(error);
  }
}

async function overview(req, res, next) {
  try {
    const provider = req.provider;
    const inquiryIds = await Inquiry.find({ provider: provider._id }).distinct("_id");
    const conversations = inquiryIds.length
      ? await Conversation.find({ inquiry: { $in: inquiryIds } }).select("_id").lean()
      : [];
    const conversationIds = conversations.map((item) => item._id);

    const [
      services,
      publishedServices,
      projects,
      publishedProjects,
      newInquiries,
      activeInquiries,
      completedInquiries,
      unreadMessages,
      favoritesReceived,
      recentInquiries,
    ] = await Promise.all([
      Service.countDocuments({ provider: provider._id }),
      Service.countDocuments({ provider: provider._id, status: "published" }),
      PortfolioProject.countDocuments({ provider: provider._id }),
      PortfolioProject.countDocuments({ provider: provider._id, status: "published" }),
      Inquiry.countDocuments({ provider: provider._id, status: "new" }),
      Inquiry.countDocuments({
        provider: provider._id,
        status: { $in: ["in_discussion", "proposal_sent", "accepted"] },
      }),
      Inquiry.countDocuments({ provider: provider._id, status: "completed" }),
      conversationIds.length
        ? Message.countDocuments({
            conversation: { $in: conversationIds },
            sender: { $ne: req.user._id },
            readBy: { $ne: req.user._id },
          })
        : 0,
      Favorite.countDocuments({ provider: provider._id }),
      Inquiry.find({ provider: provider._id })
        .select("title status createdAt customer")
        .populate("customer", "name avatar")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    const organizationMembers = provider.organization
      ? await OrganizationMember.countDocuments({ organization: provider.organization._id, status: "active" })
      : 0;

    res.json({
      provider: {
        status: provider.status,
        profileViews: provider.profileViews,
        ratingAvg: provider.ratingAvg,
        ratingCount: provider.ratingCount,
        featured: provider.featured,
        verified: provider.verified,
      },
      stats: {
        services,
        publishedServices,
        projects,
        publishedProjects,
        newInquiries,
        activeInquiries,
        completedInquiries,
        unreadMessages,
        conversations: conversationIds.length,
        favoritesReceived,
        profileViews: provider.profileViews,
        teamMembers: organizationMembers,
      },
      recentInquiries,
    });
  } catch (error) {
    next(error);
  }
}

async function getMyOrganization(req, res, next) {
  try {
    if (!req.provider.organization) {
      throw ApiError.notFound("This provider account is not linked to an organization");
    }
    const organization = await Organization.findById(req.provider.organization).lean();
    if (!organization) throw ApiError.notFound("Organization not found");
    const members = await OrganizationMember.find({ organization: organization._id, status: { $ne: "removed" } })
      .populate("user", "name email avatar role")
      .sort({ role: 1, createdAt: 1 })
      .lean();
    const membership = members.find((item) => String(item.user?._id) === String(req.user._id));
    res.json({ organization, members, myRole: membership ? membership.role : null });
  } catch (error) {
    next(error);
  }
}

async function assertOrgManager(provider, userId) {
  if (!provider.organization) throw ApiError.forbidden("No organization is linked to this account");
  const membership = await OrganizationMember.findOne({
    organization: provider.organization,
    user: userId,
    status: "active",
    role: { $in: ["owner", "admin"] },
  });
  if (!membership) throw ApiError.forbidden("Only organization owners and admins can manage these settings");
  return membership;
}

async function updateMyOrganization(req, res, next) {
  try {
    await assertOrgManager(req.provider, req.user._id);
    const organization = await Organization.findById(req.provider.organization);
    if (!organization) throw ApiError.notFound("Organization not found");
    const allowed = Object.keys(organizationSchema.shape);
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) organization[field] = req.body[field];
    });
    await organization.save();
    if (req.body.name && req.body.name !== req.provider.displayName) {
      req.provider.displayName = req.body.name;
      await req.provider.save();
    }
    res.json({ organization, message: "Organization profile saved" });
  } catch (error) {
    next(error);
  }
}

async function inviteMember(req, res, next) {
  try {
    await assertOrgManager(req.provider, req.user._id);
    const email = String(req.body.email || "").trim().toLowerCase();
    const user = await User.findOne({ email });
    if (!user) {
      throw ApiError.badRequest("No account uses that email yet. Ask your teammate to create an account first.");
    }
    if (String(user._id) === String(req.user._id)) throw ApiError.badRequest("You are already on this team");
    if (user.role === "admin") throw ApiError.badRequest("Administrator accounts cannot be organization members");
    if (user.role !== "provider") {
      throw ApiError.badRequest("Only provider accounts can join an organization workspace. Ask your teammate to create a provider account first.");
    }
    if (await ProviderProfile.exists({ user: user._id })) {
      throw ApiError.badRequest("That account already has its own provider profile and cannot join an organization workspace");
    }
    const otherMembership = await OrganizationMember.findOne({
      user: user._id,
      organization: { $ne: req.provider.organization },
      status: { $ne: "removed" },
    });
    if (otherMembership) {
      throw ApiError.conflict("That teammate already belongs to another organization workspace");
    }

    const existing = await OrganizationMember.findOne({
      organization: req.provider.organization,
      user: user._id,
    });
    if (existing && existing.status !== "removed") {
      throw ApiError.conflict(
        existing.status === "invited" ? "That teammate already has a pending invitation" : "That teammate is already on this team"
      );
    }

    let membership;
    if (existing) {
      existing.status = "invited";
      existing.role = "member";
      existing.invitedBy = req.user._id;
      membership = await existing.save();
    } else {
      membership = await OrganizationMember.create({
        organization: req.provider.organization,
        user: user._id,
        role: "member",
        status: "invited",
        invitedBy: req.user._id,
      });
    }

    const organization = await Organization.findById(req.provider.organization).lean();
    await createNotification(req.app, {
      user: user._id,
      type: "team",
      title: `Team invitation from ${organization?.name || "an organization"}`,
      message: `${req.user.name} invited you to join the team.`,
      link: "/dashboard/team",
    });
    res.status(201).json({ membership, message: "Invitation sent" });
  } catch (error) {
    next(error);
  }
}

async function myInvitations(req, res, next) {
  try {
    const invitations = await OrganizationMember.find({ user: req.user._id, status: "invited" })
      .populate("organization", "name slug logo industry")
      .populate("invitedBy", "name avatar")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ items: invitations });
  } catch (error) {
    next(error);
  }
}

async function respondInvitation(req, res, next) {
  try {
    const membership = await OrganizationMember.findOne({
      _id: req.params.id,
      user: req.user._id,
      status: "invited",
    }).populate("organization", "name owner");
    if (!membership) throw ApiError.notFound("Invitation not found");

    if (req.body.action === "accept") {
      membership.status = "active";
      membership.joinedAt = new Date();
      await membership.save();
      await createNotification(req.app, {
        user: membership.organization.owner,
        type: "team",
        title: "Team invitation accepted",
        message: `${req.user.name} joined ${membership.organization.name}.`,
        link: "/dashboard/team",
      });
      return res.json({ message: "Invitation accepted" });
    }

    if (req.body.action === "decline") {
      membership.status = "removed";
      await membership.save();
      return res.json({ message: "Invitation declined" });
    }
    throw ApiError.badRequest("Choose accept or decline");
  } catch (error) {
    next(error);
  }
}

async function updateMember(req, res, next) {
  try {
    await assertOrgManager(req.provider, req.user._id);
    const membership = await OrganizationMember.findOne({
      _id: req.params.memberId,
      organization: req.provider.organization,
      status: { $ne: "removed" },
    });
    if (!membership) throw ApiError.notFound("Team member not found");
    if (membership.role === "owner") throw ApiError.badRequest("The organization owner role cannot be changed");
    if (req.body.role && !["admin", "member"].includes(req.body.role)) {
      throw ApiError.badRequest("Choose admin or member");
    }
    if (req.body.role) membership.role = req.body.role;
    await membership.save();
    res.json({ membership, message: "Team member updated" });
  } catch (error) {
    next(error);
  }
}

async function removeMember(req, res, next) {
  try {
    await assertOrgManager(req.provider, req.user._id);
    const membership = await OrganizationMember.findOne({
      _id: req.params.memberId,
      organization: req.provider.organization,
      status: { $ne: "removed" },
    });
    if (!membership) throw ApiError.notFound("Team member not found");
    if (membership.role === "owner") throw ApiError.badRequest("The organization owner cannot be removed");
    membership.status = "removed";
    await membership.save();
    await createNotification(req.app, {
      user: membership.user,
      type: "team",
      title: "Organization membership updated",
      message: "Your membership in the organization has been removed.",
      link: "/dashboard",
    });
    res.json({ message: "Team member removed" });
  } catch (error) {
    next(error);
  }
}

const inviteSchema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address") });
const memberSchema = z.object({ role: z.enum(["admin", "member"]).optional() });
const invitationResponseSchema = z.object({ action: z.enum(["accept", "decline"]) });

module.exports = {
  getMyProfile,
  updateMyProfile,
  publishMyProfile,
  overview,
  getMyOrganization,
  updateMyOrganization,
  inviteMember,
  myInvitations,
  respondInvitation,
  updateMember,
  removeMember,
  profileSchema,
  organizationSchema,
  inviteSchema,
  memberSchema,
  invitationResponseSchema,
};
