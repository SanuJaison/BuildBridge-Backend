const { z } = require("zod");

// Zod keeps `.default()` values when `.partial()` is applied, so a PATCH-style
// request for one field would also inject defaults for every absent field.
function optionalShape(schema) {
  return z.object(
    Object.fromEntries(
      Object.entries(schema.shape).map(([key, field]) => {
        const unwrapped = typeof field.removeDefault === "function" ? field.removeDefault() : field;
        return [key, unwrapped.optional()];
      })
    )
  );
}

module.exports = { optionalShape };
