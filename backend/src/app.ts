import express, { Express } from "express";
import { routes } from "./routes/index.js";
import { notFoundHandler } from "./middleware/notFoundHandler.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { createSessionMiddleware } from "./config/session.js";

export function createApp(): Express {
  const app = express();

  // JSON and URL-encoded body parsing
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // Session management with MongoDB store
  app.use(createSessionMiddleware());

  // Routes
  app.use(routes);

  // 404 Not Found Handler
  app.use(notFoundHandler);

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
