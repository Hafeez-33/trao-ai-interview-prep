import { RequestHandler } from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import { getClientPromise } from "../db/connection.js";
import { config } from "./env.js";

/**
 * Creates the express-session middleware backed by MongoDB store.
 * Uses getClientPromise() to share the singleton MongoDB connection.
 */
export function createSessionMiddleware(): RequestHandler {
  return session({
    name: "trao.sid",
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      clientPromise: getClientPromise(),
      collectionName: "sessions",
      ttl: 7 * 24 * 60 * 60, // 7 days in seconds
      autoRemove: "native",
      touchAfter: 24 * 3600, // Lazy session update once per 24h unless data modified
    }),
    cookie: {
      httpOnly: true,
      secure: config.nodeEnv === "production",
      sameSite: config.nodeEnv === "production" ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
      path: "/",
    },
  });
}
