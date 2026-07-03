import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";

function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
}

/**
 * POST /api/auth/register
 * Role always defaults to "customer" — the client cannot self-assign admin.
 */
export async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      throw ApiError.conflict("An account with this email already exists");
    }

    // Explicitly ignore any client-supplied `role`; never spread req.body here.
    const user = await User.create({ name, email, password, role: "customer" });

    const token = signToken(user);
    res.status(201).json({ success: true, token, user });
  } catch (err) {
    next(err);
  }
}

/** POST /api/auth/login — returns a JWT on valid credentials. */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // Password is select:false, so request it explicitly for the comparison.
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");

    // Uniform error for both "no such user" and "wrong password" to avoid
    // leaking which emails are registered (user enumeration defense).
    if (!user || !(await user.comparePassword(password))) {
      throw ApiError.unauthorized("Invalid email or password");
    }

    const token = signToken(user);
    res.json({ success: true, token, user });
  } catch (err) {
    next(err);
  }
}

/** GET /api/auth/me — current authenticated user's profile/role. */
export async function me(req, res) {
  res.json({ success: true, user: req.user });
}
