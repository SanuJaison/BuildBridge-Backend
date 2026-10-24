const ProviderProfile = require("../models/ProviderProfile");
const OrganizationMember = require("../models/OrganizationMember");

const PROFILE_POPULATE = [
  { path: "primaryCategory", select: "name slug icon" },
  { path: "organization", select: "name slug logo industry" },
];

async function getAccount(user) {
  const [ownProfile, membership] = await Promise.all([
    user.role === "provider"
      ? ProviderProfile.findOne({ user: user._id }).populate(PROFILE_POPULATE)
      : null,
    OrganizationMember.findOne({ user: user._id, status: "active" })
      .populate("organization", "name slug logo industry")
      .lean(),
  ]);

  let profile = ownProfile;
  if (!profile && membership && user.role === "provider") {
    profile = await ProviderProfile.findOne({ organization: membership.organization._id }).populate(
      PROFILE_POPULATE
    );
  }

  const providerProfile = profile ? profile.toJSON() : null;
  const organizationId = profile
    ? profile.organization?._id || profile.organization || null
    : null;
  const organizationRole = membership ? membership.role : profile ? "owner" : null;
  const workspace = profile
    ? {
        providerId: profile._id,
        ownerId: profile.user,
        organizationId,
        role: organizationRole,
        isOwner: String(profile.user) === String(user._id),
        canManage: !organizationId || ["owner", "admin"].includes(organizationRole),
      }
    : null;

  return {
    user: user.toJSON(),
    providerProfile,
    organization: membership ? membership.organization : null,
    organizationRole,
    workspace,
  };
}

module.exports = { getAccount };
