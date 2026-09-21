import { describe, it, expect } from "vitest";
import { KitValidationService } from "../../src/services/validation/kit-validation.service.js";
import { mockValidKit } from "../helpers/fixtures.js";

describe("KitValidationService (Unit Tests)", () => {
  it("validates that a complete valid Appendix A Kit passes validation", () => {
    const service = new KitValidationService();
    const result = service.validateKit(mockValidKit);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("detects missing source object", () => {
    const service = new KitValidationService();
    const invalidKit = { ...mockValidKit, source: undefined };
    const result = service.validateKit(invalidKit);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes("source"))).toBe(true);
  });

  it("detects missing company_brief object", () => {
    const service = new KitValidationService();
    const invalidKit = { ...mockValidKit, company_brief: undefined };
    const result = service.validateKit(invalidKit);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes("company_brief"))).toBe(true);
  });

  it("detects missing questions array", () => {
    const service = new KitValidationService();
    const invalidKit = { ...mockValidKit, questions: undefined };
    const result = service.validateKit(invalidKit);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes("questions"))).toBe(true);
  });

  it("detects invalid question requirement references", () => {
    const service = new KitValidationService();
    const invalidKit = {
      ...mockValidKit,
      questions: [
        {
          ...mockValidKit.questions[0],
          requirement_ids: ["r999_nonexistent"],
        },
      ],
    };
    const result = service.validateKit(invalidKit);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("r999_nonexistent") || e.path.includes("requirement_ids"))).toBe(true);
  });

  it("detects invalid question category enum", () => {
    const service = new KitValidationService();
    const invalidKit = {
      ...mockValidKit,
      questions: [
        {
          ...mockValidKit.questions[0],
          category: "invalid-category" as any,
        },
      ],
    };
    const result = service.validateKit(invalidKit);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes("category"))).toBe(true);
  });

  it("detects schedule containing invalid question ID", () => {
    const service = new KitValidationService();
    const invalidKit = {
      ...mockValidKit,
      schedule: {
        days_available: 1,
        days: [
          {
            day: 1,
            focus: "Technical",
            minutes: 45,
            question_ids: ["q999_nonexistent"],
          },
        ],
      },
    };
    const result = service.validateKit(invalidKit);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("q999_nonexistent") || e.path.includes("schedule"))).toBe(true);
  });

  it("detects invalid requirement kind enum", () => {
    const service = new KitValidationService();
    const invalidKit = {
      ...mockValidKit,
      role: {
        ...mockValidKit.role,
        requirements: [
          {
            id: "r1",
            text: "Proficiency in Node.js",
            kind: "invalid-kind" as any,
            priority: "must" as const,
          },
        ],
      },
    };
    const result = service.validateKit(invalidKit);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes("kind"))).toBe(true);
  });
});
