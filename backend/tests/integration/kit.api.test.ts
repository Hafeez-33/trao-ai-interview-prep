import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import session from "express-session";
import http from "node:http";
import { kitRouter } from "../../src/routes/kit.routes.js";
import { errorHandler } from "../../src/middleware/errorHandler.js";

describe("Kit API Integration Tests", () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use(
      session({
        secret: "test-kit-integration-secret",
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

  it("GET /api/v1/kits returns 401 UNAUTHORIZED when unauthenticated", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/kits`);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("UNAUTHORIZED");
  });

  it("POST /api/v1/kits returns 401 UNAUTHORIZED when unauthenticated", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/kits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jd: "Valid job description for test." }),
    });
    expect(res.status).toBe(401);
  });

  it("GET /api/v1/kits/:id with malformed ObjectId returns 401 when unauthenticated", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/kits/invalid-id-format`);
    expect(res.status).toBe(401);
  });
});
