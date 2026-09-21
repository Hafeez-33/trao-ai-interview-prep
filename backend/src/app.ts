import express, { Express } from "express";
import cors from "cors";
import { config } from "./config/env.js";
import { routes } from "./routes/index.js";
import { notFoundHandler } from "./middleware/notFoundHandler.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { createSessionMiddleware } from "./config/session.js";

export function createApp(): Express {
  const app = express();

  // Trust first proxy (Render / cloud load balancers)
  app.set("trust proxy", 1);

  // CORS configuration
  const allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5000",
    "http://127.0.0.1:5000",
  ];
  if (config.frontendUrl) {
    allowedOrigins.push(config.frontendUrl.replace(/\/+$/, ""));
  }

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, internal server-to-server)
        if (!origin) return callback(null, true);
        const normalizedOrigin = origin.replace(/\/+$/, "");
        if (allowedOrigins.includes(normalizedOrigin) || config.nodeEnv !== "production") {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Cookie", "X-Requested-With"],
      exposedHeaders: ["Set-Cookie"],
    })
  );

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
