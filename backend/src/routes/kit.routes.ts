import { Router } from "express";
import {
  createKitHandler,
  listKitsHandler,
  getKitByIdHandler,
  updateKitHandler,
  deleteKitHandler,
  extractRequirementsHandler,
  crawlCompanyHandler,
  researchCompanyHandler,
  generateKitHandler,
  coverageKitHandler,
  scheduleKitHandler,
  validateKitHandler,
  regenerateKitHandler,
  getPracticeStateHandler,
  recordConfidenceHandler,
  resetPracticeHandler,
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
kitRouter.post("/:id/crawl", crawlCompanyHandler);
kitRouter.post("/:id/research", researchCompanyHandler);
kitRouter.post("/:id/generate", generateKitHandler);
kitRouter.post("/:id/coverage", coverageKitHandler);
kitRouter.post("/:id/schedule", scheduleKitHandler);
kitRouter.post("/:id/validate", validateKitHandler);
kitRouter.post("/:id/regenerate", regenerateKitHandler);
kitRouter.get("/:id/practice", getPracticeStateHandler);
kitRouter.post("/:id/practice", recordConfidenceHandler);
kitRouter.post("/:id/practice/reset", resetPracticeHandler);
