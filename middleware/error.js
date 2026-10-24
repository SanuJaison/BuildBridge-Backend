const { ZodError } = require("zod");
const multer = require("multer");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");

function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`No API route matches ${req.method} ${req.originalUrl}`));
}

function errorHandler(error, _req, res, _next) {
  let status = error.statusCode || 500;
  let message = error.message || "Something went wrong";
  let details = error.details;

  if (error instanceof ZodError) {
    status = 400;
    message = "Please check the highlighted fields";
    details = error.issues.map((issue) => ({
      field: issue.path.join(".") || "form",
      message: issue.message,
    }));
  } else if (error.name === "ValidationError" && error.errors) {
    status = 400;
    message = "Please check the submitted information";
    details = Object.values(error.errors).map((item) => ({ field: item.path, message: item.message }));
  } else if (error.name === "CastError") {
    status = 400;
    message = `Invalid value for ${error.path}`;
  } else if (error.code === 11000) {
    status = 409;
    const field = Object.keys(error.keyPattern || {})[0] || "value";
    message = `That ${field} is already in use`;
  } else if (error instanceof multer.MulterError) {
    status = 400;
    message = error.code === "LIMIT_FILE_SIZE" ? "That file is too large" : error.message;
  } else if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
    status = 401;
    message = "Your session has expired. Please sign in again.";
  }

  if (status >= 500) {
    console.error(error);
    if (env.isProduction && !error.isOperational) message = "Something went wrong on our side";
  }

  res.status(status).json({
    message,
    ...(details ? { errors: details } : {}),
    ...(!env.isProduction && status >= 500 && error.stack ? { stack: error.stack } : {}),
  });
}

module.exports = { notFoundHandler, errorHandler };
