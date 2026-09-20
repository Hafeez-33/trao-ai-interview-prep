import { Request, Response, NextFunction } from "express";
import { findUserByEmail, createUser, findUserById } from "../db/users.js";
import {
  hashPassword,
  comparePassword,
  isValidEmail,
  isValidPassword,
} from "../utils/password.js";
import { toSafeUser } from "../types/auth.js";

/**
 * POST /api/v1/auth/register
 * Registers a new user account, stores password hash, and starts a session.
 */
export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password, name } = req.body;

    // 1. Validate email
    if (!isValidEmail(email)) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUT_PARAMETERS",
          message: "A valid email address is required.",
        },
      });
      return;
    }

    // 2. Validate password
    const passwordValidation = isValidPassword(password);
    if (!passwordValidation.valid) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUT_PARAMETERS",
          message: passwordValidation.message || "Invalid password provided.",
        },
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 3. Check for duplicate email
    const existingUser = await findUserByEmail(normalizedEmail);
    if (existingUser) {
      res.status(409).json({
        success: false,
        error: {
          code: "EMAIL_ALREADY_EXISTS",
          message: "An account with this email already exists.",
        },
      });
      return;
    }

    // 4. Hash password and persist user
    const passwordHash = await hashPassword(password);
    const newUser = await createUser(normalizedEmail, passwordHash, name);
    const safeUser = toSafeUser(newUser);

    // 5. Establish authenticated session
    req.session.user = safeUser;
    req.session.save((err) => {
      if (err) {
        return next(err);
      }
      res.status(201).json({
        user: safeUser,
      });
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/auth/login
 * Authenticates user credentials and starts a session.
 */
export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUT_PARAMETERS",
          message: "Email and password are required.",
        },
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await findUserByEmail(normalizedEmail);

    // Generic error response to prevent account enumeration
    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid email or password.",
        },
      });
      return;
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid email or password.",
        },
      });
      return;
    }

    const safeUser = toSafeUser(user);

    // Establish session
    req.session.user = safeUser;
    req.session.save((err) => {
      if (err) {
        return next(err);
      }
      res.status(200).json({
        user: safeUser,
      });
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/auth/logout
 * Invalidates the current session and clears the auth cookie.
 */
export function logout(req: Request, res: Response, next: NextFunction): void {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        return next(err);
      }
      res.clearCookie("trao.sid", { path: "/" });
      res.status(200).json({
        message: "Successfully logged out",
      });
    });
  } else {
    res.clearCookie("trao.sid", { path: "/" });
    res.status(200).json({
      message: "Successfully logged out",
    });
  }
}

/**
 * GET /api/v1/auth/me
 * Returns current authenticated user profile.
 */
export async function getCurrentUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.session || !req.session.user || !req.session.user.id) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
      return;
    }

    // Verify user still exists in database
    const user = await findUserById(req.session.user.id);
    if (!user) {
      // User was removed from DB
      req.session.destroy(() => {});
      res.clearCookie("trao.sid", { path: "/" });
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "User account no longer exists.",
        },
      });
      return;
    }

    const safeUser = toSafeUser(user);
    res.status(200).json({
      authenticated: true,
      user: safeUser,
    });
  } catch (error) {
    next(error);
  }
}
