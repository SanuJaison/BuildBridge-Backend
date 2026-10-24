const Setting = require("../models/Setting");

const DEFAULT_BRANDING = {
  siteName: "BuildBridge",
  tagline: "Where ambitious ideas meet proven digital talent.",
  heroHeadline: "Build something remarkable with the right people behind it.",
  heroSubline:
    "Discover independent specialists, studios, and digital agencies who turn product ideas into working software, games, brands, and growth engines.",
  supportEmail: "hello@buildbridge.dev",
  supportPhone: "",
  location: "Remote-first · Serving teams worldwide",
  showDemoNotice: true,
};

async function getBranding() {
  const record = await Setting.findOne({ key: "branding" }).lean();
  return { ...DEFAULT_BRANDING, ...(record && record.value ? record.value : {}) };
}

module.exports = { DEFAULT_BRANDING, getBranding };
