const crypto = require("crypto");

function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function uniqueSlug(Model, base, excludeId = null) {
  const root = slugify(base) || "item";
  let candidate = root;
  let counter = 1;
  while (true) {
    const query = { slug: candidate };
    if (excludeId) query._id = { $ne: excludeId };
    const existing = await Model.exists(query);
    if (!existing) return candidate;
    counter += 1;
    candidate = `${root}-${counter}`;
  }
}

function getPagination(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(48, Math.max(1, parseInt(query.limit, 10) || 12));
  return { page, limit, skip: (page - 1) * limit };
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pickDefined(source, keys) {
  const output = {};
  keys.forEach((key) => {
    if (source[key] !== undefined) output[key] = source[key];
  });
  return output;
}

function toId(value) {
  return String(value || "");
}

function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

module.exports = {
  slugify,
  uniqueSlug,
  getPagination,
  escapeRegex,
  pickDefined,
  toId,
  randomToken,
  hashToken,
};
