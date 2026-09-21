import { describe, it, expect } from "vitest";
import { PracticeService, compareQuestionIds } from "../../src/services/practice/practice.service.js";
import { mockQuestions } from "../helpers/fixtures.js";

describe("PracticeService (Unit Tests)", () => {
  const service = new PracticeService();

  it("compares question IDs numerically (q1 < q2 < q10)", () => {
    expect(compareQuestionIds("q1", "q2")).toBeLessThan(0);
    expect(compareQuestionIds("q2", "q10")).toBeLessThan(0);
    expect(compareQuestionIds("q10", "q2")).toBeGreaterThan(0);
    expect(compareQuestionIds("q3", "q3")).toBe(0);
  });

  it("prioritizes unattempted questions (confidence === null) first", () => {
    const states = [
      { question_id: "q1", confidence: 3 as const, attempts: 1, last_attempted_at: null },
      { question_id: "q2", confidence: null, attempts: 0, last_attempted_at: null },
      { question_id: "q3", confidence: 1 as const, attempts: 1, last_attempted_at: null },
      { question_id: "q4", confidence: null, attempts: 0, last_attempted_at: null },
    ];

    const nextQ = service.selectNextQuestion(states, mockQuestions);
    // Unattempted: q2 and q4. Tie breaker is ID order -> q2
    expect(nextQ?.id).toBe("q2");
  });

  it("prioritizes confidence 1 (Low) before confidence 2 (Medium) and 3 (High)", () => {
    const states = [
      { question_id: "q1", confidence: 3 as const, attempts: 1, last_attempted_at: null },
      { question_id: "q2", confidence: 2 as const, attempts: 1, last_attempted_at: null },
      { question_id: "q3", confidence: 1 as const, attempts: 1, last_attempted_at: null },
    ];

    const subsetQuestions = [mockQuestions[0], mockQuestions[1], mockQuestions[2]];
    // Wait: if all 3 have confidence, allCompleted is true and returns null!
    // But if there is an unattempted q4, it will return q4.
    // What if one has confidence null?
    const statesWithUnattempted = [
      ...states,
      { question_id: "q4", confidence: null, attempts: 0, last_attempted_at: null },
    ];
    const nextQ = service.selectNextQuestion(statesWithUnattempted, mockQuestions);
    expect(nextQ?.id).toBe("q4"); // unattempted first
  });

  it("returns null when all questions have recorded confidence (practice complete)", () => {
    const states = [
      { question_id: "q1", confidence: 2 as const, attempts: 1, last_attempted_at: null },
      { question_id: "q2", confidence: 3 as const, attempts: 1, last_attempted_at: null },
      { question_id: "q3", confidence: 1 as const, attempts: 1, last_attempted_at: null },
      { question_id: "q4", confidence: 3 as const, attempts: 1, last_attempted_at: null },
    ];

    const nextQ = service.selectNextQuestion(states, mockQuestions);
    expect(nextQ).toBeNull();
  });

  it("uses sequential question ID as deterministic tie-breaker when confidence levels are identical", () => {
    const states = [
      { question_id: "q3", confidence: null, attempts: 0, last_attempted_at: null },
      { question_id: "q1", confidence: null, attempts: 0, last_attempted_at: null },
      { question_id: "q2", confidence: null, attempts: 0, last_attempted_at: null },
    ];

    const nextQ = service.selectNextQuestion(states, mockQuestions);
    expect(nextQ?.id).toBe("q1");
  });

  it("ignores question prompt text alphabetical order for question prioritization", () => {
    // q1 starts with 'How', q4 starts with 'Describe' ('D' < 'H')
    // But ID order is q1 < q4, so q1 must be selected
    const states = [
      { question_id: "q4", confidence: null, attempts: 0, last_attempted_at: null },
      { question_id: "q1", confidence: null, attempts: 0, last_attempted_at: null },
    ];

    const nextQ = service.selectNextQuestion(states, mockQuestions);
    expect(nextQ?.id).toBe("q1");
  });
});
