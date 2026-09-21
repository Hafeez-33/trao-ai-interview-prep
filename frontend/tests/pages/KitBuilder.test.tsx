import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { KitBuilderPage } from "@/pages/KitBuilderPage.js";
import { renderWithRouter, mockKit } from "../helpers/test-utils.js";
import { kitsApi } from "@/services/api/kits.api.js";

vi.mock("@/services/api/kits.api.js", () => ({
  kitsApi: {
    getKit: vi.fn(),
    updateKit: vi.fn(),
    regenerateCategory: vi.fn(),
  },
}));

describe("KitBuilderPage (UI Tests)", () => {
  const kitId = "65a123456789abcdef012345";

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders requirements, questions, and flashcards sections", async () => {
    vi.mocked(kitsApi.getKit).mockResolvedValueOnce({ kit: mockKit });

    renderWithRouter(<KitBuilderPage />, {
      route: `/kits/${kitId}/builder`,
      path: "/kits/:id/builder",
    });

    await waitFor(() => {
      expect(screen.getByText(/senior fullstack engineer/i)).toBeInTheDocument();
      expect(screen.getByText(/role requirements/i)).toBeInTheDocument();
      expect(screen.getByText(/interview questions/i)).toBeInTheDocument();
      expect(screen.getByText(/study flashcards/i)).toBeInTheDocument();
    });
  });

  it("allows adding a custom question and marks save state as unsaved", async () => {
    vi.mocked(kitsApi.getKit).mockResolvedValueOnce({ kit: mockKit });

    renderWithRouter(<KitBuilderPage />, {
      route: `/kits/${kitId}/builder`,
      path: "/kits/:id/builder",
    });

    await waitFor(() => {
      expect(screen.getByText(/interview questions/i)).toBeInTheDocument();
    });

    // Click "+ Add Custom Question"
    const addBtn = screen.getByRole("button", { name: /\+ add custom question/i });
    fireEvent.click(addBtn);

    // Enter question details
    const promptInput = screen.getByLabelText(/question prompt/i);
    const outlineInput = screen.getByLabelText(/answer outline/i);

    fireEvent.change(promptInput, { target: { value: "What is idempotency in REST APIs?" } });
    fireEvent.change(outlineInput, { target: { value: "Definition, HTTP methods, token-based keys" } });

    // Select requirement
    const reqCheckbox = screen.getAllByRole("checkbox")[0];
    if (reqCheckbox && !reqCheckbox.hasAttribute("checked")) {
      fireEvent.click(reqCheckbox);
    }

    // Submit custom question form
    const saveNewBtn = screen.getByRole("button", { name: /add question/i });
    fireEvent.click(saveNewBtn);

    // Verify newly added question is displayed
    await waitFor(() => {
      expect(screen.getByText("What is idempotency in REST APIs?")).toBeInTheDocument();
      expect(screen.getAllByText(/unsaved/i).length).toBeGreaterThan(0);
    });
  });

  it("allows toggling pin status on questions", async () => {
    vi.mocked(kitsApi.getKit).mockResolvedValueOnce({ kit: mockKit });

    renderWithRouter(<KitBuilderPage />, {
      route: `/kits/${kitId}/builder`,
      path: "/kits/:id/builder",
    });

    await waitFor(() => {
      expect(screen.getByText(/interview questions/i)).toBeInTheDocument();
    });

    // Click pin button on first question
    const pinBtn = screen.getAllByRole("button", { name: /pin question/i })[0];
    fireEvent.click(pinBtn);

    // Unsaved state should be triggered
    await waitFor(() => {
      expect(screen.getAllByText(/unsaved/i).length).toBeGreaterThan(0);
    });
  });

  it("handles save changes API call and error state", async () => {
    vi.mocked(kitsApi.getKit).mockResolvedValueOnce({ kit: mockKit });
    vi.mocked(kitsApi.updateKit).mockRejectedValueOnce(new Error("Database write failed."));

    renderWithRouter(<KitBuilderPage />, {
      route: `/kits/${kitId}/builder`,
      path: "/kits/:id/builder",
    });

    await waitFor(() => {
      expect(screen.getByText(/interview questions/i)).toBeInTheDocument();
    });

    // Make a dirty change by pinning
    const pinBtn = screen.getAllByRole("button", { name: /pin question/i })[0];
    fireEvent.click(pinBtn);

    // Click Save Changes button
    const saveBtn = screen.getAllByRole("button", { name: /save changes/i })[0];
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(kitsApi.updateKit).toHaveBeenCalled();
      expect(screen.getAllByText(/save failed/i).length).toBeGreaterThan(0);
    });
  });
});
