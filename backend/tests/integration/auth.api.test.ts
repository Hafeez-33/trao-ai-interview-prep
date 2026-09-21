import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import session from "express-session";
import http from "node:http";
import { authRouter } from "../../src/routes/auth.routes.js";
import { errorHandler } from "../../src/middleware/errorHandler.js";

describe("Auth API Integration Tests", () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use(
      session({
        secret: "test-auth-integration-secret",
        resave: false,
        saveUninitialized: false,
        cookie: { httpOnly: true, secure: false },
      })
    );
    app.use("/api/v1/auth", authRouter);
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

  it("POST /api/v1/auth/register rejects password shorter than 8 characters", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice@example.com",
        password: "short",
        name: "Alice",
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("INVALID_INPUT_PARAMETERS");
  });

  it("POST /api/v1/auth/register rejects missing email or name", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: "password123",
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it("GET /api/v1/auth/me returns 401 UNAUTHORIZED when no session cookie is sent", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/me`);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("UNAUTHORIZED");
  });

  it("POST /api/v1/auth/login rejects empty email or password", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "",
        password: "",
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it("POST /api/v1/auth/logout succeeds with 200 and destroys session", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/logout`, {
      method: "POST",
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toBe("Successfully logged out");
  });
});
