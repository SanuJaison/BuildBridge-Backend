const { ZodError } = require("zod");
const ApiError = require("../utils/ApiError");

function validate(schema, part = "body") {
  return (req, _res, next) => {
    try {
      req[part] = schema.parse(req[part]);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return next(
          ApiError.badRequest(
            "Please check the highlighted fields",
            error.issues.map((issue) => ({
              field: issue.path.join(".") || part,
              message: issue.message,
            }))
          )
        );
      }
      next(error);
    }
  };
}

module.exports = { validate };
