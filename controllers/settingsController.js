const { z } = require("zod");
const Setting = require("../models/Setting");
const { getBranding, DEFAULT_BRANDING } = require("../utils/branding");
const { recordAudit } = require("../utils/audit");

async function publicSettings(_req, res, next) {
  try {
    res.json({ branding: await getBranding() });
  } catch (error) {
    next(error);
  }
}

const brandingSchema = z.object({
  siteName: z.string().trim().min(2).max(60),
  tagline: z.string().trim().max(200),
  heroHeadline: z.string().trim().max(200),
  heroSubline: z.string().trim().max(400),
  supportEmail: z.string().trim().email(),
  supportPhone: z.string().trim().max(40),
  location: z.string().trim().max(160),
  showDemoNotice: z.boolean(),
});

async function adminGetSettings(_req, res, next) {
  try {
    res.json({ branding: await getBranding(), defaults: DEFAULT_BRANDING });
  } catch (error) {
    next(error);
  }
}

async function adminUpdateSettings(req, res, next) {
  try {
    const value = req.body;
    await Setting.findOneAndUpdate(
      { key: "branding" },
      { $set: { value, updatedBy: req.user._id } },
      { upsert: true, new: true }
    );
    await recordAudit(req, "settings.update", "setting", "branding", "Updated platform branding");
    res.json({ branding: await getBranding() });
  } catch (error) {
    next(error);
  }
}

module.exports = { publicSettings, adminGetSettings, adminUpdateSettings, brandingSchema };
