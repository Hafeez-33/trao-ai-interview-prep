#!/usr/bin/env node
/**
 * Headless Batch Evaluator CLI
 * Trao AI Interview Prep Kit — Phase 18
 *
 * Usage:
 *   npm run evaluate -- --input <cases.json> --output <kits.json>
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

interface CliArgs {
  inputPath?: string;
  outputPath?: string;
}

/**
 * Parses CLI arguments supporting --input <path> and --output <path> (as well as --input=... and --output=...).
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
    }
  }

  return result;
}

export async function runBatchEvaluator(args: string[] = process.argv.slice(2)): Promise<void> {
  const { inputPath, outputPath } = parseArgs(args);

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

  // 5. Process Every Case Sequentially in Input Order
  const results: BatchKitEntry[] = [];

  for (let idx = 0; idx < rawCases.length; idx++) {
    const item = rawCases[idx];
    const caseIndex = idx + 1;

    // Validate item shape
    if (!item || typeof item !== "object") {
      results.push({
        id: `case-${caseIndex}`,
        status: "failed",
        kit: null,
        error: {
          code: "INVALID_INPUT_PARAMETERS",
          message: "Case entry must be an object.",
        },
      });
      continue;
    }

    const c = item as Record<string, unknown>;
    const caseId = String(c.id || c._id || `case-${caseIndex}`).trim();
    const jd = String(c.jd || c.job_description || "").trim();
    const companyUrl = typeof c.company_url === "string" ? c.company_url.trim() : (typeof c.url === "string" ? c.url.trim() : "");
    const company = typeof c.company === "string" ? c.company.trim() : (typeof c.company_name === "string" ? c.company_name.trim() : "");
    const role = typeof c.role === "string" ? c.role.trim() : (typeof c.role_title === "string" ? c.role_title.trim() : "");
    const location = typeof c.location === "string" ? c.location.trim() : "";
    const daysRaw = c.days !== undefined ? c.days : (c.days_available !== undefined ? c.days_available : 5);
    const days = Number(daysRaw);

    console.log(`[Batch Evaluator] Processing (${caseIndex}/${rawCases.length}): ${caseId}...`);

    // Individual Case Input Validation
    if (!jd || jd.length < 10) {
      results.push({
        id: caseId,
        status: "failed",
        kit: null,
        error: {
          code: "INVALID_INPUT_PARAMETERS",
          message: "Job description is missing or too short (minimum 10 characters required).",
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

    if (isNaN(days) || days < 1 || days > 60 || !Number.isInteger(days)) {
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

    // Run Core Pipeline
    try {
      const kit: KitStructure = await executeKitPipeline({
        jd,
        company_url: companyUrl || undefined,
        company: company || undefined,
        role: role || undefined,
        location: location || undefined,
        days,
        allowLocalTestUrls: true,
      });

      const entry: BatchKitEntryOk = {
        id: caseId,
        status: "ok",
        kit,
        error: null,
      };

      results.push(entry);
      console.log(`  -> OK: Generated ${kit.questions.length} questions, ${kit.flashcards.length} flashcards, ${kit.schedule.days.length} days`);
    } catch (err: unknown) {
      let code = "FATAL_CASE_FAILURE";
      let message = "Case processing failed.";

      if (err instanceof PipelineError) {
        code = err.code;
        message = err.message;
      } else if (err instanceof LlmError) {
        code = err.code;
        message = err.message;
      } else if (err instanceof CrawlerError) {
        code = err.code;
        message = err.message;
      } else if (err instanceof ScheduleError) {
        code = err.code;
        message = err.message;
      } else if (err instanceof Error) {
        message = err.message;
      }

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
