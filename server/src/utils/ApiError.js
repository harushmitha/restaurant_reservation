/**
 * Application error carrying an HTTP status code and optional field-level errors.
 * Thrown from controllers/services and normalized by the central error handler.
 */
export class ApiError extends Error {
  constructor(statusCode, message, errors = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true; // distinguishes expected errors from bugs
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(msg, errors) {
    return new ApiError(400, msg, errors);
  }
  static unauthorized(msg = "Not authenticated") {
    return new ApiError(401, msg);
  }
  static forbidden(msg = "You do not have permission to perform this action") {
    return new ApiError(403, msg);
  }
  static notFound(msg = "Resource not found") {
    return new ApiError(404, msg);
  }
  static conflict(msg) {
    return new ApiError(409, msg);
  }
}
