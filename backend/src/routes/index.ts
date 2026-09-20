import { Router } from "express";
import { healthRouter } from "./health.routes.js";
import { authRouter } from "./auth.routes.js";

export const routes = Router();

// Mount health routes at root level
routes.use(healthRouter);

// Mount API v1 routes
routes.use("/api/v1/auth", authRouter);
