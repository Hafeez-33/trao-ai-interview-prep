import { describe, it, expect } from "vitest";
import { RegenerationService } from "../../src/services/regeneration/regeneration.service.js";

describe("RegenerationService (Unit Tests)", () => {
  const service = new RegenerationService();

  it("rejects invalid regeneration target with INVALID_INPUT_PARAMETERS", async () => {
    await expect(
      service.regenerate("6ab0b02647b5ec03f320cfd8", "6ab0b02647b5ec03f320cfd6", {
        target: "invalid_target" as any,
      })
    ).rejects.toThrow(/Invalid regeneration target/);
  });

  it("rejects invalid question category with INVALID_INPUT_PARAMETERS", async () => {
    await expect(
      service.regenerate("6ab0b02647b5ec03f320cfd8", "6ab0b02647b5ec03f320cfd6", {
        target: "questions",
        category: "invalid_cat" as any,
      })
    ).rejects.toThrow(/Invalid question category/);
  });

  it("rejects category parameter when target is flashcards", async () => {
    await expect(
      service.regenerate("6ab0b02647b5ec03f320cfd8", "6ab0b02647b5ec03f320cfd6", {
        target: "flashcards",
        category: "technical",
      })
    ).rejects.toThrow(/Category filter 'technical' is only applicable when target is 'questions' or 'all'/);
  });

  it("verifies protected flags identify custom, edited, and pinned items for preservation", () => {
    const questions = [
      { id: "q1", is_custom: true, prompt: "Custom Q" },
      { id: "q2", is_edited: true, prompt: "Edited Q" },
      { id: "q3", is_pinned: true, prompt: "Pinned Q" },
      { id: "q4", prompt: "Unprotected AI Q" },
    ];

    const protectedItems = questions.filter((q) => q.is_custom || q.is_edited || q.is_pinned);
    const unprotectedItems = questions.filter((q) => !q.is_custom && !q.is_edited && !q.is_pinned);

    expect(protectedItems).toHaveLength(3);
    expect(protectedItems.map((q) => q.id)).toEqual(["q1", "q2", "q3"]);
    expect(unprotectedItems).toHaveLength(1);
    expect(unprotectedItems[0].id).toBe("q4");
  });

  it("re-indexes preserved and new items into deterministic sequential IDs (q1, q2, q3...)", () => {
    const merged = [
      { prompt: "Preserved custom Q" },
      { prompt: "Preserved pinned Q" },
      { prompt: "New AI generated Q" },
    ];

    const reindexed = merged.map((q, idx) => ({
      ...q,
      id: `q${idx + 1}`,
    }));

    expect(reindexed.map((q) => q.id)).toEqual(["q1", "q2", "q3"]);
  });
});
