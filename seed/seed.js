require("../config/env");

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { connectDB, disconnectDB } = require("../config/db");
const { categorySpecs, customers, teamUsers, providers, engagements } = require("./data");
const { buildBulkProviders } = require("./bulk");
const { slugify } = require("../utils/helpers");
const { DEFAULT_BRANDING } = require("../utils/branding");
const {
  serviceImages,
  projectImages,
  avatarForProvider,
  avatarForUser,
  coverForProvider,
} = require("./demoMedia");

const User = require("../models/User");
const Category = require("../models/Category");
const ProviderProfile = require("../models/ProviderProfile");
const Organization = require("../models/Organization");
const OrganizationMember = require("../models/OrganizationMember");
const Service = require("../models/Service");
const PortfolioProject = require("../models/PortfolioProject");
const Inquiry = require("../models/Inquiry");
const Proposal = require("../models/Proposal");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Review = require("../models/Review");
const Favorite = require("../models/Favorite");
const Notification = require("../models/Notification");
const Report = require("../models/Report");
const ContactMessage = require("../models/ContactMessage");
const Upload = require("../models/Upload");
const Setting = require("../models/Setting");
const AdminAuditLog = require("../models/AdminAuditLog");

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const now = Date.now();
const DEMO_PASSWORD = "Demo@12345";
const ADMIN_PASSWORD = "Admin@12345";

const at = (daysAgo, extraMs = 0) => new Date(now - daysAgo * DAY + extraMs);
const shifted = (date, days) => new Date(date.getTime() + days * DAY);
const hashStringSeed = (value) => {
  let total = 7;
  for (const char of String(value)) total = (total * 31 + char.charCodeAt(0)) % 1000003;
  return total;
};
const asset = (kind, index) => `/static/demo/${kind}-${index}.svg`;
const workAsset = (index) => asset("work", ((index - 1) % 12) + 1);
const avatarAsset = (index) => asset("avatar", index);

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

const CATEGORY_DEFAULT_ROLES = {
  "website-development": ["web-developer"],
  "web-application-development": ["software-engineer", "web-developer"],
  "mobile-application-development": ["app-developer"],
  "game-development": ["game-developer"],
  "digital-marketing": ["digital-marketer", "seo-specialist"],
  "ui-ux-product-design": ["product-designer"],
  "branding-creative-services": ["brand-designer", "content-creator"],
  "ai-machine-learning-data": ["ai-engineer", "data-scientist"],
  "cloud-devops-infrastructure": ["devops-engineer", "software-engineer"],
  "cybersecurity-technical-consulting": ["cybersecurity-specialist", "technical-consultant"],
  "emerging-specialized-technologies": ["technical-consultant", "software-engineer"],
};

const MODELS = [
  User,
  Category,
  ProviderProfile,
  Organization,
  OrganizationMember,
  Service,
  PortfolioProject,
  Inquiry,
  Proposal,
  Conversation,
  Message,
  Review,
  Favorite,
  Notification,
  Report,
  ContactMessage,
  Upload,
  Setting,
  AdminAuditLog,
];

async function setTimestamps(Model, id, dates) {
  const update = {};
  if (dates.createdAt) {
    update.createdAt = dates.createdAt;
    update.updatedAt = dates.updatedAt || dates.createdAt;
  }
  if (Object.keys(update).length) {
    await Model.collection.updateOne({ _id: id }, { $set: update });
  }
}

function passwordFor(role) {
  return role === "admin" ? ADMIN_PASSWORD : DEMO_PASSWORD;
}

async function createUser(spec, { role = "customer", daysAgo = 180, avatar } = {}) {
  const createdAt = at(daysAgo);
  const doc = await new User({
    name: spec.name,
    email: spec.email,
    password: passwordFor(role),
    role,
    avatar: avatar || avatarAsset(spec.avatar),
    company: spec.company || "",
    location: spec.location || "",
    bio: spec.bio || "",
    status: "active",
    emailNotifications: true,
    lastLoginAt: at(Math.max(0, daysAgo / 8)),
    isDemo: true,
  }).save();
  await setTimestamps(User, doc._id, { createdAt, updatedAt: createdAt });
  doc.createdAt = createdAt;
  return doc;
}

function uniqueInSet(base, used) {
  const root = slugify(base) || "item";
  let candidate = root;
  let counter = 1;
  while (used.has(candidate)) {
    counter += 1;
    candidate = `${root}-${counter}`;
  }
  used.add(candidate);
  return candidate;
}

function readReceipt(eventAt, wasRead) {
  if (!wasRead) return null;
  const candidate = new Date(eventAt.getTime() + DAY);
  const ceiling = new Date(now - HOUR);
  return candidate < ceiling ? candidate : ceiling;
}

async function seedCategories() {
  const parentBySlug = new Map();
  const childrenByParent = new Map();
  const usedSlugs = new Set();
  const allChildren = [];
  let parentOrder = 0;

  for (const spec of categorySpecs) {
    const slug = uniqueInSet(spec.slug, usedSlugs);
    const parent = await Category.create({
      name: spec.name,
      slug,
      description: spec.description,
      icon: spec.icon,
      parent: null,
      order: parentOrder,
      featured: spec.featured,
      isActive: true,
    });
    parentOrder += 1;
    parentBySlug.set(slug, parent);
    const childMap = new Map();
    let childOrder = 0;

    for (const childName of spec.children) {
      const childSlug = uniqueInSet(childName, usedSlugs);
      const child = await Category.create({
        name: childName,
        slug: childSlug,
        icon: spec.icon,
        parent: parent._id,
        order: childOrder,
        isActive: true,
      });
      childOrder += 1;
      childMap.set(childName, child);
      allChildren.push(child);
    }
    childrenByParent.set(slug, childMap);
  }

  return {
    parentBySlug,
    childrenByParent,
    parentCount: categorySpecs.length,
    childCount: allChildren.length,
  };
}

function findSubcategory(childrenByParent, primarySlug, name) {
  const childMap = childrenByParent.get(primarySlug);
  const child = childMap && childMap.get(name);
  if (!child) {
    throw new Error(`Unknown subcategory "${name}" under "${primarySlug}"`);
  }
  return child;
}

async function seedMarketplace({ categories, userMap, providerMap, orgMap, providerSpecs }) {
  const usedServiceSlugs = new Set();
  const usedProjectSlugs = new Set();
  const serviceMap = new Map();
  const projectMap = new Map();

  for (const [index, spec] of providerSpecs.entries()) {
    const owner = userMap.get(spec.key);
    const primaryCategory = categories.parentBySlug.get(spec.category);
    if (!owner || !primaryCategory) throw new Error(`Missing provider owner/category for ${spec.key}`);

    const providerCreated = at(Math.max(30, 330 - index * 18));
    const subcategoryDocs = spec.subs.map((name) => findSubcategory(categories.childrenByParent, spec.category, name));

    let organization = null;
    if (spec.organization) {
      const orgCreated = shifted(providerCreated, -4);
      organization = await Organization.create({
        name: spec.organization.name,
        slug: slugify(spec.organization.name),
        logo: avatarAsset(spec.organization.logoIndex),
        description: spec.organization.description,
        industry: spec.organization.industry,
        location: spec.organization.location,
        companySize: spec.organization.companySize,
        yearEstablished: spec.organization.yearEstablished,
        owner: owner._id,
        status: "active",
        isDemo: true,
      });
      await setTimestamps(Organization, organization._id, {
        createdAt: orgCreated,
        updatedAt: orgCreated,
      });
      await OrganizationMember.create({
        organization: organization._id,
        user: owner._id,
        role: "owner",
        status: "active",
        joinedAt: orgCreated,
      });
      orgMap.set(spec.key, organization);
    }

    const roles = DEMO_ROLES[spec.key] || CATEGORY_DEFAULT_ROLES[spec.category] || [];
    const profile = await ProviderProfile.create({
      user: owner._id,
      type: spec.type,
      roles,
      primaryRole: roles[0] || null,
      displayName: spec.displayName,
      slug: slugify(spec.displayName),
      headline: spec.headline,
      bio: spec.bio,
      avatar: avatarForProvider(spec.key),
      coverImage: coverForProvider(spec.key),
      primaryCategory: primaryCategory._id,
      subcategories: subcategoryDocs.map((item) => item._id),
      skills: spec.skills,
      technologies: spec.technologies,
      languages: spec.languages,
      location: spec.location,
      remote: spec.remote,
      experienceYears: spec.experienceYears,
      startingBudget: spec.startingBudget,
      hourlyRate: spec.hourlyRate,
      currency: "USD",
      availability: spec.availability,
      engagementTypes: spec.engagementTypes,
      status: "published",
      featured: spec.featured,
      verified: spec.verified,
      ratingAvg: 0,
      ratingCount: 0,
      profileViews: 0,
      inquiriesCount: 0,
      completedProjects: 0,
      organization: organization ? organization._id : null,
      teamSize: spec.teamSize || null,
      yearEstablished: spec.yearEstablished || null,
      isDemo: true,
    });
    await setTimestamps(ProviderProfile, profile._id, {
      createdAt: shifted(providerCreated, 1),
      updatedAt: shifted(providerCreated, 1),
    });
    providerMap.set(spec.key, profile);

    const serviceDocs = [];
    for (const [serviceIndex, serviceSpec] of spec.services.entries()) {
      const subcategory = findSubcategory(categories.childrenByParent, spec.category, serviceSpec.sub);
      const createdAt = shifted(providerCreated, 10 + serviceIndex * 6);
      const service = await Service.create({
        provider: profile._id,
        title: serviceSpec.title,
        slug: uniqueInSet(serviceSpec.title, usedServiceSlugs),
        description: serviceSpec.description,
        category: primaryCategory._id,
        subcategory: subcategory._id,
        images: serviceImages(spec.key, spec.category, serviceSpec.title),
        startingPrice: serviceSpec.price,
        maxPrice: null,
        currency: "USD",
        pricingType: serviceSpec.type,
        deliveryDays: serviceSpec.days,
        deliverables: serviceSpec.deliverables || [],
        requirements: serviceSpec.requirements || [],
        tags: serviceSpec.tags || [],
        faqs: serviceSpec.faqs || [],
        status: "published",
        views: 0,
        isDemo: true,
      });
      await setTimestamps(Service, service._id, { createdAt, updatedAt: createdAt });
      serviceDocs.push(service);
    }
    serviceMap.set(spec.key, serviceDocs);

    const projectDocs = [];
    for (const [projectIndex, projectSpec] of spec.projects.entries()) {
      const subcategory = findSubcategory(categories.childrenByParent, spec.category, projectSpec.sub);
      const completionDate = new Date(`${projectSpec.completionDate}T12:00:00.000Z`);
      const createdAt = new Date(
        Math.min(now - 7 * DAY, completionDate.getTime() + (projectIndex + 1) * 4 * DAY)
      );
      const project = await PortfolioProject.create({
        provider: profile._id,
        title: projectSpec.title,
        slug: uniqueInSet(projectSpec.title, usedProjectSlugs),
        summary: projectSpec.summary,
        description: projectSpec.description,
        images: projectImages(spec.key, spec.category, projectSpec.title),
        technologies: projectSpec.technologies,
        skills: projectSpec.technologies,
        category: primaryCategory._id,
        subcategory: subcategory._id,
        completionDate,
        role: projectSpec.role,
        liveUrl: "",
        repoUrl: "",
        outcomes: "",
        clientName: "",
        featured: Boolean(projectSpec.featured),
        status: "published",
        views: 0,
        isDemo: true,
      });
      await setTimestamps(PortfolioProject, project._id, { createdAt, updatedAt: createdAt });
      projectDocs.push(project);
    }
    projectMap.set(spec.key, projectDocs);
  }

  return { serviceMap, projectMap };
}

async function seedTeamMemberships(teamUserMap, orgMap) {
  let count = 0;
  for (const spec of teamUsers) {
    const user = teamUserMap.get(spec.key);
    const organization = orgMap.get(spec.organizationKey);
    if (!user || !organization) continue;
    await OrganizationMember.create({
      organization: organization._id,
      user: user._id,
      role: spec.memberRole,
      status: "active",
      invitedBy: organization.owner,
      joinedAt: at(40),
    });
    count += 1;
  }
  return count;
}

function buildEventPlan(spec, base, status, proposalAt, decisionAt, completionAt, reviewAt, messages) {
  const events = [
    {
      at: shifted(base, 0.05),
      body: `Inquiry “${spec.title}” was submitted to the provider.`,
      system: true,
      readBy: "all",
    },
  ];

  const endAt = completionAt
    ? new Date(completionAt.getTime() - HOUR)
    : status === "accepted"
      ? new Date(now - DAY)
      : status === "declined"
        ? new Date(decisionAt.getTime() - 2 * HOUR)
        : status === "proposal_sent"
          ? new Date(proposalAt.getTime() - 2 * HOUR)
          : status === "in_discussion"
            ? new Date(now - 6 * HOUR)
            : new Date(base.getTime() + 10 * HOUR);

  const startAt = shifted(base, 0.25);
  const span = Math.max(HOUR, endAt.getTime() - startAt.getTime());

  messages.forEach((message, index) => {
    events.push({
      at: new Date(startAt.getTime() + (span * (index + 1)) / (messages.length + 1)),
      body: message.body,
      system: false,
      who: message.who,
      readBy: "all",
    });
  });

  if (proposalAt) {
    events.push({
      at: proposalAt,
      body: `A proposal was sent: $${spec.proposal.cost.toLocaleString("en-US")} over ${
        spec.proposal.days
      } days. Acceptance does not process payment.`,
      system: true,
      readBy: "all",
    });
  }
  if (decisionAt) {
    if (status === "accepted" || status === "completed") {
      events.push({
        at: decisionAt,
        body:
          "The customer accepted the proposal. This records an agreement in principle; it is not a payment confirmation or a legal contract.",
        system: true,
        readBy: "all",
      });
    } else if (status === "declined") {
      events.push({
        at: decisionAt,
        body: "The customer declined the proposal. The conversation remains available.",
        system: true,
        readBy: "all",
      });
    }
  }
  if (completionAt) {
    events.push({
      at: completionAt,
      body: "The customer marked this engagement complete. The customer can now leave a review.",
      system: true,
      readBy: "all",
    });
  }
  if (reviewAt) {
    events.push({
      at: reviewAt,
      body: "The customer left a review for this completed engagement.",
      system: true,
      readBy: "all",
    });
  }

  return events.sort((a, b) => a.at - b.at);
}

async function seedEngagements({ customerMap, providerMap, serviceMap }) {
  const created = { inquiries: 0, proposals: 0, conversations: 0, messages: 0, reviews: 0, notifications: 0 };
  const notificationDocs = [];

  for (const [index, spec] of engagements.entries()) {
    const provider = providerMap.get(spec.provider);
    const providerSpec = providers.find((item) => item.key === spec.provider);
    const customer = customerMap.get(spec.customer);
    const services = serviceMap.get(spec.provider) || [];
    if (!provider || !customer || !services[spec.service]) {
      throw new Error(`Invalid engagement references at index ${index}`);
    }
    const service = services[spec.service];
    const daysAgo = spec.daysAgo;
    const base = at(daysAgo);
    const ageDays = daysAgo;

    const proposalAt = spec.proposal ? new Date(base.getTime() + 8 * HOUR + 10 * 60000) : null;
    const decisionAt =
      spec.status === "accepted" || spec.status === "completed" || spec.status === "declined"
        ? new Date(base.getTime() + 1.5 * DAY)
        : null;
    let completionAt = null;
    if (spec.status === "completed") {
      const offsetDays = Math.min(Math.max(3, Math.round(ageDays * 0.62)), Math.max(3, ageDays - 3));
      completionAt = new Date(base.getTime() + offsetDays * DAY);
    }
    const reviewAt =
      spec.status === "completed" && spec.rating
        ? new Date(Math.min(now - DAY, completionAt.getTime() + 2 * DAY))
        : null;
    if (proposalAt && proposalAt.getTime() >= now) {
      throw new Error(`Engagement ${index} would place its proposal in the future`);
    }

    const customerRead = !["new", "proposal_sent", "in_discussion"].includes(spec.status);
    const providerRead = !["new"].includes(spec.status);
    const lastEventAt = reviewAt || completionAt || decisionAt || proposalAt || null;

    const inquiry = await Inquiry.create({
      customer: customer._id,
      provider: provider._id,
      providerUser: provider.user,
      service: service._id,
      title: spec.title,
      description: spec.description,
      category: service.category,
      subcategory: service.subcategory,
      features: "",
      budgetMin: spec.budgetMin ?? null,
      budgetMax: spec.budgetMax ?? null,
      timeline: spec.timeline || "",
      referenceLinks: [],
      attachments: [],
      communicationPreference: "in_app",
      status: spec.status,
      providerReadAt: providerRead ? lastEventAt || shifted(base, 0.4) : null,
      customerReadAt: customerRead ? lastEventAt || shifted(base, 0.4) : null,
      completedAt: completionAt,
      cancelledAt: null,
      lastActivityAt: lastEventAt || shifted(base, 0.3),
      isDemo: true,
    });
    created.inquiries += 1;

    const conversation = await Conversation.create({
      inquiry: inquiry._id,
      participants: [customer._id, provider.user],
      lastMessageText: "Inquiry submitted",
      lastMessageAt: shifted(base, 0.05),
      lastMessageSender: customer._id,
    });
    created.conversations += 1;

    let proposal = null;
    if (spec.proposal) {
      const proposalStatus =
        spec.status === "completed" || spec.status === "accepted"
          ? "accepted"
          : spec.status === "declined"
            ? "declined"
            : "sent";
      proposal = await Proposal.create({
        inquiry: inquiry._id,
        provider: provider._id,
        providerUser: provider.user,
        customer: customer._id,
        message: spec.proposal.message,
        estimatedCost: spec.proposal.cost,
        currency: "USD",
        timelineDays: spec.proposal.days,
        deliverables: spec.proposal.deliverables || [],
        assumptions: "",
        status: proposalStatus,
        validUntil: null,
      });
      await setTimestamps(Proposal, proposal._id, {
        createdAt: proposalAt,
        updatedAt: decisionAt || proposalAt,
      });
      created.proposals += 1;
    }

    const events = buildEventPlan(
      spec,
      base,
      spec.status,
      proposalAt,
      decisionAt,
      completionAt,
      reviewAt,
      spec.messages
    );

    const customerUnread =
      spec.status === "proposal_sent"
        ? true
        : spec.status === "in_discussion"
          ? (() => {
              const userEvents = events.filter((event) => !event.system);
              return userEvents.length
                ? userEvents[userEvents.length - 1].who === "provider"
                : false;
            })()
          : false;
    const providerUnread = spec.status === "new";
    const latestUserEvent = [...events].reverse().find((event) => !event.system);
    const customerUnreadAfter =
      spec.status === "proposal_sent"
        ? proposalAt
        : spec.status === "in_discussion"
          ? latestUserEvent?.at || lastEventAt || base
          : lastEventAt || base;

    const messageDocs = events.map((event) => {
      const senderId =
        event.system ? null : event.who === "customer" ? customer._id : provider.user;
      let readBy = [customer._id, provider.user];
      if (providerUnread) {
        readBy = [customer._id];
      } else if (customerUnread && event.at >= customerUnreadAfter && event.who !== "customer") {
        readBy = [provider.user];
      }
      if (event.system && !providerUnread && !customerUnread) readBy = [customer._id, provider.user];
      return {
        _id: new mongoose.Types.ObjectId(),
        conversation: conversation._id,
        sender: senderId,
        body: event.body,
        system: event.system,
        readBy,
        createdAt: event.at,
        updatedAt: event.at,
      };
    });
    if (messageDocs.length) await Message.collection.insertMany(messageDocs);
    created.messages += messageDocs.length;

    const lastEvent = events[events.length - 1];
    const lastMessageAt = lastEvent ? lastEvent.at : shifted(base, 0.05);
    const lastSenderId =
      lastEvent && !lastEvent.system
        ? lastEvent.who === "customer"
          ? customer._id
          : provider.user
        : null;
    await Conversation.collection.updateOne(
      { _id: conversation._id },
      {
        $set: {
          lastMessageText: (lastEvent?.body || "Inquiry submitted").slice(0, 240),
          lastMessageAt,
          lastMessageSender: lastSenderId,
          updatedAt: lastMessageAt,
          createdAt: shifted(base, 0.05),
        },
      }
    );
    conversation.lastMessageAt = lastMessageAt;

    const finalCustomerRead = customerUnread ? null : lastMessageAt;
    const finalProviderRead = providerUnread ? null : lastMessageAt;
    await Inquiry.collection.updateOne(
      { _id: inquiry._id },
      {
        $set: {
          createdAt: base,
          updatedAt: lastMessageAt,
          lastActivityAt: lastMessageAt,
          customerReadAt: finalCustomerRead,
          providerReadAt: finalProviderRead,
        },
      }
    );
    inquiry.createdAt = base;
    inquiry.lastActivityAt = lastMessageAt;

    let review = null;
    if (reviewAt && spec.rating) {
      review = await Review.create({
        provider: provider._id,
        customer: customer._id,
        inquiry: inquiry._id,
        rating: spec.rating,
        title: spec.reviewTitle || "",
        comment: spec.review,
        status: "published",
        isDemo: true,
      });
      await setTimestamps(Review, review._id, { createdAt: reviewAt, updatedAt: reviewAt });
      created.reviews += 1;
    }

    const pushNotification = (payload) => {
      notificationDocs.push({
        _id: new mongoose.Types.ObjectId(),
        user: payload.user,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        link: payload.link,
        meta: payload.meta || {},
        readAt: payload.readAt,
        createdAt: payload.createdAt,
        updatedAt: payload.createdAt,
      });
    };

    const toProvider = events[0].at;
    pushNotification({
      user: provider.user,
      type: "inquiry",
      title: `New inquiry from ${customer.name}`,
      message: spec.title,
      link: `/dashboard/inquiries/${inquiry._id}`,
      meta: { inquiryId: String(inquiry._id) },
      createdAt: toProvider,
      readAt: readReceipt(toProvider, providerRead),
    });

    if (proposal && proposal.status === "sent" && proposalAt) {
      pushNotification({
        user: customer._id,
        type: "proposal",
        title: "New proposal received",
        message: `${provider.displayName} sent a proposal for “${spec.title}”.`,
        link: `/dashboard/inquiries/${inquiry._id}`,
        meta: { inquiryId: String(inquiry._id), proposalId: String(proposal._id) },
        createdAt: proposalAt,
        readAt: readReceipt(proposalAt, customerRead),
      });
    }

    if (latestUserEvent) {
      if (latestUserEvent.who === "provider") {
        pushNotification({
          user: customer._id,
          type: "message",
          title: `New message from ${provider.displayName}`,
          message: latestUserEvent.body.slice(0, 160),
          link: `/dashboard/messages/${conversation._id}`,
          meta: { conversationId: String(conversation._id) },
          createdAt: latestUserEvent.at,
          readAt: readReceipt(latestUserEvent.at, customerRead),
        });
      } else {
        pushNotification({
          user: provider.user,
          type: "message",
          title: `New message from ${customer.name}`,
          message: latestUserEvent.body.slice(0, 160),
          link: `/dashboard/messages/${conversation._id}`,
          meta: { conversationId: String(conversation._id) },
          createdAt: latestUserEvent.at,
          readAt: readReceipt(latestUserEvent.at, providerRead),
        });
      }
    }

    if (decisionAt && (spec.status === "accepted" || spec.status === "completed")) {
      pushNotification({
        user: provider.user,
        type: "proposal",
        title: "Proposal accepted",
        message: `Your proposal for “${spec.title}” was accepted.`,
        link: `/dashboard/inquiries/${inquiry._id}`,
        createdAt: decisionAt,
        readAt: readReceipt(decisionAt, providerRead),
      });
    }
    if (decisionAt && spec.status === "declined") {
      pushNotification({
        user: provider.user,
        type: "proposal",
        title: "Proposal declined",
        message: `The proposal for “${spec.title}” was declined.`,
        link: `/dashboard/inquiries/${inquiry._id}`,
        createdAt: decisionAt,
        readAt: readReceipt(decisionAt, providerRead),
      });
    }
    if (completionAt) {
      pushNotification({
        user: provider.user,
        type: "status",
        title: "Engagement marked complete",
        message: `The customer marked “${spec.title}” complete.`,
        link: `/dashboard/inquiries/${inquiry._id}`,
        createdAt: completionAt,
        readAt: readReceipt(completionAt, providerRead),
      });
    }
    if (reviewAt && review) {
      pushNotification({
        user: provider.user,
        type: "review",
        title: "New review received",
        message: `A customer rated the completed “${spec.title}” engagement ${spec.rating}/5.`,
        link: `/providers/${provider.slug}`,
        createdAt: reviewAt,
        readAt: readReceipt(reviewAt, providerRead),
      });
    }
  }

  if (notificationDocs.length) {
    await Notification.collection.insertMany(notificationDocs);
    created.notifications += notificationDocs.length;
  }
  return created;
}

async function recalculateProviderStats(providerMap) {
  const reviews = await Review.aggregate([
    { $match: { status: "published" } },
    { $group: { _id: "$provider", average: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  const ratingMap = new Map(
    reviews.map((row) => [
      String(row._id),
      { ratingAvg: Math.round(row.average * 10) / 10, ratingCount: row.count },
    ])
  );
  const completed = await Inquiry.aggregate([
    { $match: { status: "completed" } },
    { $group: { _id: "$provider", count: { $sum: 1 } } },
  ]);
  const completedMap = new Map(completed.map((row) => [String(row._id), row.count]));
  const inquiries = await Inquiry.aggregate([
    { $group: { _id: "$provider", count: { $sum: 1 } } },
  ]);
  const inquiriesMap = new Map(inquiries.map((row) => [String(row._id), row.count]));

  let reviewedProviders = 0;
  for (const provider of providerMap.values()) {
    const key = String(provider._id);
    const rating = ratingMap.get(key) || { ratingAvg: 0, ratingCount: 0 };
    if (rating.ratingCount > 0) reviewedProviders += 1;
    await ProviderProfile.updateOne(
      { _id: provider._id },
      {
        $set: {
          ratingAvg: rating.ratingAvg,
          ratingCount: rating.ratingCount,
          completedProjects: completedMap.get(key) || 0,
          inquiriesCount: inquiriesMap.get(key) || 0,
        },
      }
    );
  }
  return { reviewedProviders };
}

async function seedCommunity({ customerMap, providerMap, admin }) {
  const sam = customerMap.get("sam");
  const maya = customerMap.get("maya");
  const lucas = customerMap.get("lucas");
  const priya = providerMap.get("priya");
  const marcus = providerMap.get("marcus");
  const studioember = providerMap.get("studioember");
  const lumen = providerMap.get("lumen");
  const vera = providerMap.get("vera");
  const northwind = providerMap.get("northwind");
  const atlas = providerMap.get("atlas");
  const brightpath = providerMap.get("brightpath");

  const favoriteRows = [
    { user: sam._id, provider: priya._id, createdAt: at(20), updatedAt: at(20) },
    { user: sam._id, provider: studioember._id, createdAt: at(14), updatedAt: at(14) },
    { user: sam._id, provider: lumen._id, createdAt: at(7), updatedAt: at(7) },
    { user: maya._id, provider: northwind._id, createdAt: at(25), updatedAt: at(25) },
    { user: maya._id, provider: brightpath._id, createdAt: at(12), updatedAt: at(12) },
    { user: lucas._id, provider: marcus._id, createdAt: at(9), updatedAt: at(9) },
    { user: lucas._id, provider: vera._id, createdAt: at(3), updatedAt: at(3) },
  ].filter((row) => row.provider);
  await Favorite.insertMany(favoriteRows);

  const contactRows = [
    {
      name: "Elena Fischer",
      email: "elena.fischer@example.com",
      subject: "Question about agency accounts",
      message:
        "We are a small product studio and want to set up an organization profile with several team members. Does BuildBridge support shared dashboards and invitations?",
      status: "new",
      createdAt: at(1, 4 * HOUR),
    },
    {
      name: "Owen Park",
      email: "owen.park@example.com",
      subject: "Reporting a broken portfolio link",
      message:
        "One of the portfolio case studies I opened had a project link that did not resolve. I wanted to flag it so the provider can update it.",
      status: "read",
      createdAt: at(3, 2 * HOUR),
    },
  ];
  const contacts = [];
  for (const row of contactRows) {
    const contact = await ContactMessage.create({
      name: row.name,
      email: row.email,
      subject: row.subject,
      message: row.message,
      status: row.status,
    });
    await setTimestamps(ContactMessage, contact._id, {
      createdAt: row.createdAt,
      updatedAt: row.createdAt,
    });
    contacts.push({ doc: contact, createdAt: row.createdAt });
  }

  const targets = [
    {
      reporter: lucas._id,
      targetType: "provider",
      targetId: northwind._id,
      reason: "Inaccurate profile information",
      details:
        "The website listed on the provider profile did not load when I tried to verify the agency. Sharing this so the team can check the link.",
      status: "open",
      createdAt: at(2, 3 * HOUR),
    },
    {
      reporter: maya._id,
      targetType: "review",
      targetId: (await Review.findOne({ customer: sam._id, provider: atlas._id }))?._id,
      reason: "Unverifiable claims",
      details:
        "The review mentions a launch outcome without context. I wanted the moderation team to review whether it follows the content guidelines.",
      status: "reviewing",
      createdAt: at(5, 5 * HOUR),
    },
  ];

  const reportDocs = [];
  for (const target of targets) {
    if (!target.targetId) continue;
    const report = await Report.create({
      reporter: target.reporter,
      targetType: target.targetType,
      targetId: target.targetId,
      reason: target.reason,
      details: target.details,
      status: target.status,
    });
    await setTimestamps(Report, report._id, {
      createdAt: target.createdAt,
      updatedAt: target.createdAt,
    });
    reportDocs.push({ doc: report, createdAt: target.createdAt });
  }

  const adminNotifications = [];
  for (const contact of contacts) {
    adminNotifications.push({
      _id: new mongoose.Types.ObjectId(),
      user: admin._id,
      type: "admin",
      title: "New contact message",
      message: contact.doc.subject,
      link: "/admin/contact-messages",
      meta: { contactMessageId: String(contact.doc._id) },
      readAt: contact.doc.status === "new" ? null : at(2),
      createdAt: contact.createdAt,
      updatedAt: contact.createdAt,
    });
  }
  for (const report of reportDocs) {
    adminNotifications.push({
      _id: new mongoose.Types.ObjectId(),
      user: admin._id,
      type: "admin",
      title: "New report submitted",
      message: report.doc.reason,
      link: "/admin/reports",
      meta: { reportId: String(report.doc._id) },
      readAt: report.doc.status === "open" ? null : at(2),
      createdAt: report.createdAt,
      updatedAt: report.createdAt,
    });
  }
  if (adminNotifications.length) await Notification.collection.insertMany(adminNotifications);

  await Setting.create({
    key: "branding",
    value: DEFAULT_BRANDING,
    updatedBy: admin._id,
  });

  return {
    favorites: favoriteRows.length,
    contactMessages: contacts.length,
    reports: reportDocs.length,
    adminNotifications: adminNotifications.length,
  };
}

async function printSummary(summary) {
  console.log("\nBuildBridge demo data seeded");
  console.log("────────────────────────────────────────");
  console.log(`Categories       ${summary.categories.parents} parents / ${summary.categories.children} subcategories`);
  console.log(`Users            ${summary.users}`);
  console.log(`Organizations    ${summary.organizations}`);
  console.log(`Providers        ${summary.providers} (${summary.reviewedProviders} with reviews)`);
  console.log(`Services         ${summary.services}`);
  console.log(`Portfolio items  ${summary.projects}`);
  console.log(`Inquiries        ${summary.engagements.inquiries}`);
  console.log(`Proposals        ${summary.engagements.proposals}`);
  console.log(`Messages         ${summary.engagements.messages}`);
  console.log(`Reviews          ${summary.engagements.reviews}`);
  console.log(`Notifications    ${summary.engagements.notifications + summary.community.adminNotifications}`);
  console.log(`Favorites        ${summary.community.favorites}`);
  console.log("");
  console.log("Demo accounts");
  console.log("────────────────────────────────────────");
  console.log(`Admin      admin@buildbridge.dev       / ${ADMIN_PASSWORD}`);
  console.log(`Customer   customer@buildbridge.dev    / ${DEMO_PASSWORD}`);
  console.log(`Provider   aria@buildbridge.dev        / ${DEMO_PASSWORD}`);
  console.log(`Provider   marcus@buildbridge.dev      / ${DEMO_PASSWORD}`);
  console.log(`Customer   maya@buildbridge.dev        / ${DEMO_PASSWORD}`);
  console.log(`Customer   lucas@buildbridge.dev       / ${DEMO_PASSWORD}`);
  console.log("");
  console.log(`Bulk demo providers  ${summary.bulkProviders} accounts (10 per subcategory), all type/`);
  console.log(`  organization mixes included. Emails ${summary.bulkEmailFirst} through`);
  console.log(`  ${summary.bulkEmailLast} / ${DEMO_PASSWORD}`);
  console.log("");
  console.log("All other seeded accounts use the same demo password.");
  console.log("This data is fictional and must not be presented as real marketplace activity.");
  console.log("────────────────────────────────────────\n");
}

async function main() {
  if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
    console.error("Refusing to seed demo data with NODE_ENV=production. Re-run with --force only for an intentional demo deployment.");
    process.exit(1);
  }

  await connectDB();
  console.log("Clearing existing BuildBridge collections...");
  await Promise.all(MODELS.map((Model) => Model.deleteMany({})));

  const categories = await seedCategories();
  console.log(`Seeded ${categories.parentCount} categories and ${categories.childCount} subcategories.`);

  const userMap = new Map();
  const customerMap = new Map();

  const admin = await createUser(
    {
      name: "BuildBridge Admin",
      email: "admin@buildbridge.dev",
      avatar: 23,
      location: "Remote-first",
      bio: "Platform administrator for the BuildBridge demo environment.",
    },
    { role: "admin", daysAgo: 400, avatar: avatarForUser("admin") }
  );
  userMap.set("admin", admin);

  for (const [index, spec] of customers.entries()) {
    const user = await createUser(spec, {
      role: "customer",
      daysAgo: 230 - index * 35,
      avatar: avatarForUser(spec.key),
    });
    userMap.set(spec.key, user);
    customerMap.set(spec.key, user);
  }

  const teamUserMap = new Map();
  for (const [index, spec] of teamUsers.entries()) {
    const user = await createUser(spec, {
      role: "provider",
      daysAgo: 130 - index * 25,
      avatar: avatarForUser(spec.key),
    });
    userMap.set(spec.key, user);
    teamUserMap.set(spec.key, user);
  }

  for (const [index, spec] of providers.entries()) {
    const user = await createUser(
      {
        name: spec.owner.name,
        email: spec.owner.email,
        avatar: spec.owner.avatar,
        company: spec.organization ? spec.organization.name : "",
        location: spec.location,
        bio: spec.headline,
      },
      {
        role: "provider",
        daysAgo: 330 - index * 18,
        avatar: avatarForProvider(spec.key),
      }
    );
    userMap.set(spec.key, user);
  }

  const bulkProviders = buildBulkProviders(categorySpecs);
  const demoHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const bulkUserDocs = bulkProviders.map((spec) => ({
    name: spec.owner.name,
    email: spec.owner.email,
    password: demoHash,
    role: "provider",
    avatar: avatarForProvider(spec.key),
    company: spec.organization ? spec.organization.name : "",
    location: spec.location,
    bio: spec.headline,
    status: "active",
    emailNotifications: true,
    lastLoginAt: at(2 + (hashStringSeed(spec.key) % 60)),
    isDemo: true,
    createdAt: at(spec.createdDaysAgo || 180),
    updatedAt: at(spec.createdDaysAgo || 180),
  }));
  const bulkUsers = await User.insertMany(bulkUserDocs, { timestamps: false });
  bulkUsers.forEach((user, index) => userMap.set(bulkProviders[index].key, user));

  console.log(`Seeded ${userMap.size} users (${bulkProviders.length} bulk demo providers).`);

  const orgMap = new Map();
  const providerMap = new Map();
  const allProviders = [...providers, ...bulkProviders];
  const { serviceMap } = await seedMarketplace({
    categories,
    userMap,
    providerMap,
    orgMap,
    providerSpecs: allProviders,
  });

  const teamMemberships = await seedTeamMemberships(teamUserMap, orgMap);
  const serviceCount = [...serviceMap.values()].reduce((total, items) => total + items.length, 0);
  const projectCount = allProviders.reduce((total, provider) => total + provider.projects.length, 0);
  console.log(
    `Seeded ${providerMap.size} providers, ${orgMap.size} organizations, ${teamMemberships} extra team memberships, ${serviceCount} services, and ${projectCount} portfolio projects.`
  );

  const engagementSummary = await seedEngagements({
    customerMap,
    providerMap,
    serviceMap,
  });
  console.log(
    `Seeded ${engagementSummary.inquiries} inquiries, ${engagementSummary.proposals} proposals, ${engagementSummary.conversations} conversations, and ${engagementSummary.reviews} reviews.`
  );

  const communitySummary = await seedCommunity({
    customerMap,
    providerMap,
    admin,
  });

  const { reviewedProviders } = await recalculateProviderStats(providerMap);
  await printSummary({
    categories: { parents: categories.parentCount, children: categories.childCount },
    users: userMap.size,
    organizations: orgMap.size,
    providers: providerMap.size,
    reviewedProviders,
    services: serviceCount,
    projects: projectCount,
    engagements: engagementSummary,
    community: communitySummary,
    bulkProviders: bulkProviders.length,
    bulkEmailFirst: bulkProviders[0]?.owner.email,
    bulkEmailLast: bulkProviders[bulkProviders.length - 1]?.owner.email,
  });

  await disconnectDB();
}

main().catch(async (error) => {
  console.error("\nSeeding failed:", error.message);
  if (error.stack) console.error(error.stack.split("\n").slice(0, 6).join("\n"));
  try {
    await disconnectDB();
  } catch {
    // ignore disconnect errors while reporting the original failure
  }
  process.exit(1);
});
