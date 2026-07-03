import { ApiError } from "../utils/ApiError.js";

/** 404 handler for unmatched routes — forwards a not-found ApiError. */
export function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * Central error-handling middleware. Every route funnels errors here via next(err)
 * so responses share one shape: { success: false, message, errors? }.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies error middleware by arity (4 args).
export function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";
  let errors;

  if (err instanceof ApiError) {
    errors = err.errors;
  }

  // Mongoose validation errors -> 400 with field-level detail.
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Validation failed";
    errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  // Duplicate key (e.g. the partial unique index on confirmed reservations,
  // or a duplicate email/tableNumber) -> 409 Conflict.
  if (err.code === 11000) {
    statusCode = 409;
    if (err.keyPattern?.email) {
      message = "An account with this email already exists";
    } else if (err.keyPattern?.tableNumber) {
      message = "A table with this number already exists";
    } else {
      message = "This table is already booked for the selected date and time slot";
    }
  }

  // Malformed ObjectId in a path param -> 400 instead of a 500.
  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Invalid / expired JWTs -> 401 rather than a leaked 500.
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid authentication token";
  }
  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Authentication token expired";
  }

  // Log server-side faults (never expected in normal operation).
  if (statusCode >= 500) {
    console.error("[error]", err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors ? { errors } : {}),
  });
}
