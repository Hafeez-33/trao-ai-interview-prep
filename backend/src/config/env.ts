import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Locate .env file: check current directory first, then root project directory
const cwdEnvPath = path.resolve(process.cwd(), ".env");
const rootEnvPath = path.resolve(process.cwd(), "..", ".env");

if (fs.existsSync(cwdEnvPath)) {
  dotenv.config({ path: cwdEnvPath });
} else if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else {
  dotenv.config();
}

export interface AppConfig {
  port: number;
  nodeEnv: "development" | "production" | "test";
  databaseUrl: string;
  sessionSecret: string;
  llmApiKey: string;
  geminiModel: string;
}

export function sanitizeDatabaseUrl(url?: string): string {
  if (!url) return "<not-set>";
  try {
    // Replace username:password in mongodb URI with redacted placeholders
    return url.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
  } catch {
    return "<redacted-database-url>";
  }
}

export function loadConfig(): AppConfig {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error(
      "Configuration error: Missing required environment variable 'DATABASE_URL'."
    );
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  const nodeEnv = (process.env.NODE_ENV || "development") as AppConfig["nodeEnv"];
  
  // Load session secret, providing a fallback default in local development
  const sessionSecret =
    process.env.SESSION_SECRET?.trim() ||
    (nodeEnv === "development" ? "trao-dev-session-secret-change-in-prod" : "");

  if (!sessionSecret && nodeEnv === "production") {
    throw new Error(
      "Configuration error: Missing required environment variable 'SESSION_SECRET' in production."
    );
  }

  const llmApiKey = process.env.LLM_API_KEY?.trim() || "";
  const geminiModel =
    process.env.GEMINI_MODEL?.trim() ||
    process.env.LLM_MODEL?.trim() ||
    "gemini-2.5-flash";

  return {
    port: isNaN(port) ? 5000 : port,
    nodeEnv,
    databaseUrl,
    sessionSecret: sessionSecret || "trao-default-secret",
    llmApiKey,
    geminiModel,
  };
}

export const config = loadConfig();
