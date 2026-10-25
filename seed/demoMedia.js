const photo = (name) => `/static/demo/photos/${name}.jpg`;

const PROVIDER_AVATARS = {
  aria: photo("face-aria"),
  marcus: photo("face-marcus"),
  priya: photo("face-priya"),
  diego: photo("face-diego"),
  pixelforge: photo("face-nina"),
  northwind: photo("face-daniel"),
  lumen: photo("face-sofia"),
  brightpath: photo("face-grace"),
  studioember: photo("face-isla"),
  orbit: photo("face-ravi"),
  shieldline: photo("face-tessa"),
  atlas: photo("face-jordan"),
  noah: photo("face-noah"),
  vera: photo("face-vera"),
};

const USER_AVATARS = {
  admin: photo("person-admin"),
  sam: photo("person-sam"),
  maya: photo("person-maya"),
  lucas: photo("person-lucas"),
  amara: photo("person-amara"),
  jules: photo("person-jules"),
  ...PROVIDER_AVATARS,
};

const PROVIDER_COVERS = {
  aria: photo("code-screen"),
  marcus: photo("mobile-app"),
  priya: photo("design-desk"),
  diego: photo("game-setup"),
  pixelforge: photo("game-art"),
  northwind: photo("dev-collab"),
  lumen: photo("abstract-3d"),
  brightpath: photo("data-viz"),
  studioember: photo("abstract-3d-2"),
  orbit: photo("server"),
  shieldline: photo("cyber"),
  atlas: photo("storefront"),
  noah: photo("gaming-neon"),
  vera: photo("dashboard"),
};

const CATEGORY_POOLS = {
  "website-development": ["web-portal", "code-screen", "storefront", "design-brand"],
  "web-application-development": ["dashboard", "analytics-laptop", "code-closeup", "dev-collab"],
  "mobile-application-development": ["mobile-app", "phone-hand", "phones", "workspace-woman"],
  "game-development": ["game-setup", "game-art", "gaming-pad", "gaming-neon"],
  "digital-marketing": ["data-viz", "writer-desk", "analytics-laptop", "team-meeting"],
  "ui-ux-product-design": ["design-desk", "design-brand", "workspace-woman", "product"],
  "branding-creative-services": ["abstract-3d-2", "product", "photography", "writer-desk"],
  "ai-machine-learning-data": ["abstract-3d", "circuit", "global-tech", "dashboard"],
  "cloud-devops-infrastructure": ["server", "global-tech", "cyber", "circuit"],
  "cybersecurity-technical-consulting": ["cyber", "code-closeup", "circuit", "server"],
  "emerging-specialized-technologies": ["circuit", "abstract-3d", "server", "global-tech"],
};

const PROVIDER_POOL_OVERRIDES = {
  atlas: ["storefront", "retail", "product", "web-portal"],
  brightpath: ["data-viz", "writer-desk", "analytics-laptop", "team-meeting"],
  studioember: ["abstract-3d-2", "product", "photography", "design-desk"],
  noah: ["photography", "abstract-3d-2", "product", "gaming-neon"],
  vera: ["dashboard", "abstract-3d", "circuit", "analytics-laptop"],
  pixelforge: ["game-setup", "game-art", "gaming-pad", "gaming-neon"],
};

const SERVICE_IMAGES = {
  "SaaS MVP design-to-deploy package": ["design-brand", "dashboard"],
  "API and database modernization sprint": ["code-closeup", "server"],
  "React Native app build for iOS and Android": ["mobile-app", "phone-hand"],
  "Mobile app performance audit and fixes": ["phones", "code-closeup"],
  "SaaS dashboard UX and UI redesign": ["design-desk", "dashboard"],
  "Mobile design system in Figma": ["design-brand", "phone-hand"],
  "Unity multiplayer prototype": ["game-setup", "gaming-pad"],
  "Gameplay systems and mechanics tuning": ["game-art", "gaming-neon"],
  "Stylised 2D game production": ["game-art", "gaming-pad"],
  "Game prototype sprint": ["game-setup", "gaming-neon"],
  "Enterprise web platform modernization": ["code-screen", "dev-collab"],
  "Custom CRM for your operations team": ["dashboard", "team-meeting"],
  "AI assistant integration for your product": ["abstract-3d", "dashboard"],
  "Business intelligence dashboard with forecasting": ["analytics-laptop", "data-viz"],
  "B2B SEO growth program": ["writer-desk", "data-viz"],
  "Performance marketing sprint": ["analytics-laptop", "team-meeting"],
  "Brand identity system": ["design-brand", "photography"],
  "Product launch motion kit": ["photography", "abstract-3d-2"],
  "Production-grade cloud migration": ["server", "global-tech"],
  "CI/CD and observability setup": ["code-closeup", "dashboard"],
  "Application security review": ["cyber", "code-closeup"],
  "Secure authentication implementation": ["cyber", "server"],
  "E-commerce replatform for growing brands": ["storefront", "retail"],
  "Marketplace web portal build": ["web-portal", "design-brand"],
  "Short-form video and motion package": ["photography", "abstract-3d-2"],
  "3D product visualisation set": ["abstract-3d", "product"],
  "Recommendation system discovery sprint": ["abstract-3d", "data-viz"],
  "RAG chatbot with evaluation harness": ["dashboard", "analytics-laptop"],
};

const PROJECT_IMAGES = {
  "Pulseboard — logistics analytics platform": ["dashboard", "analytics-laptop", "code-screen"],
  "Relay — API-first booking platform": ["code-closeup", "web-portal", "server"],
  "Fieldnote — offline-first inspection app": ["phone-hand", "mobile-app", "phones"],
  "Zenith — finance analytics redesign": ["dashboard", "design-desk", "data-viz"],
  "Luma — marketplace mobile app design": ["mobile-app", "phones", "design-brand"],
  "Ironwood Tactics — multiplayer strategy prototype": ["game-setup", "game-art", "gaming-neon"],
  "Mosslight — hand-painted 2D adventure": ["game-art", "gaming-pad", "game-setup"],
  "Starfall Arena — multiplayer game prototype": ["gaming-neon", "game-setup", "game-art"],
  "Kestrel ERP — manufacturing operations platform": ["code-screen", "dev-collab", "dashboard"],
  "Cedar CRM — relationship workspace for retail teams": ["team-meeting", "dashboard", "dev-collab"],
  "Sage — evaluated support assistant": ["abstract-3d", "code-closeup", "dashboard"],
  "Meridian — demand forecasting workspace": ["analytics-laptop", "data-viz", "dashboard"],
  "Formwell — B2B organic growth program": ["writer-desk", "analytics-laptop", "team-meeting"],
  "Harbor & Finch — coastal hotel identity": ["photography", "design-brand", "product"],
  "Meridian — multi-region Kubernetes rollout": ["server", "global-tech", "circuit"],
  "Fintech auth hardening review": ["cyber", "circuit", "code-closeup"],
  "Nori Home — headless commerce build": ["retail", "storefront", "product"],
  "Aster — launch film and motion toolkit": ["photography", "gaming-neon", "abstract-3d-2"],
  "Atlas Recommend — evaluation-led recommender": ["abstract-3d", "analytics-laptop", "dashboard"],
};

const toPhotos = (names) => names.map(photo);

function serviceImages(providerKey, categorySlug, title) {
  const chosen = SERVICE_IMAGES[title];
  return chosen ? toPhotos(chosen) : imagesFor(providerKey, categorySlug, title, 2);
}

function projectImages(providerKey, categorySlug, title) {
  const chosen = PROJECT_IMAGES[title];
  return chosen ? toPhotos(chosen) : imagesFor(providerKey, categorySlug, title, 3);
}

function hash(value) {
  return String(value)
    .split("")
    .reduce((total, char) => (total * 31 + char.charCodeAt(0)) % 1000003, 7);
}

function imageNames(providerKey, categorySlug, seed, count = 2) {
  const pool =
    PROVIDER_POOL_OVERRIDES[providerKey] ||
    CATEGORY_POOLS[categorySlug] ||
    CATEGORY_POOLS["website-development"];
  const offset = hash(`${providerKey}:${seed}`);
  return Array.from({ length: count }, (_, index) => pool[(offset + index) % pool.length]);
}

function imagesFor(providerKey, categorySlug, seed, count = 2) {
  return imageNames(providerKey, categorySlug, seed, count).map(photo);
}

function avatarForProvider(providerKey) {
  return PROVIDER_AVATARS[providerKey] || photo("face-aria");
}

function avatarForUser(userKey) {
  return USER_AVATARS[userKey] || photo("person-sam");
}

function coverForProvider(providerKey) {
  return PROVIDER_COVERS[providerKey] || photo("abstract-3d");
}

module.exports = {
  photo,
  imagesFor,
  serviceImages,
  projectImages,
  avatarForProvider,
  avatarForUser,
  coverForProvider,
  PROVIDER_AVATARS,
  PROVIDER_COVERS,
  USER_AVATARS,
  CATEGORY_POOLS,
};
