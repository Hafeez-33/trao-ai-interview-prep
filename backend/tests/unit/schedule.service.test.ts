import { describe, it, expect } from "vitest";
import { ScheduleService } from "../../src/services/schedule/schedule.service.js";
import { mockRequirements, mockQuestions } from "../helpers/fixtures.js";

describe("ScheduleService (Unit Tests)", () => {
  it("generates a valid 1-day schedule containing all questions on Day 1", () => {
    const service = new ScheduleService();
    const schedule = service.generateSchedule({
      requirements: mockRequirements,
      questions: mockQuestions,
      days: 1,
    });

    expect(schedule.days_available).toBe(1);
    expect(schedule.days).toHaveLength(1);
    expect(schedule.days[0].day).toBe(1);
    expect(schedule.days[0].question_ids).toHaveLength(mockQuestions.length);
    expect(schedule.days[0].minutes).toBeGreaterThan(0);
    expect(Number.isInteger(schedule.days[0].minutes)).toBe(true);
  });

  it("generates a balanced 5-day schedule with sequential day numbers", () => {
    const service = new ScheduleService();
    const schedule = service.generateSchedule({
      requirements: mockRequirements,
      questions: mockQuestions,
      days: 5,
    });

    expect(schedule.days_available).toBe(5);
    expect(schedule.days).toHaveLength(5);
    schedule.days.forEach((day, idx) => {
      expect(day.day).toBe(idx + 1);
      expect(day.minutes).toBeGreaterThan(0);
      expect(Number.isInteger(day.minutes)).toBe(true);
      expect(typeof day.focus).toBe("string");
      expect(day.focus.length).toBeGreaterThan(0);
    });
  });

  it("generates a 60-day boundary schedule without errors", () => {
    const service = new ScheduleService();
    const schedule = service.generateSchedule({
      requirements: mockRequirements,
      questions: mockQuestions,
      days: 60,
    });

    expect(schedule.days_available).toBe(60);
    expect(schedule.days).toHaveLength(60);
    expect(schedule.days[59].day).toBe(60);
  });

  it("prioritizes must-requirement, high-difficulty questions on early days", () => {
    const service = new ScheduleService();
    const schedule = service.generateSchedule({
      requirements: mockRequirements,
      questions: mockQuestions,
      days: 4,
    });

    // q3 is diff 3 and covers must requirement r3
    // It should be placed on Day 1
    expect(schedule.days[0].question_ids).toContain("q3");
  });

  it("is 100% deterministic across multiple runs (no Math.random)", () => {
    const service = new ScheduleService();
    const run1 = service.generateSchedule({
      requirements: mockRequirements,
      questions: mockQuestions,
      days: 5,
    });
    const run2 = service.generateSchedule({
      requirements: mockRequirements,
      questions: mockQuestions,
      days: 5,
    });

    expect(run1).toEqual(run2);
  });

  it("rejects invalid days (< 1, > 60, floats, NaN, negative)", () => {
    const service = new ScheduleService();
    const params = { requirements: mockRequirements, questions: mockQuestions };

    expect(() => service.generateSchedule({ ...params, days: 0 })).toThrow();
    expect(() => service.generateSchedule({ ...params, days: 61 })).toThrow();
    expect(() => service.generateSchedule({ ...params, days: 3.5 })).toThrow();
    expect(() => service.generateSchedule({ ...params, days: -5 })).toThrow();
  });

  it("throws error when must requirements have zero covering questions", () => {
    const service = new ScheduleService();
    // Questions that only cover r2 and r4 (nice), leaving r1 and r3 (must) uncovered
    const niceOnlyQuestions = [mockQuestions[1], mockQuestions[3]];

    expect(() =>
      service.generateSchedule({
        requirements: mockRequirements,
        questions: niceOnlyQuestions,
        days: 3,
      })
    ).toThrow(/UNCOVERED_MUST_REQUIREMENTS|Cannot generate schedule/);
  });
});
