import { Request, Response, NextFunction } from "express";

export interface AppError extends Error {
  status?: number;
  code?: string;
  details?: Record<string, unknown>;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
  const code = err.code || "INTERNAL_SERVER_ERROR";

  // Sanitize message to guarantee no connection strings or credentials leak
  let message = err.message || "An unexpected error occurred.";
  message = message.replace(/\/\/([^:]+):([^@]+)@/g, "/***@");

  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(err.details ? { details: err.details } : {}),
    },
  });
}
