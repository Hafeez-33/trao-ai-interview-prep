import { describe, it, expect, vi } from "vitest";
import { CoverageService } from "../../src/services/coverage/coverage.service.js";
import { mockRequirements, mockQuestions } from "../helpers/fixtures.js";
import type { ILlmProvider } from "../../src/services/llm/index.js";

describe("CoverageService (Unit Tests)", () => {
  it("calculates 100% coverage when all requirements are referenced by questions", () => {
    const service = new CoverageService();
    const result = service.calculateCoverage(mockRequirements, mockQuestions, 1);

    expect(result.uncovered_requirement_ids).toHaveLength(0);
    expect(result.passes).toBe(1);
    expect(result.details.every((d) => d.covered)).toBe(true);
  });

  it("identifies uncovered requirements preserving requirement order", () => {
    const service = new CoverageService();
    // Only pass questions for r1 and r3
    const subsetQuestions = [mockQuestions[0], mockQuestions[2]];
    const result = service.calculateCoverage(mockRequirements, subsetQuestions, 1);

    expect(result.uncovered_requirement_ids).toEqual(["r2", "r4"]);
    expect(result.passes).toBe(1);
  });

  it("identifies uncovered must requirements accurately", () => {
    const service = new CoverageService();
    // Only pass question for r2 (nice)
    const subsetQuestions = [mockQuestions[1]];
    const result = service.calculateCoverage(mockRequirements, subsetQuestions, 1);

    expect(result.uncovered_requirement_ids).toEqual(["r1", "r3", "r4"]);
    const uncoveredMust = result.details.filter((d) => !d.covered && mockRequirements.find((r) => r.id === d.requirement_id)?.priority === "must");
    expect(uncoveredMust).toHaveLength(2); // r1 and r3 are must
  });

  it("ignores hallucinated requirement IDs on questions (e.g. r999)", () => {
    const service = new CoverageService();
    const rogueQuestion = {
      id: "q99",
      category: "technical" as const,
      prompt: "Rogue question",
      difficulty: 2 as const,
      requirement_ids: ["r999", "r1"],
      answer_outline: "Step 1",
    };

    const result = service.calculateCoverage(mockRequirements, [rogueQuestion], 1);
    expect(result.uncovered_requirement_ids).toEqual(["r2", "r3", "r4"]);
    expect(result.details.find((d) => d.requirement_id === "r1")?.covered).toBe(true);
  });

  it("triggers second-pass generation to close requirement gaps and increments passes to 2", async () => {
    const mockLlm: ILlmProvider = {
      name: "mock-llm",
      generateCompletion: vi.fn().mockResolvedValue(
        JSON.stringify({
          questions: [
            {
              prompt: "How do you optimize MongoDB aggregations with covered queries?",
              category: "technical",
              difficulty: 2,
              requirement_ids: ["r2"],
              answer_outline: "Use indexes and explain plan.",
            },
            {
              prompt: "Describe an agile incident leadership scenario.",
              category: "behavioural",
              difficulty: 2,
              requirement_ids: ["r4"],
              answer_outline: "STAR method.",
            },
          ],
        })
      ),
    };

    const service = new CoverageService(mockLlm);
    const existingQuestions = [mockQuestions[0], mockQuestions[2]]; // covers r1, r3
    const secondPassResult = await service.runSecondPass({
      jd: "Senior engineer JD",
      requirements: mockRequirements,
      existingQuestions,
      companyBrief: { summary: "Acme", what_they_do: "Cloud", sources: [] },
    });

    expect(secondPassResult.questions).toHaveLength(4);
    expect(secondPassResult.uncovered_requirement_ids).toHaveLength(0);
    expect(secondPassResult.generated_count).toBe(2);
  });
});
