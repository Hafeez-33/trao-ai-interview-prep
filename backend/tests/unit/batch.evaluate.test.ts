import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { runBatchEvaluator } from "../../src/evaluate.js";

describe("Batch Evaluator (Unit Tests)", () => {
  const tempDir = path.resolve(__dirname, "../../temp-unit-batch");

  beforeAll(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("handles empty CLI arguments safely by setting exitCode = 1 without throwing unhandled crash", async () => {
    const originalExitCode = process.exitCode;
    await runBatchEvaluator([]);
    expect(process.exitCode).toBe(1);
    process.exitCode = originalExitCode;
  });

  it("processes invalid cases with failure isolation and writes valid Appendix B JSON", async () => {
    const inputFile = path.join(tempDir, "input-invalid.json");
    const outputFile = path.join(tempDir, "output-invalid.json");

    const cases = [
      { id: "case-short-jd", jd: "Too short", days: 5 },
      { id: "case-invalid-days", jd: "Valid job description for software engineer role.", days: 100 },
      { id: "case-null", jd: null },
    ];

    fs.writeFileSync(inputFile, JSON.stringify(cases), "utf-8");

    await runBatchEvaluator([
      `--input=${inputFile}`,
      `--output=${outputFile}`,
      "--timeout=5000",
    ]);

    expect(fs.existsSync(outputFile)).toBe(true);
    const content = JSON.parse(fs.readFileSync(outputFile, "utf-8"));

    expect(content.version).toBe("1.0");
    expect(typeof content.generated_at).toBe("string");
    expect(Array.isArray(content.kits)).toBe(true);
    expect(content.kits).toHaveLength(3);

    // Each case failed cleanly
    expect(content.kits[0].id).toBe("case-short-jd");
    expect(content.kits[0].status).toBe("failed");
    expect(content.kits[0].kit).toBeNull();
    expect(content.kits[0].error.code).toBe("INVALID_INPUT_PARAMETERS");

    expect(content.kits[1].id).toBe("case-invalid-days");
    expect(content.kits[1].status).toBe("failed");

    expect(content.kits[2].status).toBe("failed");
  });

  it("enforces duplicate case ID rejection for second occurrence", async () => {
    const inputFile = path.join(tempDir, "input-dup.json");
    const outputFile = path.join(tempDir, "output-dup.json");

    const cases = [
      { id: "dup-1", jd: "Short", days: 5 }, // will fail validation but registers ID
      { id: "dup-1", jd: "Short again", days: 5 }, // will fail as duplicate ID
    ];

    fs.writeFileSync(inputFile, JSON.stringify(cases), "utf-8");

    await runBatchEvaluator([
      `--input=${inputFile}`,
      `--output=${outputFile}`,
    ]);

    const content = JSON.parse(fs.readFileSync(outputFile, "utf-8"));
    expect(content.kits[1].error.message).toContain("Duplicate");
  });
});
