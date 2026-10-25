const PROVIDER_ROLES = [
  {
    value: "software-engineer",
    label: "Software engineer",
    categorySlug: "web-application-development",
    keywords: ["software", "engineer", "backend", "full-stack", "api", "saas"],
  },
  {
    value: "web-developer",
    label: "Web developer",
    categorySlug: "website-development",
    keywords: ["website", "web", "frontend", "react", "ecommerce", "landing page"],
  },
  {
    value: "app-developer",
    label: "App developer",
    categorySlug: "mobile-application-development",
    keywords: ["mobile", "app", "ios", "android", "react native", "flutter"],
  },
  {
    value: "game-developer",
    label: "Game developer",
    categorySlug: "game-development",
    keywords: ["game", "unity", "unreal", "gameplay", "level design", "multiplayer"],
  },
  {
    value: "ai-engineer",
    label: "AI engineer",
    categorySlug: "ai-machine-learning-data",
    keywords: ["ai", "machine learning", "llm", "ml", "rag", "model"],
  },
  {
    value: "data-scientist",
    label: "Data scientist",
    categorySlug: "ai-machine-learning-data",
    keywords: ["data", "analytics", "scientist", "dashboard", "forecast", "insights"],
  },
  {
    value: "devops-engineer",
    label: "DevOps engineer",
    categorySlug: "cloud-devops-infrastructure",
    keywords: ["devops", "cloud", "kubernetes", "aws", "infrastructure", "platform"],
  },
  {
    value: "cybersecurity-specialist",
    label: "Cybersecurity specialist",
    categorySlug: "cybersecurity-technical-consulting",
    keywords: ["security", "cybersecurity", "penetration", "audit", "compliance", "auth"],
  },
  {
    value: "product-designer",
    label: "Product designer",
    categorySlug: "ui-ux-product-design",
    keywords: ["product design", "ux", "ui", "interaction", "figma", "design system"],
  },
  {
    value: "brand-designer",
    label: "Brand designer",
    categorySlug: "branding-creative-services",
    keywords: ["brand", "identity", "logo", "creative", "art direction"],
  },
  {
    value: "motion-designer",
    label: "Motion designer",
    categorySlug: "branding-creative-services",
    keywords: ["motion", "animation", "video", "after effects", "3d"],
  },
  {
    value: "digital-marketer",
    label: "Digital marketer",
    categorySlug: "digital-marketing",
    keywords: ["marketing", "growth", "paid ads", "campaign", "email", "social"],
  },
  {
    value: "seo-specialist",
    label: "SEO specialist",
    categorySlug: "digital-marketing",
    keywords: ["seo", "search", "content", "organic", "keywords"],
  },
  {
    value: "content-creator",
    label: "Content creator",
    categorySlug: "digital-marketing",
    keywords: ["content", "copywriting", "editorial", "social", "video"],
  },
  {
    value: "ecommerce-specialist",
    label: "E-commerce specialist",
    categorySlug: "website-development",
    keywords: ["ecommerce", "shopify", "conversion", "retail", "store"],
  },
  {
    value: "technical-consultant",
    label: "Technical consultant",
    categorySlug: "cybersecurity-technical-consulting",
    keywords: ["consultant", "strategy", "architecture", "audit", "advisory"],
  },
];

const PROVIDER_ROLE_VALUES = PROVIDER_ROLES.map((role) => role.value);
const PROVIDER_ROLE_BY_VALUE = new Map(PROVIDER_ROLES.map((role) => [role.value, role]));

function primaryRoleFor(roles = []) {
  return roles.find((role) => PROVIDER_ROLE_BY_VALUE.has(role)) || null;
}

module.exports = { PROVIDER_ROLES, PROVIDER_ROLE_VALUES, PROVIDER_ROLE_BY_VALUE, primaryRoleFor };
