import { Router, Request, Response } from "express";
import { pingDatabase } from "../db/connection.js";

export const healthRouter = Router();

healthRouter.get("/health", async (_req: Request, res: Response) => {
  const isDbConnected = await pingDatabase();

  if (isDbConnected) {
    res.status(200).json({
      status: "ok",
      database: "connected",
    });
  } else {
    res.status(503).json({
      status: "error",
      database: "disconnected",
    });
  }
});
