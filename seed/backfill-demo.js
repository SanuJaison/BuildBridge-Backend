require("../config/env");

const { connectDB, disconnectDB } = require("../config/db");
const { providers } = require("./data");
const { slugify } = require("../utils/helpers");
const ProviderProfile = require("../models/ProviderProfile");

const DEMO_ROLES = {
  aria: ["software-engineer", "web-developer"],
  marcus: ["app-developer"],
  priya: ["product-designer"],
  diego: ["game-developer"],
  pixelforge: ["game-developer", "motion-designer"],
  northwind: ["software-engineer", "web-developer"],
  lumen: ["ai-engineer", "data-scientist"],
  brightpath: ["digital-marketer", "seo-specialist"],
  studioember: ["brand-designer", "product-designer"],
  orbit: ["devops-engineer", "software-engineer"],
  shieldline: ["cybersecurity-specialist", "technical-consultant"],
  atlas: ["ecommerce-specialist", "web-developer"],
  noah: ["motion-designer", "content-creator"],
  vera: ["ai-engineer", "data-scientist"],
};

async function run() {
  await connectDB();
  let updated = 0;

  for (const spec of providers) {
    const roles = DEMO_ROLES[spec.key];
    if (!roles) continue;
    const result = await ProviderProfile.updateOne(
      { slug: slugify(spec.displayName) },
      { $set: { roles, primaryRole: roles[0] } }
    );
    updated += result.modifiedCount;
  }

  console.log(`Backfilled professional roles on ${updated} demo provider profiles.`);
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB();
  });
