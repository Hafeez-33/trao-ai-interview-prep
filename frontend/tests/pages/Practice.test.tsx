import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { PracticePage } from "@/pages/PracticePage.js";
import { renderWithRouter } from "../helpers/test-utils.js";
import { kitsApi } from "@/services/api/kits.api.js";
import { PracticeState } from "@/types/practice.js";

vi.mock("@/services/api/kits.api.js", () => ({
  kitsApi: {
    getPracticeState: vi.fn(),
    recordPracticeConfidence: vi.fn(),
    resetPractice: vi.fn(),
  },
}));

describe("PracticePage (UI Tests)", () => {
  const kitId = "65a123456789abcdef012345";

  const initialPracticeState: PracticeState = {
    kit_id: kitId,
    total_questions: 3,
    completed_questions: 0,
    completed: false,
    confidence_summary: {
      low: 0,
      medium: 0,
      high: 0,
      unrated: 3,
    },
    next_question: {
      id: "q1",
      prompt: "Explain event loop in Node.js",
      answer_outline: "Call stack, libuv event loop, microtask and macrotask queues.",
      category: "technical",
      difficulty: 2,
      requirement_ids: ["r1"],
      confidence: null,
      attempts: 0,
      last_practiced_at: null,
    },
    questions: [
      {
        id: "q1",
        prompt: "Explain event loop in Node.js",
        answer_outline: "Call stack, libuv event loop, microtask and macrotask queues.",
        category: "technical",
        difficulty: 2,
        requirement_ids: ["r1"],
        confidence: null,
        attempts: 0,
        last_practiced_at: null,
      },
      {
        id: "q2",
        prompt: "Describe how you resolved a production outage.",
        answer_outline: "STAR method, triage, communication, post-mortem.",
        category: "behavioural",
        difficulty: 2,
        requirement_ids: ["r2"],
        confidence: null,
        attempts: 0,
        last_practiced_at: null,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders practice question prompt and progress bar", async () => {
    vi.mocked(kitsApi.getPracticeState).mockResolvedValueOnce({
      practice: initialPracticeState,
    });

    renderWithRouter(<PracticePage />, {
      route: `/kits/${kitId}/practice`,
      path: "/kits/:id/practice",
    });

    await waitFor(() => {
      expect(screen.getByText(/practice mode/i)).toBeInTheDocument();
      expect(screen.getByText(/explain event loop in node\.js/i)).toBeInTheDocument();
      expect(screen.getByText("q1")).toBeInTheDocument();
    });

    // Answer should be hidden initially
    expect(screen.queryByText(/call stack, libuv event loop/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reveal answer outline/i })).toBeInTheDocument();
  });

  it("reveals answer outline upon clicking reveal button", async () => {
    vi.mocked(kitsApi.getPracticeState).mockResolvedValueOnce({
      practice: initialPracticeState,
    });

    renderWithRouter(<PracticePage />, {
      route: `/kits/${kitId}/practice`,
      path: "/kits/:id/practice",
    });

    await waitFor(() => {
      expect(screen.getByText(/explain event loop in node\.js/i)).toBeInTheDocument();
    });

    const revealBtn = screen.getByRole("button", { name: /reveal answer outline/i });
    fireEvent.click(revealBtn);

    expect(screen.getByText(/call stack, libuv event loop/i)).toBeInTheDocument();
    expect(screen.getByText(/how confident do you feel/i)).toBeInTheDocument();
  });

  it("submits confidence rating 1, 2, or 3 and advances practice session", async () => {
    vi.mocked(kitsApi.getPracticeState).mockResolvedValueOnce({
      practice: initialPracticeState,
    });

    const updatedState: PracticeState = {
      ...initialPracticeState,
      completed_questions: 1,
      confidence_summary: { low: 0, medium: 0, high: 1, unrated: 2 },
      next_question: {
        id: "q2",
        prompt: "Describe how you resolved a production outage.",
        answer_outline: "STAR method, triage, communication, post-mortem.",
        category: "behavioural",
        difficulty: 2,
        requirement_ids: ["r2"],
        confidence: null,
        attempts: 0,
        last_practiced_at: null,
      },
    };

    vi.mocked(kitsApi.recordPracticeConfidence).mockResolvedValueOnce({
      practice: updatedState,
    });

    renderWithRouter(<PracticePage />, {
      route: `/kits/${kitId}/practice`,
      path: "/kits/:id/practice",
    });

    await waitFor(() => {
      expect(screen.getByText(/explain event loop in node\.js/i)).toBeInTheDocument();
    });

    // Reveal answer
    fireEvent.click(screen.getByRole("button", { name: /reveal answer outline/i }));

    // Click Confidence 3 (High)
    const conf3Btn = screen.getByRole("button", { name: /3 — high/i });
    fireEvent.click(conf3Btn);

    await waitFor(() => {
      expect(kitsApi.recordPracticeConfidence).toHaveBeenCalledWith(kitId, "q1", 3);
      // Next question should now be rendered
      expect(screen.getByText(/describe how you resolved a production outage/i)).toBeInTheDocument();
    });
  });

  it("renders completion screen when all questions are answered", async () => {
    const completedPracticeState: PracticeState = {
      ...initialPracticeState,
      completed: true,
      completed_questions: 3,
      total_questions: 3,
      next_question: null,
      confidence_summary: { low: 0, medium: 1, high: 2, unrated: 0 },
    };

    vi.mocked(kitsApi.getPracticeState).mockResolvedValueOnce({
      practice: completedPracticeState,
    });

    renderWithRouter(<PracticePage />, {
      route: `/kits/${kitId}/practice`,
      path: "/kits/:id/practice",
    });

    await waitFor(() => {
      expect(screen.getByText(/practice session complete!/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /practice again/i })).toBeInTheDocument();
    });
  });

  it("resets practice session when reset is confirmed", async () => {
    const completedPracticeState: PracticeState = {
      ...initialPracticeState,
      completed: true,
      completed_questions: 3,
      total_questions: 3,
      next_question: null,
    };

    vi.mocked(kitsApi.getPracticeState).mockResolvedValueOnce({
      practice: completedPracticeState,
    });
    vi.mocked(kitsApi.resetPractice).mockResolvedValueOnce({
      practice: initialPracticeState,
    });

    renderWithRouter(<PracticePage />, {
      route: `/kits/${kitId}/practice`,
      path: "/kits/:id/practice",
    });

    await waitFor(() => {
      expect(screen.getByText(/practice session complete!/i)).toBeInTheDocument();
    });

    const resetBtn = screen.getByRole("button", { name: /practice again/i });
    fireEvent.click(resetBtn);

    await waitFor(() => {
      expect(kitsApi.resetPractice).toHaveBeenCalledWith(kitId);
      expect(screen.getByText(/explain event loop in node\.js/i)).toBeInTheDocument();
    });
  });
});
