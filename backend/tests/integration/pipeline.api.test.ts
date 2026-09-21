import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import session from "express-session";
import http from "node:http";
import { kitRouter } from "../../src/routes/kit.routes.js";
import { errorHandler } from "../../src/middleware/errorHandler.js";

describe("Pipeline API Integration Tests", () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use(
      session({
        secret: "test-pipeline-integration-secret",
        resave: false,
        saveUninitialized: false,
        cookie: { httpOnly: true, secure: false },
      })
    );
    app.use("/api/v1/kits", kitRouter);
    app.use(errorHandler);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        port = (server.address() as { port: number }).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const kitId = "6ab0b02647b5ec03f320cfd8";

  it("POST /api/v1/kits/:id/extract requires authentication (401)", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/kits/${kitId}/extract`, {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  it("POST /api/v1/kits/:id/crawl requires authentication (401)", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/kits/${kitId}/crawl`, {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  it("POST /api/v1/kits/:id/research requires authentication (401)", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/kits/${kitId}/research`, {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  it("POST /api/v1/kits/:id/generate requires authentication (401)", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/kits/${kitId}/generate`, {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  it("POST /api/v1/kits/:id/coverage requires authentication (401)", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/kits/${kitId}/coverage`, {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  it("POST /api/v1/kits/:id/schedule requires authentication (401)", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/kits/${kitId}/schedule`, {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  it("POST /api/v1/kits/:id/validate requires authentication (401)", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/kits/${kitId}/validate`, {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  it("POST /api/v1/kits/:id/regenerate requires authentication (401)", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/kits/${kitId}/regenerate`, {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  it("GET /api/v1/kits/:id/practice requires authentication (401)", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/kits/${kitId}/practice`);
    expect(res.status).toBe(401);
  });
});
