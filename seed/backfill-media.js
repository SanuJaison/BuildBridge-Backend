require("../config/env");

const { connectDB, disconnectDB } = require("../config/db");
const { providers, customers, teamUsers } = require("./data");
const { slugify } = require("../utils/helpers");
const {
  serviceImages,
  projectImages,
  avatarForProvider,
  avatarForUser,
  coverForProvider,
} = require("./demoMedia");

const User = require("../models/User");
const ProviderProfile = require("../models/ProviderProfile");
const Service = require("../models/Service");
const PortfolioProject = require("../models/PortfolioProject");

async function main() {
  await connectDB();

  const userAvatars = new Map();
  userAvatars.set("admin@buildbridge.dev", avatarForUser("admin"));
  customers.forEach((spec) => userAvatars.set(spec.email, avatarForUser(spec.key)));
  teamUsers.forEach((spec) => userAvatars.set(spec.email, avatarForUser(spec.key)));
  providers.forEach((spec) => userAvatars.set(spec.owner.email, avatarForProvider(spec.key)));

  let users = 0;
  for (const [email, avatar] of userAvatars) {
    const result = await User.updateOne({ email, isDemo: true }, { $set: { avatar } });
    users += result.modifiedCount;
  }

  let profiles = 0;
  let services = 0;
  let projects = 0;

  for (const spec of providers) {
    const slug = slugify(spec.displayName);
    const profile = await ProviderProfile.findOne({ slug, isDemo: true });
    if (!profile) {
      console.warn(`Skipping missing provider profile: ${spec.displayName}`);
      continue;
    }

    await ProviderProfile.updateOne(
      { _id: profile._id },
      {
        $set: {
          avatar: avatarForProvider(spec.key),
          coverImage: coverForProvider(spec.key),
        },
      }
    );
    profiles += 1;

    for (const serviceSpec of spec.services) {
      const images = serviceImages(spec.key, spec.category, serviceSpec.title);
      const result = await Service.updateOne(
        { provider: profile._id, title: serviceSpec.title },
        { $set: { images } }
      );
      services += result.modifiedCount;
    }

    for (const projectSpec of spec.projects) {
      const images = projectImages(spec.key, spec.category, projectSpec.title);
      const result = await PortfolioProject.updateOne(
        { provider: profile._id, title: projectSpec.title },
        { $set: { images } }
      );
      projects += result.modifiedCount;
    }
  }

  console.log(`Backfilled imagery for ${users} users, ${profiles} providers, ${services} services, ${projects} projects.`);
  await disconnectDB();
}

main().catch(async (error) => {
  console.error(error);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
