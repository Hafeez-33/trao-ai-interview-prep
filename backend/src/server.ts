import { app } from "./app.js";
import { config } from "./config/env.js";
import { connectDatabase, closeDatabase, ensureUserIndexes } from "./db/index.js";
import type { Server } from "http";

let server: Server | null = null;

async function startServer(): Promise<void> {
  try {
    // 1. Connect to MongoDB and verify connection via ping
    console.log("[server] Connecting to database...");
    await connectDatabase();
    console.log("[server] Database connection established and verified.");

    // 2. Initialize and ensure required database indexes
    await ensureUserIndexes();
    console.log("[server] Database indexes verified.");

    // 3. Start HTTP Server
    server = app.listen(config.port, () => {
      console.log(`[server] Trao Backend running on port ${config.port} (${config.nodeEnv})`);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown startup error";
    console.error(`[server] Fatal startup failure: ${message}`);
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  console.log(`\n[server] Received ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close(async () => {
      console.log("[server] HTTP server closed.");
      try {
        await closeDatabase();
        console.log("[server] Database connection closed.");
        process.exit(0);
      } catch (err) {
        console.error("[server] Error during database shutdown:", err);
        process.exit(1);
      }
    });

    // Force exit if shutdown hangs beyond 5 seconds
    setTimeout(() => {
      console.error("[server] Forced shutdown due to timeout.");
      process.exit(1);
    }, 5000);
  } else {
    await closeDatabase();
    process.exit(0);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

startServer();
