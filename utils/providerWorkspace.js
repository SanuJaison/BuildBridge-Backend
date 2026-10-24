const ProviderProfile = require("../models/ProviderProfile");
const OrganizationMember = require("../models/OrganizationMember");
const Inquiry = require("../models/Inquiry");

async function resolveProviderWorkspace(user) {
  const ownProfile = await ProviderProfile.findOne({ user: user._id });
  if (ownProfile) {
    let membership = null;
    if (ownProfile.organization) {
      membership = await OrganizationMember.findOne({
        organization: ownProfile.organization,
        user: user._id,
        status: "active",
      });
    }
    return {
      provider: ownProfile,
      membership,
      isOwner: true,
      organizationId: ownProfile.organization || null,
    };
  }

  const membership = await OrganizationMember.findOne({ user: user._id, status: "active" });
  if (!membership) return null;
  const provider = await ProviderProfile.findOne({ organization: membership.organization });
  if (!provider) return null;
  return {
    provider,
    membership,
    isOwner: false,
    organizationId: membership.organization,
  };
}

async function accessibleProviderIds(user) {
  const [ownIds, organizationIds] = await Promise.all([
    ProviderProfile.find({ user: user._id }).distinct("_id"),
    OrganizationMember.find({ user: user._id, status: "active" }).distinct("organization"),
  ]);
  const organizationProviderIds = organizationIds.length
    ? await ProviderProfile.find({ organization: { $in: organizationIds } }).distinct("_id")
    : [];
  return [...new Set([...ownIds, ...organizationProviderIds].map(String))];
}

async function accessibleInquiryIds(user) {
  const providerIds = await accessibleProviderIds(user);
  const filters = [{ customer: user._id }];
  if (providerIds.length) {
    filters.push({ providerUser: user._id }, { provider: { $in: providerIds } });
  }
  return Inquiry.find({ $or: filters }).distinct("_id");
}

async function canManageWorkspace(provider, user) {
  if (!provider.organization) return true;
  const membership = await OrganizationMember.findOne({
    organization: provider.organization,
    user: user._id,
    status: "active",
  }).lean();
  return Boolean(membership && ["owner", "admin"].includes(membership.role));
}

module.exports = {
  resolveProviderWorkspace,
  accessibleProviderIds,
  accessibleInquiryIds,
  canManageWorkspace,
};
