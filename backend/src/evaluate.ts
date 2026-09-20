#!/usr/bin/env node
/**
 * Headless Batch Evaluator CLI
 * Trao AI Interview Prep Kit — Phase 18 & 19 (Batch Evaluator & Robustness)
 *
 * Usage:
 *   npm run evaluate -- --input <cases.json> --output <kits.json> [--timeout <ms>]
 *   npm run evaluate -- --input ./cases/test.json --output ./results/output.json
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BatchCaseInput,
  BatchKitEntry,
  BatchKitEntryOk,
  BatchKitEntryFailed,
  BatchOutputStructure,
  KitStructure,
} from "./types/kit.js";
import { executeKitPipeline, PipelineError } from "./services/pipeline/index.js";
import { LlmError } from "./services/llm/types.js";
import { CrawlerError } from "./services/crawler/index.js";
import { ScheduleError } from "./services/schedule/index.js";

const DEFAULT_CASE_TIMEOUT_MS = 120000; // 120 seconds per case (satisfies 5 cases in 15 min)

interface CliArgs {
  inputPath?: string;
  outputPath?: string;
  timeoutMs?: number;
}

/**
 * Parses CLI arguments supporting --input, --output, and --timeout.
 */
function parseArgs(args: string[]): CliArgs {
  const result: CliArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--input") {
      result.inputPath = args[i + 1];
      i++;
    } else if (arg.startsWith("--input=")) {
      result.inputPath = arg.slice("--input=".length);
    } else if (arg === "--output") {
      result.outputPath = args[i + 1];
      i++;
    } else if (arg.startsWith("--output=")) {
      result.outputPath = arg.slice("--output=".length);
    } else if (arg === "--timeout") {
      const val = Number(args[i + 1]);
      if (!isNaN(val) && val > 0) {
        result.timeoutMs = val;
      }
      i++;
    } else if (arg.startsWith("--timeout=")) {
      const val = Number(arg.slice("--timeout=".length));
      if (!isNaN(val) && val > 0) {
        result.timeoutMs = val;
      }
    }
  }

  return result;
}

/**
 * Redacts secrets, connection strings, and sensitive tokens from error messages.
 */
function sanitizeErrorMessage(msg: string): string {
  if (!msg || typeof msg !== "string") return "Unknown error occurred.";
  let sanitized = msg;
  // Redact potential API keys (e.g. AIza..., Bearer ...)
  sanitized = sanitized.replace(/AIza[0-9A-Za-z-_]{35}/g, "[REDACTED_API_KEY]");
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED_TOKEN]");
  // Redact mongodb connection strings with passwords
  sanitized = sanitized.replace(/mongodb(\+srv)?:\/\/[^@\s]+@/gi, "mongodb$1://[REDACTED_AUTH]@");
  // Redact query parameter credentials
  sanitized = sanitized.replace(/(password|secret|apiKey|key)=([^&\s]+)/gi, "$1=[REDACTED]");
  // Limit length of error message to prevent buffer bloat
  if (sanitized.length > 1000) {
    sanitized = sanitized.slice(0, 1000) + "... (truncated)";
  }
  return sanitized;
}

/**
 * Wraps a promise in a deterministic per-case timeout.
 * Attaches a silent catch handler to prevent unhandled rejections if the underlying promise
 * later rejects after the timeout has fired.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  caseId: string
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new PipelineError(
          `Case execution timed out after ${timeoutMs}ms.`,
          "CASE_TIMEOUT",
          504
        )
      );
    }, timeoutMs);
  });

  // Attach silent catch to prevent unhandled rejection if the underlying promise rejects after timeout
  promise.catch(() => {});

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function runBatchEvaluator(args: string[] = process.argv.slice(2)): Promise<void> {
  const { inputPath, outputPath, timeoutMs = DEFAULT_CASE_TIMEOUT_MS } = parseArgs(args);

  // 1. Validate CLI Arguments
  if (!inputPath || !inputPath.trim()) {
    console.error("Error: Missing required argument '--input <path>'.");
    console.error("Usage: npm run evaluate -- --input <cases.json> --output <kits.json>");
    process.exitCode = 1;
    return;
  }

  if (!outputPath || !outputPath.trim()) {
    console.error("Error: Missing required argument '--output <path>'.");
    console.error("Usage: npm run evaluate -- --input <cases.json> --output <kits.json>");
    process.exitCode = 1;
    return;
  }

  // Resolve paths relative to user's invocation CWD
  const baseCwd = process.env.INIT_CWD || process.cwd();
  const resolvedInput = path.resolve(baseCwd, inputPath);
  const resolvedOutput = path.resolve(baseCwd, outputPath);

  // 2. Validate Input File Existence
  if (!fs.existsSync(resolvedInput)) {
    console.error(`Error: Input file does not exist: ${resolvedInput}`);
    process.exitCode = 1;
    return;
  }

  // 3. Read and Parse Input JSON
  let rawContent: string;
  try {
    rawContent = fs.readFileSync(resolvedInput, "utf-8");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to read input file";
    console.error(`Error: Unable to read input file: ${msg}`);
    process.exitCode = 1;
    return;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawContent);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Invalid JSON";
    console.error(`Error: Failed to parse input JSON: ${msg}`);
    process.exitCode = 1;
    return;
  }

  // 4. Extract Top-Level Collection
  let rawCases: unknown[] = [];
  if (Array.isArray(parsedJson)) {
    rawCases = parsedJson;
  } else if (parsedJson && typeof parsedJson === "object") {
    const record = parsedJson as Record<string, unknown>;
    if (Array.isArray(record.cases)) {
      rawCases = record.cases;
    } else if (Array.isArray(record.kits)) {
      rawCases = record.kits;
    } else {
      console.error("Error: Input JSON must contain an array or a top-level 'cases' / 'kits' collection.");
      process.exitCode = 1;
      return;
    }
  } else {
    console.error("Error: Input JSON must be an object or array.");
    process.exitCode = 1;
    return;
  }

  console.log(`[Batch Evaluator] Loaded ${rawCases.length} case(s) from ${inputPath}`);

  // 5. Process Every Case Sequentially in Input Order (Per-Case Failure Isolation)
  const results: BatchKitEntry[] = [];
  const seenCaseIds = new Set<string>();

  for (let idx = 0; idx < rawCases.length; idx++) {
    const item = rawCases[idx];
    const caseIndex = idx + 1;

    // Validate item shape (must be non-null object and not an array)
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      results.push({
        id: `case-${caseIndex}`,
        status: "failed",
        kit: null,
        error: {
          code: "INVALID_INPUT_PARAMETERS",
          message: "Case entry must be a valid JSON object.",
        },
      });
      console.log(`[Batch Evaluator] Processing (${caseIndex}/${rawCases.length}): case-${caseIndex}...`);
      console.log(`  -> FAILED: INVALID_INPUT_PARAMETERS`);
      continue;
    }

    const c = item as Record<string, unknown>;
    const rawId = c.id !== undefined && c.id !== null ? String(c.id).trim() : "";
    const caseId = rawId || `case-${caseIndex}`;

    console.log(`[Batch Evaluator] Processing (${caseIndex}/${rawCases.length}): ${caseId}...`);

    // Check for duplicate case ID in the input batch
    if (seenCaseIds.has(caseId)) {
      results.push({
        id: caseId,
        status: "failed",
        kit: null,
        error: {
          code: "INVALID_INPUT_PARAMETERS",
          message: `Duplicate case ID '${caseId}' detected in input collection.`,
        },
      });
      console.log(`  -> FAILED: INVALID_INPUT_PARAMETERS (Duplicate ID)`);
      continue;
    }
    seenCaseIds.add(caseId);

    // Job description validation
    if (c.jd === undefined || c.jd === null || typeof c.jd !== "string") {
      results.push({
        id: caseId,
        status: "failed",
        kit: null,
        error: {
          code: "INVALID_INPUT_PARAMETERS",
          message: "Job description is missing or not a string.",
        },
      });
      console.log(`  -> FAILED: INVALID_INPUT_PARAMETERS`);
      continue;
    }

    const jd = c.jd.trim();
    if (jd.length < 10) {
      results.push({
        id: caseId,
        status: "failed",
        kit: null,
        error: {
          code: "INVALID_INPUT_PARAMETERS",
          message: "Job description is too short (minimum 10 characters required).",
        },
      });
      console.log(`  -> FAILED: INVALID_INPUT_PARAMETERS`);
      continue;
    }

    if (jd.length > 50000) {
      results.push({
        id: caseId,
        status: "failed",
        kit: null,
        error: {
          code: "INVALID_INPUT_PARAMETERS",
          message: "Job description exceeds 50,000 character limit.",
        },
      });
      console.log(`  -> FAILED: INVALID_INPUT_PARAMETERS`);
      continue;
    }

    // Days validation (optional, defaults to 5; if provided must be integer in 1..60)
    const daysRaw = c.days !== undefined ? c.days : (c.days_available !== undefined ? c.days_available : 5);
    if (
      typeof daysRaw !== "number" ||
      !Number.isInteger(daysRaw) ||
      daysRaw < 1 ||
      daysRaw > 60
    ) {
      results.push({
        id: caseId,
        status: "failed",
        kit: null,
        error: {
          code: "INVALID_INPUT_PARAMETERS",
          message: "Preparation days must be an integer between 1 and 60.",
        },
      });
      console.log(`  -> FAILED: INVALID_INPUT_PARAMETERS`);
      continue;
    }
    const days = daysRaw;

    // Company URL validation (optional; if provided must be valid HTTP or HTTPS)
    const rawCompanyUrl =
      typeof c.company_url === "string"
        ? c.company_url.trim()
        : typeof c.url === "string"
        ? c.url.trim()
        : "";

    if (rawCompanyUrl) {
      if (rawCompanyUrl.length > 2000) {
        results.push({
          id: caseId,
          status: "failed",
          kit: null,
          error: {
            code: "INVALID_INPUT_PARAMETERS",
            message: "company_url exceeds maximum permitted length of 2,000 characters.",
          },
        });
        console.log(`  -> FAILED: INVALID_INPUT_PARAMETERS`);
        continue;
      }

      try {
        const parsedUrl = new URL(rawCompanyUrl);
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
          results.push({
            id: caseId,
            status: "failed",
            kit: null,
            error: {
              code: "INVALID_INPUT_PARAMETERS",
              message: `company_url must use http or https protocol (received '${parsedUrl.protocol}').`,
            },
          });
          console.log(`  -> FAILED: INVALID_INPUT_PARAMETERS`);
          continue;
        }
      } catch {
        results.push({
          id: caseId,
          status: "failed",
          kit: null,
          error: {
            code: "INVALID_INPUT_PARAMETERS",
            message: "Invalid company_url format.",
          },
        });
        console.log(`  -> FAILED: INVALID_INPUT_PARAMETERS`);
        continue;
      }
    }

    // Bounded metadata strings
    const company =
      typeof c.company === "string"
        ? c.company.trim().slice(0, 500)
        : typeof c.company_name === "string"
        ? c.company_name.trim().slice(0, 500)
        : "";
    const role =
      typeof c.role === "string"
        ? c.role.trim().slice(0, 500)
        : typeof c.role_title === "string"
        ? c.role_title.trim().slice(0, 500)
        : "";
    const location = typeof c.location === "string" ? c.location.trim().slice(0, 500) : "";

    // Run Core Pipeline wrapped in Per-Case Timeout & Failure Isolation
    try {
      const kitPromise = executeKitPipeline({
        jd,
        company_url: rawCompanyUrl || undefined,
        company: company || undefined,
        role: role || undefined,
        location: location || undefined,
        days,
        allowLocalTestUrls: true,
      });

      const kit: KitStructure = await withTimeout(kitPromise, timeoutMs, caseId);

      const entry: BatchKitEntryOk = {
        id: caseId,
        status: "ok",
        kit,
        error: null,
      };

      results.push(entry);
      console.log(
        `  -> OK: Generated ${kit.questions.length} questions, ${kit.flashcards.length} flashcards, ${kit.schedule.days.length} days`
      );
    } catch (err: unknown) {
      let code = "FATAL_CASE_FAILURE";
      let rawMessage = "Case processing failed.";

      if (err instanceof PipelineError) {
        code = err.code;
        rawMessage = err.message;
      } else if (err instanceof LlmError) {
        code = err.code;
        rawMessage = err.message;
      } else if (err instanceof CrawlerError) {
        code = err.code;
        rawMessage = err.message;
      } else if (err instanceof ScheduleError) {
        code = err.code;
        rawMessage = err.message;
      } else if (err instanceof Error) {
        rawMessage = err.message;
      }

      const message = sanitizeErrorMessage(rawMessage);

      const entry: BatchKitEntryFailed = {
        id: caseId,
        status: "failed",
        kit: null,
        error: {
          code,
          message,
        },
      };

      results.push(entry);
      console.log(`  -> FAILED (${code}): ${message}`);
    }
  }

  // 6. Build Strict Appendix B Output Structure
  const output: BatchOutputStructure = {
    version: "1.0",
    generated_at: new Date().toISOString(),
    kits: results,
  };

  // 7. Write to Output File
  try {
    const outputDir = path.dirname(resolvedOutput);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(resolvedOutput, JSON.stringify(output, null, 2) + "\n", "utf-8");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to write output";
    console.error(`Error: Unable to write output file: ${msg}`);
    process.exitCode = 1;
    return;
  }

  const okCount = results.filter((r) => r.status === "ok").length;
  const failedCount = results.filter((r) => r.status === "failed").length;

  console.log(`\n[Batch Evaluator] Finished: ${okCount} ok, ${failedCount} failed.`);
  console.log(`[Batch Evaluator] Results written to ${outputPath}`);
}

// Direct CLI entry point execution
const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (path.resolve(currentFile) === invokedFile) {
  runBatchEvaluator().catch((err) => {
    console.error("Unhandled error in batch evaluator:", err);
    process.exit(1);
  });
}
