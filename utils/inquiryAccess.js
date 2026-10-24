const ProviderProfile = require("../models/ProviderProfile");
const OrganizationMember = require("../models/OrganizationMember");

async function inquiryAccess(inquiry, user) {
  if (!user) return null;
  const userId = String(user._id);
  if (user.role === "admin") return "admin";
  const customerId = inquiry.customer?._id || inquiry.customer;
  const providerUserId = inquiry.providerUser?._id || inquiry.providerUser;
  if (String(customerId) === userId) return "customer";
  if (String(providerUserId) === userId) return "provider";
  const providerId = inquiry.provider?._id || inquiry.provider;
  const provider = await ProviderProfile.findById(providerId).select("organization").lean();
  if (provider?.organization) {
    const membership = await OrganizationMember.findOne({
      organization: provider.organization,
      user: user._id,
      status: "active",
    }).lean();
    if (membership) return "provider";
  }
  return null;
}

function providerSide(level) {
  return level === "provider" || level === "admin";
}

module.exports = { inquiryAccess, providerSide };
