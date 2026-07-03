import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/User.js";

/**
 * Verify the Bearer JWT, load the user, and attach it to req.user.
 * Any token problem surfaces as a 401 via the central error handler.
 */
export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) {
      throw ApiError.unauthorized("Missing or malformed Authorization header");
    }
    const token = header.slice("Bearer ".length).trim();

    // jwt.verify throws JsonWebTokenError / TokenExpiredError -> normalized to 401.
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Re-load the user so a deleted/renamed account can't keep acting on a stale token.
    const user = await User.findById(payload.id);
    if (!user) {
      throw ApiError.unauthorized("Account no longer exists");
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Role gate. Usage: authorize("admin"). Must run after `authenticate`.
 * Server-side enforcement is authoritative — never trust client-side role checks.
 */
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden());
    }
    next();
  };
}
