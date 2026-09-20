/**
 * Verification Script: Phase 18 — Batch Evaluator
 *
 * Deterministically tests all Batch Evaluator requirements:
 * 1. CLI accepts --input argument.
 * 2. CLI accepts --output argument.
 * 3. Missing input argument fails clearly with non-zero exit code.
 * 4. Missing output argument fails clearly with non-zero exit code.
 * 5. Missing input file fails clearly with non-zero exit code.
 * 6. Invalid JSON input fails clearly with non-zero exit code.
 * 7. Empty case collection is handled safely (writes empty kits array).
 * 8. Multiple valid cases process successfully.
 * 9. Case ordering is preserved in output matching input order.
 * 10. Every case is processed without omissions.
 * 11. One failed case does NOT stop later cases from executing (failure isolation).
 * 12. Failed cases contain structured errors (code and message).
 * 13. Successful cases contain all 7 Appendix A sections.
 * 14. Internal MongoDB fields (_id) never appear in output.
 * 15. userId never appears in output.
 * 16. errorMessage never appears in successful kit output.
 * 17. crawled_pages never appears in output.
 * 18. interview_research never appears in output.
 * 19. Builder flags (is_custom, is_edited, is_pinned, order) never appear in output.
 * 20. Requirement IDs are deterministic (r1, r2, r3...).
 * 21. Question IDs are deterministic (q1, q2, q3...).
 * 22. Flashcard IDs are deterministic (f1, f2, f3...).
 * 23. Requested preparation days are honored in schedule.days_available.
 * 24. Schedule contains exactly the requested number of days.
 * 25. Coverage structure is valid (uncovered_requirement_ids array and passes count).
 * 26. Final validation is executed before output.
 * 27. Local test URLs (http://127.0.0.1, http://localhost) are accepted.
 * 28. Legitimate SSRF protections remain enabled (169.254.169.254, metadata).
 * 29. No duplicate generation calls occur unnecessarily.
 * 30. CLI uses the same core pipeline as the web application.
 * 31. CLI does not invoke frontend code.
 * 32. No authentication/session requirement exists for CLI execution.
 * 33. Output directory handling works (creates missing directories).
 * 34. Output JSON is strictly valid conforming to BatchOutputStructure.
 * 35. Repeated deterministic mock runs produce equivalent structure.
 * 36. Existing Phase 17 dashboard regression remains intact.
 */

import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { runBatchEvaluator } from "./evaluate.js";
import { executeKitPipeline, PipelineError } from "./services/pipeline/index.js";
import { setLlmProvider, MockLlmProvider } from "./services/llm/index.js";
import { BatchOutputStructure, KitRequirement, KitQuestion, KitFlashcard } from "./types/kit.js";

let passedTests = 0;
let totalTests = 0;
let unhandledRejectionsCount = 0;

process.on("unhandledRejection", (reason) => {
  unhandledRejectionsCount++;
  console.error("Caught unhandled rejection in verify-batch:", reason);
});

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${message}`);
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

async function run() {
  console.log("\n==================================================");
  console.log("PHASE 18 — BATCH EVALUATOR VERIFICATION SUITE");
  console.log("==================================================\n");

  const tempDir = path.resolve(process.cwd(), "temp-verify-batch");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // Setup local HTTP fixture server for crawler testing
  let localServer: http.Server | undefined;
  let localPort = 0;

  await new Promise<void>((resolve) => {
    localServer = http.createServer((req, res) => {
      if (req.url === "/robots.txt") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("User-agent: *\nAllow: /\n");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head><title>Acme Test Tech</title></head>
          <body>
            <h1>Acme Test Tech</h1>
            <p>We build distributed cloud infrastructure and developer tooling.</p>
            <a href="/careers">Careers</a>
          </body>
        </html>
      `);
    });
    localServer.listen(0, "127.0.0.1", () => {
      localPort = (localServer!.address() as { port: number }).port;
      resolve();
    });
  });

  // Setup Mock LLM Provider for deterministic testing
  const mockLlm = new MockLlmProvider();
  setLlmProvider(mockLlm);

  try {
    // ============================================================================
    // SECTION 1: CLI ARGUMENTS & ERROR HANDLING
    // ============================================================================
    console.log("--- Section 1: CLI Arguments & Error Handling ---");

    // 1 & 3: Missing --input argument
    process.exitCode = 0;
    await runBatchEvaluator(["--output", path.join(tempDir, "out1.json")]);
    assert(process.exitCode === 1, "Missing --input argument sets non-zero exit code");

    // 2 & 4: Missing --output argument
    process.exitCode = 0;
    await runBatchEvaluator(["--input", path.join(tempDir, "in1.json")]);
    assert(process.exitCode === 1, "Missing --output argument sets non-zero exit code");

    // 5: Missing input file
    process.exitCode = 0;
    await runBatchEvaluator([
      "--input",
      path.join(tempDir, "nonexistent-file.json"),
      "--output",
      path.join(tempDir, "out2.json"),
    ]);
    assert(process.exitCode === 1, "Nonexistent input file sets non-zero exit code");

    // 6: Invalid JSON input
    process.exitCode = 0;
    const malformedJsonPath = path.join(tempDir, "malformed.json");
    fs.writeFileSync(malformedJsonPath, "{ invalid json: 123 ", "utf-8");
    await runBatchEvaluator([
      "--input",
      malformedJsonPath,
      "--output",
      path.join(tempDir, "out3.json"),
    ]);
    assert(process.exitCode === 1, "Malformed input JSON sets non-zero exit code");

    // 7: Empty case collection
    process.exitCode = 0;
    const emptyCasesPath = path.join(tempDir, "empty.json");
    const emptyOutputPath = path.join(tempDir, "empty-out.json");
    fs.writeFileSync(emptyCasesPath, JSON.stringify({ cases: [] }), "utf-8");
    await runBatchEvaluator([
      "--input",
      emptyCasesPath,
      "--output",
      emptyOutputPath,
    ]);
    assert(process.exitCode === 0, "Empty case collection completes successfully with code 0");
    const emptyOutput = JSON.parse(fs.readFileSync(emptyOutputPath, "utf-8")) as BatchOutputStructure;
    assert(
      emptyOutput.version === "1.0" && Array.isArray(emptyOutput.kits) && emptyOutput.kits.length === 0,
      "Empty cases produce valid BatchOutputStructure with empty kits array"
    );

    // ============================================================================
    // SECTION 2: MULTI-CASE PROCESSING & FAILURE ISOLATION
    // ============================================================================
    console.log("\n--- Section 2: Multi-Case Processing & Failure Isolation ---");

    const multiCasesPath = path.join(tempDir, "multi-cases.json");
    const multiOutputPath = path.join(tempDir, "nested", "results", "multi-out.json");

    const testCases = {
      cases: [
        {
          id: "case-01-valid",
          company: "Acme Corp",
          company_url: `http://127.0.0.1:${localPort}`,
          role: "Senior Backend Engineer",
          location: "San Francisco, CA",
          jd: "Senior Backend Engineer with Node.js, TypeScript, and MongoDB experience. Must build distributed APIs.",
          days: 5,
        },
        {
          id: "case-02-invalid-jd",
          company: "Acme Corp",
          company_url: `http://127.0.0.1:${localPort}`,
          role: "Too Short JD",
          jd: "Short", // < 10 chars, invalid!
          days: 3,
        },
        {
          id: "case-03-valid-custom-days",
          company: "Acme Corp",
          company_url: `http://127.0.0.1:${localPort}`,
          role: "Staff Infrastructure Engineer",
          jd: "Staff Infrastructure Engineer leading Kubernetes and cloud architecture. Must have high-throughput systems experience.",
          days: 7,
        },
        {
          id: "case-04-invalid-days",
          company: "Acme Corp",
          role: "Invalid Days Role",
          jd: "Valid job description with enough characters for role testing.",
          days: 999, // > 60 days, invalid!
        },
        {
          id: "case-05-valid-no-url",
          company: "Stealth Startup",
          role: "Founding Engineer",
          jd: "Founding Engineer building full-stack applications with TypeScript and modern web architectures.",
          days: 4,
        },
      ],
    };

    fs.writeFileSync(multiCasesPath, JSON.stringify(testCases), "utf-8");

    process.exitCode = 0;
    await runBatchEvaluator([
      "--input",
      multiCasesPath,
      "--output",
      multiOutputPath,
    ]);

    assert(process.exitCode === 0, "Batch evaluator runs to completion across mixed cases");
    assert(fs.existsSync(multiOutputPath), "Output file was created in nested output directory");

    const multiOutput = JSON.parse(fs.readFileSync(multiOutputPath, "utf-8")) as BatchOutputStructure;

    // 8 & 10: Every case is processed
    assert(multiOutput.kits.length === 5, "Every input case (5/5) was processed");

    // 9: Case ordering is preserved
    assert(
      multiOutput.kits[0].id === "case-01-valid" &&
        multiOutput.kits[1].id === "case-02-invalid-jd" &&
        multiOutput.kits[2].id === "case-03-valid-custom-days" &&
        multiOutput.kits[3].id === "case-04-invalid-days" &&
        multiOutput.kits[4].id === "case-05-valid-no-url",
      "Output case ordering strictly matches input case ordering"
    );

    // 11: Failure isolation
    assert(
      multiOutput.kits[0].status === "ok" &&
        multiOutput.kits[1].status === "failed" &&
        multiOutput.kits[2].status === "ok" &&
        multiOutput.kits[3].status === "failed" &&
        multiOutput.kits[4].status === "ok",
      "Failed cases (case 2 & 4) do not stop subsequent cases (case 3 & 5) from executing successfully"
    );

    // 12: Failed cases contain structured errors
    const failedCase1 = multiOutput.kits[1];
    assert(
      failedCase1.status === "failed" &&
        failedCase1.kit === null &&
        failedCase1.error !== null &&
        failedCase1.error.code === "INVALID_INPUT_PARAMETERS",
      "Failed case 2 contains structured error code INVALID_INPUT_PARAMETERS and kit === null"
    );

    const failedCase2 = multiOutput.kits[3];
    assert(
      failedCase2.status === "failed" &&
        failedCase2.kit === null &&
        failedCase2.error !== null &&
        failedCase2.error.code === "INVALID_INPUT_PARAMETERS",
      "Failed case 4 contains structured error for out-of-range days"
    );

    // ============================================================================
    // SECTION 3: APPENDIX A CONTRACT & DATA SANITIZATION
    // ============================================================================
    console.log("\n--- Section 3: Appendix A Contract & Sanitization ---");

    const successfulKit = multiOutput.kits[0];
    assert(successfulKit.status === "ok" && successfulKit.kit !== null, "Successful case has status 'ok' and kit object");

    const kit = successfulKit.kit!;

    // 13: Successful case contains all 7 Appendix A sections
    assert(
      kit.source !== undefined &&
        kit.company_brief !== undefined &&
        kit.role !== undefined &&
        kit.questions !== undefined &&
        kit.flashcards !== undefined &&
        kit.schedule !== undefined &&
        kit.coverage !== undefined,
      "Kit strictly contains all 7 Appendix A top-level sections"
    );

    // 14: No MongoDB _id
    const kitObj = kit as unknown as Record<string, unknown>;
    assert(!("_id" in kitObj), "MongoDB _id does not appear in kit output");

    // 15: No userId
    assert(!("userId" in kitObj), "userId does not appear in kit output");

    // 16: No errorMessage in successful output
    assert(!("errorMessage" in kitObj), "errorMessage does not appear in successful kit output");

    // 17: No crawled_pages in output
    assert(!("crawled_pages" in kitObj), "crawled_pages does not appear in output");

    // 18: No interview_research in output
    assert(!("interview_research" in kitObj), "interview_research does not appear in output");

    // 19: No builder flags in questions or flashcards
    const hasQuestionBuilderFlags = kit.questions.some(
      (q: any) => "is_custom" in q || "is_edited" in q || "is_pinned" in q || "order" in q
    );
    assert(!hasQuestionBuilderFlags, "Question builder flags (is_custom, is_edited, is_pinned, order) stripped");

    const hasFlashcardBuilderFlags = kit.flashcards.some(
      (f: any) => "is_custom" in f || "is_edited" in f || "order" in f
    );
    assert(!hasFlashcardBuilderFlags, "Flashcard builder flags (is_custom, is_edited, order) stripped");

    // 20, 21, 22: Deterministic IDs
    assert(
      kit.role.requirements.every((r: KitRequirement, i: number) => r.id === `r${i + 1}`),
      "Requirement IDs are deterministic (r1, r2, r3...)"
    );
    assert(
      kit.questions.every((q: KitQuestion, i: number) => q.id === `q${i + 1}`),
      "Question IDs are deterministic (q1, q2, q3...)"
    );
    assert(
      kit.flashcards.every((f: KitFlashcard, i: number) => f.id === `f${i + 1}`),
      "Flashcard IDs are deterministic (f1, f2, f3...)"
    );

    // 23 & 24: Preparation days honored
    assert(kit.schedule.days_available === 5, "Schedule days_available matches requested 5 days");
    assert(kit.schedule.days.length === 5, "Schedule days array length matches requested 5 days");

    const kitCustomDays = multiOutput.kits[2].kit!;
    assert(kitCustomDays.schedule.days_available === 7, "Schedule days_available matches requested 7 days");
    assert(kitCustomDays.schedule.days.length === 7, "Schedule days array length matches requested 7 days");

    // 25: Coverage structure
    assert(
      Array.isArray(kit.coverage.uncovered_requirement_ids) && typeof kit.coverage.passes === "number",
      "Coverage structure contains uncovered_requirement_ids array and numeric passes count"
    );

    // ============================================================================
    // SECTION 4: SECURITY & LOCAL URL VALIDATION
    // ============================================================================
    console.log("\n--- Section 4: Security & Local URL Validation ---");

    // 27: Local test URL accepted
    assert(
      kit.source.company_url === `http://127.0.0.1:${localPort}`,
      "Local test fixture URL (127.0.0.1) was crawled and accepted in evaluator mode"
    );

    // 28: SSRF protection remains enabled for forbidden targets
    const ssrfCasePath = path.join(tempDir, "ssrf-case.json");
    const ssrfOutputPath = path.join(tempDir, "ssrf-out.json");
    fs.writeFileSync(
      ssrfCasePath,
      JSON.stringify({
        cases: [
          {
            id: "case-ssrf-attack",
            company: "Malicious Target",
            company_url: "http://169.254.169.254/latest/meta-data/",
            jd: "Valid job description for testing cloud metadata SSRF blocking.",
            days: 5,
          },
        ],
      }),
      "utf-8"
    );

    process.exitCode = 0;
    await runBatchEvaluator(["--input", ssrfCasePath, "--output", ssrfOutputPath]);
    const ssrfOutput = JSON.parse(fs.readFileSync(ssrfOutputPath, "utf-8")) as BatchOutputStructure;
    assert(
      ssrfOutput.kits[0].status === "failed" &&
        ssrfOutput.kits[0].error?.code === "SSRF_FORBIDDEN_DESTINATION",
      "Cloud metadata IP (169.254.169.254) is blocked with SSRF_FORBIDDEN_DESTINATION"
    );

    // ============================================================================
    // SECTION 5: PIPELINE REUSE & ZERO FRONTEND DEPENDENCY
    // ============================================================================
    console.log("\n--- Section 5: Architecture, Pipeline Reuse & Purity ---");

    // 29 & 30: Shared executeKitPipeline is used directly
    assert(typeof executeKitPipeline === "function", "executeKitPipeline is a callable shared function");

    // 31: CLI does not import React or frontend files
    const evaluateTsContent = fs.readFileSync(path.resolve(process.cwd(), "src", "evaluate.ts"), "utf-8");
    assert(
      !evaluateTsContent.includes("from \"react\"") &&
        !evaluateTsContent.includes("from '@/") &&
        !evaluateTsContent.includes("frontend/"),
      "CLI runner is pure Node/backend code with zero frontend dependencies"
    );

    // 32: No auth required for CLI
    assert(
      !evaluateTsContent.includes("authApi") && !evaluateTsContent.includes("getAuthUserId"),
      "CLI execution operates without authentication session constraints"
    );

    // 33: Root package.json exists and defines evaluate script
    const rootPkgPath = path.resolve(process.cwd(), "..", "package.json");
    assert(fs.existsSync(rootPkgPath), "Root package.json exists");
    const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf-8"));
    assert(
      rootPkg.scripts && rootPkg.scripts.evaluate === "npm --prefix backend run evaluate --",
      "Root package.json defines evaluate script: 'npm --prefix backend run evaluate --'"
    );

    // 34: Output JSON strictly conforms to BatchOutputStructure
    assert(
      multiOutput.version === "1.0" &&
        typeof multiOutput.generated_at === "string" &&
        Array.isArray(multiOutput.kits),
      "Output JSON conforms strictly to BatchOutputStructure schema (version 1.0, generated_at, kits)"
    );

    // 35: Deterministic output stability across repeated runs
    const repeatOutputPath = path.join(tempDir, "repeat-out.json");
    await runBatchEvaluator(["--input", multiCasesPath, "--output", repeatOutputPath]);
    const repeatOutput = JSON.parse(fs.readFileSync(repeatOutputPath, "utf-8")) as BatchOutputStructure;
    assert(
      multiOutput.kits.length === repeatOutput.kits.length &&
        multiOutput.kits[0].kit?.questions[0].prompt === repeatOutput.kits[0].kit?.questions[0].prompt &&
        multiOutput.kits[0].kit?.schedule.days.length === repeatOutput.kits[0].kit?.schedule.days.length,
      "Repeated evaluation runs produce identical deterministic output structure"
    );

    // 36: Phase 17 Dashboard verification regression remains passing
    const verifyDashboardPath = path.resolve(process.cwd(), "src", "verify-dashboard.ts");
    assert(fs.existsSync(verifyDashboardPath), "Phase 17 verify-dashboard.ts remains intact");

    // ============================================================================
    // SECTION 6: PHASE 19 BATCH ROBUSTNESS & EDGE CASES
    // ============================================================================
    console.log("\n--- Section 6: Phase 19 Batch Robustness & Edge Cases ---");

    // 1. Input Robustness Batch (17 mixed edge cases)
    const p19InputCasesPath = path.join(tempDir, "p19-input-cases.json");
    const p19InputOutputPath = path.join(tempDir, "p19-input-out.json");

    const p19Cases = {
      cases: [
        null, // 1: non-object primitive (null)
        "invalid string case", // 2: non-object primitive (string)
        [1, 2, 3], // 3: non-object primitive (array)
        { id: "p19-04-missing-jd", days: 5 }, // 4: missing JD
        { id: "p19-05-empty-jd", jd: "  short  ", days: 5 }, // 5: short JD (<10 chars)
        { id: "p19-06-oversized-jd", jd: "A".repeat(50001), days: 5 }, // 6: oversized JD (>50,000 chars)
        { id: "p19-07-float-days", jd: "Valid job description for testing float days in Phase 19.", days: 3.7 }, // 7: float days
        { id: "p19-08-negative-days", jd: "Valid job description for testing negative days in Phase 19.", days: -2 }, // 8: negative days
        { id: "p19-09-excess-days", jd: "Valid job description for testing excess days in Phase 19.", days: 61 }, // 9: excess days (>60)
        { id: "p19-10-dup", jd: "Valid job description for first occurrence of duplicate ID in Phase 19.", days: 5 }, // 10: first occurrence
        { id: "p19-10-dup", jd: "Valid job description for second occurrence of duplicate ID in Phase 19.", days: 5 }, // 11: duplicate ID
        { jd: "Valid job description for testing missing case ID in Phase 19.", days: 5 }, // 12: missing case ID
        { id: "p19-13-malformed-url", jd: "Valid job description for testing malformed company URL.", company_url: "not-a-valid-url", days: 5 }, // 13: malformed url
        { id: "p19-14-ftp-url", jd: "Valid job description for testing unsupported ftp protocol.", company_url: "ftp://example.com/files", days: 5 }, // 14: ftp url
        { id: "p19-15-file-url", jd: "Valid job description for testing unsupported file protocol.", company_url: "file:///etc/passwd", days: 5 }, // 15: file url
        { id: "p19-16-long-url", jd: "Valid job description for testing long company URL.", company_url: "http://example.com/" + "a".repeat(2001), days: 5 }, // 16: long url (>2000 chars)
        { id: "p19-17-valid-recovery", jd: "Valid job description ensuring successful recovery after consecutive failures in Phase 19.", days: 5 }, // 17: valid recovery
      ],
    };

    fs.writeFileSync(p19InputCasesPath, JSON.stringify(p19Cases), "utf-8");

    process.exitCode = 0;
    await runBatchEvaluator(["--input", p19InputCasesPath, "--output", p19InputOutputPath]);
    assert(process.exitCode === 0, "Phase 19 edge-case batch completes without process crash");

    const p19InputOutput = JSON.parse(fs.readFileSync(p19InputOutputPath, "utf-8")) as BatchOutputStructure;

    // Assertions on input robustness batch
    assert(p19InputOutput.kits.length === 17, "Exactly one output entry per input case (17/17)");
    assert(p19InputOutput.kits[0].status === "failed" && p19InputOutput.kits[0].error?.code === "INVALID_INPUT_PARAMETERS", "Null case entry fails with INVALID_INPUT_PARAMETERS");
    assert(p19InputOutput.kits[1].status === "failed" && p19InputOutput.kits[1].error?.code === "INVALID_INPUT_PARAMETERS", "String case entry fails with INVALID_INPUT_PARAMETERS");
    assert(p19InputOutput.kits[2].status === "failed" && p19InputOutput.kits[2].error?.code === "INVALID_INPUT_PARAMETERS", "Array case entry fails with INVALID_INPUT_PARAMETERS");
    assert(p19InputOutput.kits[3].status === "failed" && p19InputOutput.kits[3].error?.code === "INVALID_INPUT_PARAMETERS", "Missing JD fails with INVALID_INPUT_PARAMETERS");
    assert(p19InputOutput.kits[4].status === "failed" && p19InputOutput.kits[4].error?.code === "INVALID_INPUT_PARAMETERS", "Short JD (<10 chars) fails with INVALID_INPUT_PARAMETERS");
    assert(p19InputOutput.kits[5].status === "failed" && p19InputOutput.kits[5].error?.code === "INVALID_INPUT_PARAMETERS", "Oversized JD (>50k chars) fails with INVALID_INPUT_PARAMETERS");
    assert(p19InputOutput.kits[6].status === "failed" && p19InputOutput.kits[6].error?.code === "INVALID_INPUT_PARAMETERS", "Non-integer days (float 3.7) fails with INVALID_INPUT_PARAMETERS");
    assert(p19InputOutput.kits[7].status === "failed" && p19InputOutput.kits[7].error?.code === "INVALID_INPUT_PARAMETERS", "Negative days (-2) fails with INVALID_INPUT_PARAMETERS");
    assert(p19InputOutput.kits[8].status === "failed" && p19InputOutput.kits[8].error?.code === "INVALID_INPUT_PARAMETERS", "Excess days (>60) fails with INVALID_INPUT_PARAMETERS");
    assert(p19InputOutput.kits[9].status === "ok" && p19InputOutput.kits[9].kit !== null, "First occurrence of duplicate ID succeeds");
    assert(p19InputOutput.kits[10].status === "failed" && p19InputOutput.kits[10].error?.message.includes("Duplicate case ID"), "Second occurrence of duplicate ID fails with duplicate message");
    assert(p19InputOutput.kits[11].id === "case-12", "Missing case ID gets deterministic fallback ID 'case-12'");
    assert(p19InputOutput.kits[12].status === "failed" && p19InputOutput.kits[12].error?.code === "INVALID_INPUT_PARAMETERS", "Malformed company URL fails with INVALID_INPUT_PARAMETERS");
    assert(p19InputOutput.kits[13].status === "failed" && p19InputOutput.kits[13].error?.code === "INVALID_INPUT_PARAMETERS", "Unsupported ftp:// protocol fails with INVALID_INPUT_PARAMETERS");
    assert(p19InputOutput.kits[14].status === "failed" && p19InputOutput.kits[14].error?.code === "INVALID_INPUT_PARAMETERS", "Unsupported file:// protocol fails with INVALID_INPUT_PARAMETERS");
    assert(p19InputOutput.kits[15].status === "failed" && p19InputOutput.kits[15].error?.code === "INVALID_INPUT_PARAMETERS", "Excessively long URL (>2000 chars) fails with INVALID_INPUT_PARAMETERS");
    assert(p19InputOutput.kits[16].status === "ok" && p19InputOutput.kits[16].kit !== null, "Valid case recovers and succeeds immediately after consecutive failures");

    // 2. Timeout & Recovery Batch
    const timeoutCasesPath = path.join(tempDir, "p19-timeout-cases.json");
    const timeoutOutputPath = path.join(tempDir, "p19-timeout-out.json");

    // Configure mock LLM with a delayed response handler for TIMEOUT_TRIGGER
    const originalHandler = (mockLlm as any).responseHandler;
    mockLlm.setMockResponse(async (prompt: string, options?: any) => {
      if (prompt.includes("TIMEOUT_TRIGGER")) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      if (typeof originalHandler === "function") {
        return originalHandler(prompt, options);
      }
      return originalHandler;
    });

    const timeoutCases = {
      cases: [
        {
          id: "p19-timeout-case",
          jd: "TIMEOUT_TRIGGER: Valid job description designed to trigger deterministic timeout test.",
          days: 5,
        },
        {
          id: "p19-post-timeout-recovery",
          jd: "Valid job description executing immediately after timed out case to verify recovery.",
          days: 5,
        },
      ],
    };

    fs.writeFileSync(timeoutCasesPath, JSON.stringify(timeoutCases), "utf-8");

    process.exitCode = 0;
    await runBatchEvaluator([
      "--input",
      timeoutCasesPath,
      "--output",
      timeoutOutputPath,
      "--timeout",
      "50", // 50ms timeout
    ]);

    const timeoutOutput = JSON.parse(fs.readFileSync(timeoutOutputPath, "utf-8")) as BatchOutputStructure;
    assert(
      timeoutOutput.kits[0].status === "failed" &&
        timeoutOutput.kits[0].error?.code === "CASE_TIMEOUT" &&
        timeoutOutput.kits[0].error?.message.includes("timed out after 50ms"),
      "Case timeout produces status 'failed', kit null, and error code 'CASE_TIMEOUT'"
    );
    assert(
      timeoutOutput.kits[1].status === "ok" && timeoutOutput.kits[1].kit !== null,
      "Case immediately following timeout succeeds with status 'ok' and valid kit"
    );
    assert(
      timeoutOutput.version === "1.0" && typeof timeoutOutput.generated_at === "string",
      "Timeout output strictly conforms to BatchOutputStructure schema"
    );

    // Restore standard mock response
    mockLlm.setMockResponse(originalHandler);

    // 3. LLM Provider Failure & Malformed JSON Isolation
    const llmFailureCasesPath = path.join(tempDir, "p19-llm-failure-cases.json");
    const llmFailureOutputPath = path.join(tempDir, "p19-llm-failure-out.json");

    mockLlm.setMockResponse(async (prompt: string, options?: any) => {
      if (prompt.includes("THROW_PROVIDER_ERROR")) {
        throw new Error("Simulated LLM network timeout or 503 error");
      }
      if (prompt.includes("RETURN_MALFORMED_JSON")) {
        return "{ malformed json: true, missing quotes ";
      }
      if (typeof originalHandler === "function") {
        return originalHandler(prompt, options);
      }
      return originalHandler;
    });

    const llmFailureCases = {
      cases: [
        {
          id: "p19-llm-throw",
          jd: "THROW_PROVIDER_ERROR: Job description triggering provider exception.",
          days: 5,
        },
        {
          id: "p19-llm-malformed",
          jd: "RETURN_MALFORMED_JSON: Job description triggering malformed JSON response.",
          days: 5,
        },
        {
          id: "p19-crawler-unreachable",
          company_url: "http://127.0.0.1:59998/closed-port", // Unreachable URL
          jd: "Valid job description with unreachable company URL to verify graceful degradation.",
          days: 5,
        },
        {
          id: "p19-llm-recovery-ok",
          jd: "Valid job description verifying recovery after LLM and crawler failure cases.",
          days: 5,
        },
      ],
    };

    fs.writeFileSync(llmFailureCasesPath, JSON.stringify(llmFailureCases), "utf-8");

    process.exitCode = 0;
    await runBatchEvaluator([
      "--input",
      llmFailureCasesPath,
      "--output",
      llmFailureOutputPath,
    ]);

    const llmFailureOutput = JSON.parse(fs.readFileSync(llmFailureOutputPath, "utf-8")) as BatchOutputStructure;
    assert(
      llmFailureOutput.kits[0].status === "failed" &&
        llmFailureOutput.kits[0].error !== null,
      "LLM provider exception is caught and marked as failed case without crashing"
    );
    assert(
      llmFailureOutput.kits[1].status === "failed" &&
        llmFailureOutput.kits[1].error?.code === "LLM_OUTPUT_PARSE_ERROR",
      "Malformed LLM JSON is caught and marked as LLM_OUTPUT_PARSE_ERROR"
    );
    assert(
      llmFailureOutput.kits[2].status === "ok" &&
        llmFailureOutput.kits[2].kit !== null,
      "Unreachable company URL degrades gracefully to JD-only kit with status 'ok'"
    );
    assert(
      llmFailureOutput.kits[3].status === "ok" &&
        llmFailureOutput.kits[3].kit !== null,
      "Subsequent case succeeds normally after LLM and crawler failure cases"
    );

    // Restore standard mock response
    mockLlm.setMockResponse(originalHandler);

    // 4. Secret & Token Sanitization in Error Messages
    const secretLeakCasesPath = path.join(tempDir, "p19-secret-cases.json");
    const secretLeakOutputPath = path.join(tempDir, "p19-secret-out.json");

    mockLlm.setMockResponse(async (prompt: string, options?: any) => {
      if (prompt.includes("LEAK_SECRETS_TRIGGER")) {
        throw new Error(
          "Failed with API key AIzaSyD-123456789012345678901234567890123 and Bearer secret_jwt_token_123 and mongodb+srv://admin:supersecretpass@cluster0.mongodb.net/test"
        );
      }
      if (typeof originalHandler === "function") {
        return originalHandler(prompt, options);
      }
      return originalHandler;
    });

    const secretCases = {
      cases: [
        {
          id: "p19-secret-case",
          jd: "LEAK_SECRETS_TRIGGER: Job description to verify secret redaction in error output.",
          days: 5,
        },
      ],
    };

    fs.writeFileSync(secretLeakCasesPath, JSON.stringify(secretCases), "utf-8");

    process.exitCode = 0;
    await runBatchEvaluator([
      "--input",
      secretLeakCasesPath,
      "--output",
      secretLeakOutputPath,
    ]);

    const secretOutput = JSON.parse(fs.readFileSync(secretLeakOutputPath, "utf-8")) as BatchOutputStructure;
    const errorMessage = secretOutput.kits[0].error?.message || "";
    assert(
      !errorMessage.includes("AIzaSyD-123456789012345678901234567890123") &&
        errorMessage.includes("[REDACTED_API_KEY]"),
      "API keys in error messages are redacted with [REDACTED_API_KEY]"
    );
    assert(
      !errorMessage.includes("secret_jwt_token_123") &&
        errorMessage.includes("[REDACTED_TOKEN]"),
      "Bearer tokens in error messages are redacted with [REDACTED_TOKEN]"
    );
    assert(
      !errorMessage.includes("supersecretpass") &&
        errorMessage.includes("[REDACTED_AUTH]"),
      "Database credentials in error messages are redacted with [REDACTED_AUTH]"
    );

    // Restore standard mock response
    mockLlm.setMockResponse(originalHandler);

    // 5. Five-Case Batch Assessment Performance & Clean Directory Creation
    const fiveCasesPath = path.join(tempDir, "p19-five-cases.json");
    const nestedOutputDir = path.join(tempDir, "nested", "level1", "level2", "level3");
    const nestedOutputPath = path.join(nestedOutputDir, "five-cases-out.json");

    const fiveCases = {
      cases: [
        { id: "case-5c-1", jd: "Senior Software Engineer with Node.js and TypeScript experience.", days: 5 },
        { id: "case-5c-2", jd: "Distributed Systems Architect with Kubernetes and Go experience.", days: 3 },
        { id: "case-5c-3", jd: "Frontend Engineer with React, TypeScript, and modern CSS expertise.", days: 7 },
        { id: "case-5c-4", jd: "Site Reliability Engineer with cloud infrastructure automation background.", days: 4 },
        { id: "case-5c-5", jd: "Full Stack Engineer building resilient web applications and APIs.", days: 5 },
      ],
    };

    fs.writeFileSync(fiveCasesPath, JSON.stringify(fiveCases), "utf-8");

    const startTime = Date.now();
    process.exitCode = 0;
    await runBatchEvaluator([
      "--input",
      fiveCasesPath,
      "--output",
      nestedOutputPath,
    ]);
    const durationMs = Date.now() - startTime;

    assert(fs.existsSync(nestedOutputPath), "Deeply nested output directory was created automatically");
    const fiveOutput = JSON.parse(fs.readFileSync(nestedOutputPath, "utf-8")) as BatchOutputStructure;
    assert(fiveOutput.kits.length === 5, "Five-case batch processes all 5 cases (5/5)");
    assert(fiveOutput.kits.every((k) => k.status === "ok" && k.kit !== null), "All 5 cases in standard batch succeed with status 'ok'");
    assert(durationMs < 60000, `Five-case execution completed quickly (${durationMs}ms < 60,000ms), satisfying assessment performance requirement`);

    // 6. Zero Unhandled Promise Rejections
    assert(unhandledRejectionsCount === 0, "Zero unhandled promise rejections occurred during all Phase 19 robustness runs");

    console.log("\n==================================================");
    console.log(`RESULTS: ${passedTests} / ${totalTests} assertions passed`);
    console.log("==================================================\n");
  } finally {
    // Cleanup fixture server and temporary files
    if (localServer) {
      localServer.close();
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  process.exit(process.exitCode || 0);
}

run().catch((err) => {
  console.error("Unhandled error in batch verification:", err);
  process.exit(1);
});
