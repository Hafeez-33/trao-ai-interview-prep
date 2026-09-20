import { Request, Response, NextFunction } from "express";

/**
 * Middleware ensuring the request is made by an authenticated session.
 * Attaches the authenticated SafeUser to req.user for downstream handlers.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
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

  req.user = req.session.user;
  next();
}
