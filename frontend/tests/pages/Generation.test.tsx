import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { GenerationPage } from "@/pages/GenerationPage.js";
import { renderWithRouter, mockKit } from "../helpers/test-utils.js";
import { kitsApi } from "@/services/api/kits.api.js";

vi.mock("@/services/api/kits.api.js", () => ({
  kitsApi: {
    getKit: vi.fn(),
    extractRequirements: vi.fn(),
    crawlCompany: vi.fn(),
    researchCompany: vi.fn(),
    generateKit: vi.fn(),
    runCoverage: vi.fn(),
    generateSchedule: vi.fn(),
    validateKit: vi.fn(),
  },
}));

describe("GenerationPage (UI Tests)", () => {
  const kitId = "65a123456789abcdef012345";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders pending and progresses through running and completed steps for a full generation flow", async () => {
    // Initial loaded empty kit
    const emptyKit = {
      ...mockKit,
      status: "pending" as const,
      role: { ...mockKit.role, requirements: [] },
      company_brief: { summary: "", culture: [], interview_process: [], products: [] },
      questions: [],
      coverage: { covered_count: 0, must_covered_count: 0, passes: 0 },
      schedule: { ...mockKit.schedule, days: [] },
    };

    const extractedKit = {
      ...emptyKit,
      role: mockKit.role,
    };

    const researchedKit = {
      ...extractedKit,
      company_brief: mockKit.company_brief,
    };

    const generatedKit = {
      ...researchedKit,
      questions: mockKit.questions,
      flashcards: mockKit.flashcards,
    };

    const coveredKit = {
      ...generatedKit,
      coverage: mockKit.coverage,
    };

    const scheduledKit = {
      ...coveredKit,
      schedule: mockKit.schedule,
    };

    const completedKit = {
      ...scheduledKit,
      status: "completed" as const,
    };

    vi.mocked(kitsApi.getKit).mockResolvedValue({ kit: emptyKit });
    vi.mocked(kitsApi.extractRequirements).mockResolvedValueOnce({ kit: extractedKit });
    vi.mocked(kitsApi.crawlCompany).mockResolvedValueOnce({ success: true, pagesCrawled: 1 });
    vi.mocked(kitsApi.researchCompany).mockResolvedValueOnce({ kit: researchedKit });
    vi.mocked(kitsApi.generateKit).mockResolvedValueOnce({ kit: generatedKit });
    vi.mocked(kitsApi.runCoverage).mockResolvedValueOnce({ kit: coveredKit });
    vi.mocked(kitsApi.generateSchedule).mockResolvedValueOnce({ kit: scheduledKit });
    vi.mocked(kitsApi.validateKit).mockResolvedValueOnce({ valid: true, errors: [], kit: completedKit });

    renderWithRouter(<GenerationPage />, {
      route: `/kits/${kitId}/generating`,
      path: "/kits/:id/generating",
    });

    expect(screen.getByText(/generating interview prep kit/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(kitsApi.getKit).toHaveBeenCalledWith(kitId);
      expect(kitsApi.extractRequirements).toHaveBeenCalledWith(kitId);
      expect(kitsApi.crawlCompany).toHaveBeenCalledWith(kitId);
      expect(kitsApi.researchCompany).toHaveBeenCalledWith(kitId);
      expect(kitsApi.generateKit).toHaveBeenCalledWith(kitId);
      expect(kitsApi.runCoverage).toHaveBeenCalledWith(kitId);
      expect(kitsApi.generateSchedule).toHaveBeenCalledWith(kitId);
      expect(kitsApi.validateKit).toHaveBeenCalledWith(kitId);
    });

    // Completion CTA should appear
    await waitFor(() => {
      expect(screen.getByText(/your prep kit is ready!/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /open prep kit/i })).toBeInTheDocument();
    });
  });

  it("handles failed step and enables retry action", async () => {
    const emptyKit = {
      ...mockKit,
      status: "pending" as const,
      role: { ...mockKit.role, requirements: [] },
    };

    vi.mocked(kitsApi.getKit).mockResolvedValue({ kit: emptyKit });
    vi.mocked(kitsApi.extractRequirements).mockRejectedValueOnce(
      new Error("Extraction LLM call failed.")
    );

    renderWithRouter(<GenerationPage />, {
      route: `/kits/${kitId}/generating`,
      path: "/kits/:id/generating",
    });

    await waitFor(() => {
      expect(screen.getByText("Extraction LLM call failed.")).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole("button", { name: /retry this step/i });
    expect(retryBtn).toBeInTheDocument();

    // Now mock success on retry
    const extractedKit = {
      ...emptyKit,
      role: mockKit.role,
      questions: mockKit.questions,
      coverage: mockKit.coverage,
      schedule: mockKit.schedule,
    };
    vi.mocked(kitsApi.extractRequirements).mockResolvedValueOnce({ kit: extractedKit });
    vi.mocked(kitsApi.crawlCompany).mockResolvedValueOnce({ success: true, pagesCrawled: 0 });
    vi.mocked(kitsApi.researchCompany).mockResolvedValueOnce({ kit: extractedKit });
    vi.mocked(kitsApi.generateKit).mockResolvedValueOnce({ kit: extractedKit });
    vi.mocked(kitsApi.runCoverage).mockResolvedValueOnce({ kit: extractedKit });
    vi.mocked(kitsApi.generateSchedule).mockResolvedValueOnce({ kit: extractedKit });
    vi.mocked(kitsApi.validateKit).mockResolvedValueOnce({ valid: true, errors: [], kit: extractedKit });

    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(kitsApi.extractRequirements).toHaveBeenCalledTimes(2);
    });
  });

  it("fast-forwards immediately when kit is already completed (idempotency)", async () => {
    const completedKit = {
      ...mockKit,
      status: "completed" as const,
    };

    vi.mocked(kitsApi.getKit).mockResolvedValue({ kit: completedKit });

    renderWithRouter(<GenerationPage />, {
      route: `/kits/${kitId}/generating`,
      path: "/kits/:id/generating",
    });

    await waitFor(() => {
      expect(kitsApi.getKit).toHaveBeenCalledWith(kitId);
      expect(screen.getByText(/your prep kit is ready!/i)).toBeInTheDocument();
    });

    // None of the generative pipeline endpoints should be invoked
    expect(kitsApi.extractRequirements).not.toHaveBeenCalled();
    expect(kitsApi.generateKit).not.toHaveBeenCalled();
  });
});
