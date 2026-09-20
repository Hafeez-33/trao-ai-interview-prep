import { Router } from "express";
import {
  createKitHandler,
  listKitsHandler,
  getKitByIdHandler,
  updateKitHandler,
  deleteKitHandler,
  extractRequirementsHandler,
} from "../controllers/kit.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const kitRouter = Router();

// Enforce authentication on all Kit endpoints
kitRouter.use(requireAuth);

kitRouter.post("/", createKitHandler);
kitRouter.get("/", listKitsHandler);
kitRouter.get("/:id", getKitByIdHandler);
kitRouter.patch("/:id", updateKitHandler);
kitRouter.delete("/:id", deleteKitHandler);
kitRouter.post("/:id/extract", extractRequirementsHandler);
