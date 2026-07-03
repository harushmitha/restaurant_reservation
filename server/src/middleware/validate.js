import { validationResult } from "express-validator";
import { ApiError } from "../utils/ApiError.js";

/**
 * Collects express-validator results and, if any failed, throws a 400 ApiError
 * carrying field-level messages. Placed after a route's validation chain.
 */
export function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = result.array().map((e) => ({
    field: e.path,
    message: e.msg,
  }));
  next(ApiError.badRequest("Validation failed", errors));
}
