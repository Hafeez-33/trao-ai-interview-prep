import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { CreateKitPage } from "@/pages/CreateKitPage.js";
import { renderWithRouter, mockKit } from "../helpers/test-utils.js";
import { kitsApi } from "@/services/api/kits.api.js";

vi.mock("@/services/api/kits.api.js", () => ({
  kitsApi: {
    createKit: vi.fn(),
  },
}));

describe("CreateKitPage (UI Tests)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders JD textarea, character counter, optional company URL, and days inputs", () => {
    renderWithRouter(<CreateKitPage />, { route: "/kits/new", path: "/kits/new" });

    expect(screen.getByLabelText(/job description/i)).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 50,000 chars/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/company website url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/preparation days/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate prep kit/i })).toBeInTheDocument();
  });

  it("updates character counter as user types into the textarea", () => {
    renderWithRouter(<CreateKitPage />, { route: "/kits/new", path: "/kits/new" });

    const textarea = screen.getByLabelText(/job description/i);
    fireEvent.change(textarea, { target: { value: "Senior Frontend Engineer with React." } });

    expect(screen.getByText(/36 \/ 50,000 chars/i)).toBeInTheDocument();
  });

  it("displays validation error when attempting to submit with empty JD", async () => {
    renderWithRouter(<CreateKitPage />, { route: "/kits/new", path: "/kits/new" });

    fireEvent.click(screen.getByRole("button", { name: /generate prep kit/i }));

    expect(screen.getByText(/please provide a job description/i)).toBeInTheDocument();
    expect(kitsApi.createKit).not.toHaveBeenCalled();
  });

  it("displays validation error when JD is less than 10 characters", async () => {
    renderWithRouter(<CreateKitPage />, { route: "/kits/new", path: "/kits/new" });

    const textarea = screen.getByLabelText(/job description/i);
    fireEvent.change(textarea, { target: { value: "Short" } });

    fireEvent.click(screen.getByRole("button", { name: /generate prep kit/i }));

    expect(screen.getByText(/at least 10 characters/i)).toBeInTheDocument();
    expect(kitsApi.createKit).not.toHaveBeenCalled();
  });

  it("calls kitsApi.createKit on valid submission", async () => {
    vi.mocked(kitsApi.createKit).mockResolvedValueOnce({
      kit: mockKit,
    });

    renderWithRouter(<CreateKitPage />, { route: "/kits/new", path: "/kits/new" });

    fireEvent.change(screen.getByLabelText(/job description/i), {
      target: { value: "Senior Backend Engineer with Node.js and TypeScript microservices." },
    });
    fireEvent.change(screen.getByLabelText(/company website url/i), {
      target: { value: "https://example.com" },
    });
    fireEvent.change(screen.getByLabelText(/preparation days/i), {
      target: { value: "7" },
    });

    fireEvent.click(screen.getByRole("button", { name: /generate prep kit/i }));

    await waitFor(() => {
      expect(kitsApi.createKit).toHaveBeenCalledWith({
        jd: "Senior Backend Engineer with Node.js and TypeScript microservices.",
        company_url: "https://example.com",
        days: 7,
      });
    });
  });
});
