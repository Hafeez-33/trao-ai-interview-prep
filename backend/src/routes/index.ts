import { Router } from "express";
import { healthRouter } from "./health.routes.js";

export const routes = Router();

// Mount health routes at root level
routes.use(healthRouter);
