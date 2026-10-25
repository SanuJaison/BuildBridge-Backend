const { slugify } = require("../utils/helpers");

const FIRST_NAMES = [
  "Avery", "Jordan", "Riley", "Casey", "Morgan", "Quinn", "Rowan", "Sage", "Aubrey", "Blake",
  "Devon", "Ellis", "Finley", "Gray", "Harper", "Jamie", "Kai", "Logan", "Micah", "Nico",
  "Oakley", "Parker", "Reese", "Skyler", "Tatum", "Urban", "Val", "Winter", "Xen", "Yael",
  "Zion", "Ada", "Bruno", "Cleo", "Dante", "Esme", "Felix", "Greta", "Hugo", "Ines",
  "Jonas", "Kira", "Lena", "Milo", "Nadia", "Otto", "Petra", "Ramon", "Sylvia", "Theo",
];

const LAST_NAMES = [
  "Alvarez", "Bennett", "Castillo", "Delgado", "Ellison", "Frost", "Gallagher", "Hayes", "Ibarra", "Jennings",
  "Kaufman", "Lowe", "Mercer", "Novak", "Osborne", "Pruitt", "Quintero", "Rhodes", "Sandoval", "Thornton",
  "Underwood", "Vaughn", "Whitfield", "Yates", "Zamora", "Ashford", "Blackwood", "Crane", "Donnelly", "Emerson",
  "Fairbanks", "Granger", "Holloway", "Ingram", "Kingsley", "Larkin", "Monroe", "Nash", "Prescott", "Radcliffe",
];

const BRAND_PREFIX = [
  "North", "Iron", "Blue", "Silver", "Keystone", "Beacon", "Copper", "Atlas", "Vertex", "Lunar",
  "Summit", "Harbor", "Cinder", "Nova", "Pine", "Granite", "Willow", "Fox", "Halo", "Drift",
  "Ember", "Quartz", "Ridge", "Sable", "Tundra", "Umbra", "Vista", "Wren", "Juniper", "Onyx",
];

const BRAND_NOUN = [
  "beam", "forge", "lane", "works", "field", "stone", "bridge", "loop", "craft", "light",
  "line", "mesh", "point", "shift", "stack", "thread", "wave", "yard", "core", "grid",
  "hive", "mark", "path", "root", "spark", "trace", "vault", "grove", "haven", "spire",
];

const ORG_SUFFIXES = {
  company: ["Ltd", "Digital", "Technologies", "Systems", "Co"],
  agency: ["Agency", "Collective", "Partners", "Media"],
  studio: ["Studio", "Interactive", "Creative", "Lab"],
};

const LOCATIONS = [
  "Toronto, Canada", "Berlin, Germany", "Lisbon, Portugal", "Warsaw, Poland", "Nairobi, Kenya",
  "Sydney, Australia", "São Paulo, Brazil", "Mexico City, Mexico", "Amsterdam, Netherlands", "Seoul, South Korea",
  "Bangalore, India", "Dublin, Ireland", "Prague, Czech Republic", "Auckland, New Zealand", "Lyon, France",
  "Barcelona, Spain", "Tokyo, Japan", "Cape Town, South Africa", "Buenos Aires, Argentina", "Helsinki, Finland",
  "Singapore", "Remote-first", "Chicago, United States", "London, United Kingdom",
];

const LANGUAGE_SETS = [
  ["English"],
  ["English", "Spanish"],
  ["English", "French"],
  ["English", "German"],
  ["English", "Hindi"],
  ["English", "Portuguese"],
  ["English", "Polish"],
  ["English", "Japanese"],
];

const TYPE_ROTATION = [
  "freelancer",
  "freelancer",
  "developer",
  "company",
  "freelancer",
  "developer",
  "agency",
  "freelancer",
  "studio",
  "company",
];

const AVAILABILITY_ROTATION = [
  "available",
  "available",
  "limited",
  "available",
  "unavailable",
  "available",
  "limited",
  "available",
  "available",
  "unavailable",
];

const ENGAGEMENT_ROTATION = [
  ["Fixed-scope project"],
  ["Fixed-scope project", "Ongoing support"],
  ["Monthly retainer"],
  ["Fixed-scope project"],
  ["Fixed-scope project", "Monthly retainer"],
];

const SERVICE_TITLES = [
  "{sub} package",
  "{sub} — scoped delivery",
  "{sub} starter engagement",
];

const PLAYBOOKS = {
  "website-development": {
    roleLabel: "web developer",
    skills: ["HTML/CSS", "JavaScript", "React", "Next.js", "WordPress", "Tailwind CSS", "Web performance", "Technical SEO"],
    technologies: ["React", "Next.js", "Tailwind CSS", "WordPress", "Vercel", "Netlify"],
    headlines: [
      "{sub} specialist shipping fast, accessible websites",
      "Marketing websites that load quickly and convert",
      "Pragmatic web builds for teams that need results",
    ],
    deliverableLead: "Launch-ready website",
    clientProject: "website",
  },
  "web-application-development": {
    roleLabel: "software engineer",
    skills: ["JavaScript", "TypeScript", "React", "Node.js", "Express", "MongoDB", "PostgreSQL", "API design"],
    technologies: ["React", "Node.js", "Express", "MongoDB", "PostgreSQL", "Docker"],
    headlines: [
      "{sub} engineer for products that need to ship",
      "Full-stack builds with clean data models and APIs",
      "Business software delivered in steady milestones",
    ],
    deliverableLead: "Production application",
    clientProject: "web platform",
  },
  "mobile-application-development": {
    roleLabel: "mobile developer",
    skills: ["React Native", "Flutter", "Swift", "Kotlin", "Expo", "REST APIs", "App Store submission", "Offline sync"],
    technologies: ["React Native", "Flutter", "Expo", "Firebase", "Swift", "Kotlin"],
    headlines: [
      "{sub} specialist building reliable mobile releases",
      "Cross-platform apps with native-feel detail",
      "From prototype to App Store, without the drama",
    ],
    deliverableLead: "Store-ready mobile app",
    clientProject: "mobile app",
  },
  "game-development": {
    roleLabel: "game developer",
    skills: ["Unity", "Unreal Engine", "Godot", "C#", "Gameplay programming", "2D art pipelines", "Multiplayer systems", "Game UI"],
    technologies: ["Unity", "Unreal Engine", "Godot", "C#", "Blender", "Photon"],
    headlines: [
      "{sub} craft from prototype to polished build",
      "Gameplay systems that hold up under real play",
      "Small-team game production with visible progress",
    ],
    deliverableLead: "Playable game build",
    clientProject: "game",
  },
  "digital-marketing": {
    roleLabel: "digital marketer",
    skills: ["SEO", "Content strategy", "Google Ads", "Analytics", "Email marketing", "Conversion optimization", "Social media", "Marketing automation"],
    technologies: ["Google Analytics", "Search Console", "Google Ads", "HubSpot", "Mailchimp", "Semrush"],
    headlines: [
      "{sub} programs measured against revenue, not vanity metrics",
      "Organic and paid growth with honest reporting",
      "Marketing engines that keep running after launch",
    ],
    deliverableLead: "Launched marketing program",
    clientProject: "growth program",
  },
  "ui-ux-product-design": {
    roleLabel: "product designer",
    skills: ["UX research", "Wireframing", "Figma", "Prototyping", "Design systems", "Interaction design", "Usability testing", "Accessibility"],
    technologies: ["Figma", "FigJam", "Maze", "Storybook", "Zeroheight"],
    headlines: [
      "{sub} shaped by research, not guesswork",
      "Interfaces that feel obvious on the first visit",
      "Design systems that scale past the first release",
    ],
    deliverableLead: "Tested design deliverable",
    clientProject: "product design",
  },
  "branding-creative-services": {
    roleLabel: "brand designer",
    skills: ["Brand identity", "Logo design", "Art direction", "Motion graphics", "Illustration", "Typography", "Video editing", "Copywriting"],
    technologies: ["Illustrator", "Photoshop", "After Effects", "Figma", "Blender"],
    headlines: [
      "{sub} with a distinct point of view",
      "Brand systems built to flex across every channel",
      "Creative production that respects the deadline",
    ],
    deliverableLead: "Finished creative package",
    clientProject: "brand rollout",
  },
  "ai-machine-learning-data": {
    roleLabel: "AI engineer",
    skills: ["Python", "Machine learning", "LLM integration", "Data pipelines", "Prompt engineering", "Evaluation design", "Analytics", "Automation"],
    technologies: ["Python", "OpenAI API", "LangChain", "PostgreSQL", "dbt", "Vertex AI"],
    headlines: [
      "{sub} grounded in real evaluation, not demos",
      "Applied AI that survives contact with production",
      "Data products with honest metrics behind them",
    ],
    deliverableLead: "Working AI or data system",
    clientProject: "AI rollout",
  },
  "cloud-devops-infrastructure": {
    roleLabel: "DevOps engineer",
    skills: ["AWS", "CI/CD", "Docker", "Kubernetes", "Terraform", "Monitoring", "Linux", "Incident response"],
    technologies: ["AWS", "Docker", "Kubernetes", "Terraform", "GitHub Actions", "Grafana"],
    headlines: [
      "{sub} with boring, reliable operations",
      "Infrastructure that deploys quietly and often",
      "Pipelines and platforms teams actually enjoy",
    ],
    deliverableLead: "Operational infrastructure",
    clientProject: "platform migration",
  },
  "cybersecurity-technical-consulting": {
    roleLabel: "security specialist",
    skills: ["Security review", "Threat modeling", "Secure authentication", "Penetration testing", "Code auditing", "Compliance", "Architecture consulting"],
    technologies: ["OWASP", "Burp Suite", "Wireshark", "Snyk", "Vault"],
    headlines: [
      "{sub} with a defensive, engineering-first mindset",
      "Security work scoped to real business risk",
      "Independent technical consulting without the jargon",
    ],
    deliverableLead: "Security assessment report",
    clientProject: "security engagement",
  },
  "emerging-specialized-technologies": {
    roleLabel: "technical consultant",
    skills: ["System integration", "API integrations", "Blockchain", "Smart contracts", "AR/VR prototyping", "IoT", "Payment integrations"],
    technologies: ["Solidity", "Web3.js", "Unity XR", "Stripe API", "MQTT", "Node.js"],
    headlines: [
      "{sub} handled with engineering rigor",
      "Specialized builds beyond the standard stack",
      "Integration work that connects cleanly to what you have",
    ],
    deliverableLead: "Integrated working system",
    clientProject: "integration",
  },
};

function makeRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value) {
  let total = 7;
  for (const char of String(value)) total = (total * 31 + char.charCodeAt(0)) % 1000003;
  return total;
}

function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

function pickN(rng, items, count) {
  const copy = [...items];
  const chosen = [];
  while (chosen.length < count && copy.length) {
    chosen.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
  }
  return chosen;
}

function personName(rng, used) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const name = `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  const fallback = `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)} ${pick(rng, ["Jr", "II", "III"])}`;
  used.add(fallback);
  return fallback;
}

function brandName(rng, type, used) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const name = `${pick(rng, BRAND_PREFIX)}${pick(rng, BRAND_NOUN)} ${pick(rng, ORG_SUFFIXES[type])}`;
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  const fallback = `${pick(rng, BRAND_PREFIX)}${pick(rng, BRAND_NOUN)} ${pick(rng, ORG_SUFFIXES[type])} ${Math.floor(rng() * 90 + 10)}`;
  used.add(fallback);
  return fallback;
}

function clientBrand(rng) {
  return `${pick(rng, BRAND_PREFIX)}${pick(rng, BRAND_NOUN)}`;
}

function bioFor({ type, roleLabel, parentName, sub, location }) {
  const flavors = {
    freelancer: `Independent ${roleLabel} based in ${location}, focused on ${sub.toLowerCase()} and wider ${parentName.toLowerCase()} work. I keep scopes tight, communicate in plain language, and hand over clean, documented work. Typical engagements run from a few weeks to a couple of months.`,
    developer: `Software developer working across ${parentName.toLowerCase()}, with a current focus on ${sub.toLowerCase()}. I care about maintainable code, honest estimates, and shipping in small, reviewable steps.`,
    company: `A small company offering ${parentName.toLowerCase()} services, with ${sub.toLowerCase()} as a core service line. We pair senior people with clear delivery practices so projects stay predictable.`,
    agency: `A multi-disciplinary agency delivering ${parentName.toLowerCase()} work. ${sub} is one of our focused service lines, handled by a dedicated pod with a single point of contact.`,
    studio: `A specialist studio for ${parentName.toLowerCase()}. We take on a small number of ${sub.toLowerCase()} engagements at a time and stay hands-on from scoping to delivery.`,
  };
  return `${flavors[type]}\n\nDemo profile created for BuildBridge development.`;
}

function buildBulkProviders(categorySpecs, { perSubcategory = 10 } = {}) {
  const usedNames = new Set();
  const specs = [];
  let counter = 0;

  for (const parent of categorySpecs) {
    const playbook = PLAYBOOKS[parent.slug];
    if (!playbook) continue;

    for (const sub of parent.children) {
      for (let slot = 0; slot < perSubcategory; slot += 1) {
        counter += 1;
        const key = `bulk-${parent.slug}-${slugify(sub) || "item"}-${String(slot + 1).padStart(2, "0")}`;
        const rng = makeRng(hashString(key));
        const type = TYPE_ROTATION[slot % TYPE_ROTATION.length];
        const isOrg = type === "company" || type === "agency" || type === "studio";
        const displayName = isOrg ? brandName(rng, type, usedNames) : personName(rng, usedNames);
        const location = pick(rng, LOCATIONS).trim();
        const serviceType = slot % 3 === 2 ? "hourly" : "fixed";
        const email = `provider${String(counter).padStart(4, "0")}@demo.buildbridge.dev`;
        const headlineBase = pick(rng, playbook.headlines);
        const headline = headlineBase.replace("{sub}", sub);
        const priceBase = 900 + Math.floor(rng() * 38) * 100;
        const client = clientBrand(rng);
        const createdDaysAgo = 90 + Math.floor(rng() * 300);
        const completedDaysAgo = 30 + Math.floor(rng() * 340);
        const completion = new Date(Date.now() - completedDaysAgo * 24 * 60 * 60 * 1000);
        const engagementTypes = pick(rng, ENGAGEMENT_ROTATION);

        specs.push({
          key,
          bulk: true,
          type,
          owner: {
            name: displayName,
            email,
            avatar: 1 + Math.floor(rng() * 23),
          },
          displayName,
          headline,
          bio: bioFor({ type, roleLabel: playbook.roleLabel, parentName: parent.name, sub, location }),
          category: parent.slug,
          subs: [sub],
          skills: pickN(rng, playbook.skills, 4 + Math.floor(rng() * 3)),
          technologies: pickN(rng, playbook.technologies, 4),
          languages: pick(rng, LANGUAGE_SETS),
          location,
          remote: rng() > 0.25,
          experienceYears: 2 + Math.floor(rng() * 12),
          startingBudget: Math.round((priceBase + rng() * 2600) / 100) * 100,
          hourlyRate: 25 + Math.floor((rng() * 110) / 5) * 5,
          availability: AVAILABILITY_ROTATION[slot % AVAILABILITY_ROTATION.length],
          featured: slot === 0 && rng() > 0.5,
          verified: rng() > 0.92,
          avatar: 1 + Math.floor(rng() * 23),
          cover: 1 + Math.floor(rng() * 12),
          engagementTypes,
          createdDaysAgo,
          organization: isOrg
            ? {
                name: displayName,
                description: `${displayName} is a fictional ${type} offering ${parent.name.toLowerCase()} services, with a focus on ${sub.toLowerCase()}. Seeded for BuildBridge demo purposes.`,
                industry: parent.name,
                location,
                companySize: pick(rng, ["2-10", "11-50", "51-200"]),
                yearEstablished: 2012 + Math.floor(rng() * 13),
                logoIndex: 1 + Math.floor(rng() * 23),
              }
            : undefined,
          services: [
            {
              title: pick(rng, SERVICE_TITLES).replace("{sub}", sub),
              sub,
              price: serviceType === "hourly" ? 25 + Math.floor((rng() * 110) / 5) * 5 : priceBase,
              type: serviceType,
              days: 7 + Math.floor(rng() * 49),
              description: `A scoped ${parent.name.toLowerCase()} engagement for ${sub.toLowerCase()}. We start with a short discovery call, agree on a tight scope with visible milestones, and finish with a documented handover. This fictional package demonstrates the BuildBridge services experience.`,
              deliverables: [
                `${sub} discovery and scope session`,
                `${playbook.deliverableLead} implementation`,
                "Two structured revision rounds",
                "Deployment and handover notes",
              ],
              requirements: [
                "A clear goal for the engagement",
                "Brand assets or content, if available",
                "One decision-maker available for reviews",
              ],
              tags: pickN(rng, playbook.skills, 4),
              faqs: [
                {
                  question: "How do we get started?",
                  answer: "Send an inquiry with your goals and timeline. We reply with a short discovery call and a written scope before any work begins.",
                },
              ],
            },
          ],
          projects: [
            {
              title: `${client} — ${sub.toLowerCase()}`,
              sub,
              summary: `A fictional ${playbook.clientProject} case study completed for a client in ${location}.`,
              description: `${client} is a fictional case study showing a completed ${sub.toLowerCase()} engagement: scoped discovery, steady delivery, and a documented handover. Images and outcomes are illustrative.\n\nThis project is fictional demo content created for the BuildBridge portfolio experience.`,
              technologies: pickN(rng, playbook.technologies, 4),
              role: `Lead ${playbook.roleLabel}`,
              images: [1, 2],
              completionDate: completion.toISOString().slice(0, 10),
              featured: false,
            },
          ],
        });
      }
    }
  }

  return specs;
}

module.exports = { buildBulkProviders };
