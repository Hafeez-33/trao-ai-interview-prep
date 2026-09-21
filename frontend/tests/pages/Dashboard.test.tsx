import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { DashboardPage } from "@/pages/DashboardPage.js";
import { renderWithRouter, mockUser } from "../helpers/test-utils.js";
import { authApi } from "@/services/api/auth.api.js";
import { kitsApi } from "@/services/api/kits.api.js";
import { SafeKitSummary } from "@/types/kit.js";

vi.mock("@/services/api/auth.api.js", () => ({
  authApi: {
    getMe: vi.fn(),
  },
}));

vi.mock("@/services/api/kits.api.js", () => ({
  kitsApi: {
    listKits: vi.fn(),
    deleteKit: vi.fn(),
  },
}));

describe("DashboardPage (UI Tests)", () => {
  const mockSummaries: SafeKitSummary[] = [
    {
      _id: "kit1",
      role: "Senior Backend Engineer",
      company: "Acme Corp",
      status: "completed",
      days: 5,
      questionsCount: 10,
      flashcardsCount: 15,
      scheduleDaysCount: 5,
      createdAt: "2026-03-01T10:00:00.000Z",
      updatedAt: "2026-03-01T10:00:00.000Z",
    },
    {
      _id: "kit2",
      role: "Frontend Architect",
      company: "Beta Systems",
      status: "generating",
      days: 3,
      questionsCount: 0,
      flashcardsCount: 0,
      scheduleDaysCount: 0,
      createdAt: "2026-03-02T12:00:00.000Z",
      updatedAt: "2026-03-02T12:00:00.000Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state initially while fetching kits", () => {
    vi.mocked(authApi.getMe).mockReturnValue(new Promise(() => {})); // Never resolves
    vi.mocked(kitsApi.listKits).mockReturnValue(new Promise(() => {}));

    renderWithRouter(<DashboardPage />, { route: "/dashboard", path: "/dashboard" });

    expect(screen.getByRole("status", { name: /loading your interview kits/i })).toBeInTheDocument();
  });

  it("renders empty state when user has zero kits", async () => {
    vi.mocked(authApi.getMe).mockResolvedValueOnce({ user: mockUser });
    vi.mocked(kitsApi.listKits).mockResolvedValueOnce({ kits: [] });

    renderWithRouter(<DashboardPage />, { route: "/dashboard", path: "/dashboard" });

    await waitFor(() => {
      expect(screen.getByText(/no interview kits yet/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /\+ create your first kit/i })).toBeInTheDocument();
    });
  });

  it("renders populated dashboard with kits in deterministic descending order", async () => {
    vi.mocked(authApi.getMe).mockResolvedValueOnce({ user: mockUser });
    vi.mocked(kitsApi.listKits).mockResolvedValueOnce({ kits: mockSummaries });

    renderWithRouter(<DashboardPage />, { route: "/dashboard", path: "/dashboard" });

    await waitFor(() => {
      expect(screen.getByText("Senior Backend Engineer")).toBeInTheDocument();
      expect(screen.getByText("Frontend Architect")).toBeInTheDocument();
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
      expect(screen.getByText("Beta Systems")).toBeInTheDocument();
    });

    // Check deterministic ordering (Beta Systems is newer: 2026-03-02)
    const cards = screen.getAllByRole("heading", { level: 3 });
    expect(cards[0]).toHaveTextContent("Frontend Architect");
    expect(cards[1]).toHaveTextContent("Senior Backend Engineer");
  });

  it("filters kits by search query", async () => {
    vi.mocked(authApi.getMe).mockResolvedValueOnce({ user: mockUser });
    vi.mocked(kitsApi.listKits).mockResolvedValueOnce({ kits: mockSummaries });

    renderWithRouter(<DashboardPage />, { route: "/dashboard", path: "/dashboard" });

    await waitFor(() => {
      expect(screen.getByText("Senior Backend Engineer")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search by role or company/i);
    fireEvent.change(searchInput, { target: { value: "Backend" } });

    expect(screen.getByText("Senior Backend Engineer")).toBeInTheDocument();
    expect(screen.queryByText("Frontend Architect")).not.toBeInTheDocument();
  });

  it("filters kits by status tab", async () => {
    vi.mocked(authApi.getMe).mockResolvedValueOnce({ user: mockUser });
    vi.mocked(kitsApi.listKits).mockResolvedValueOnce({ kits: mockSummaries });

    renderWithRouter(<DashboardPage />, { route: "/dashboard", path: "/dashboard" });

    await waitFor(() => {
      expect(screen.getByText("Senior Backend Engineer")).toBeInTheDocument();
    });

    // Click "Completed" filter tab
    const completedTab = screen.getByRole("button", { name: /^completed$/i });
    fireEvent.click(completedTab);

    expect(screen.getByText("Senior Backend Engineer")).toBeInTheDocument();
    expect(screen.queryByText("Frontend Architect")).not.toBeInTheDocument();
  });

  it("opens delete confirmation modal and deletes kit successfully", async () => {
    vi.mocked(authApi.getMe).mockResolvedValueOnce({ user: mockUser });
    vi.mocked(kitsApi.listKits).mockResolvedValueOnce({ kits: mockSummaries });
    vi.mocked(kitsApi.deleteKit).mockResolvedValueOnce({ message: "Kit deleted successfully" });

    renderWithRouter(<DashboardPage />, { route: "/dashboard", path: "/dashboard" });

    await waitFor(() => {
      expect(screen.getByText("Senior Backend Engineer")).toBeInTheDocument();
    });

    // Find and click delete button for Senior Backend Engineer
    const deleteBtn = screen.getByRole("button", { name: /delete senior backend engineer kit/i });
    fireEvent.click(deleteBtn);

    // Confirmation dialog should appear
    expect(screen.getByText(/delete this interview prep kit\?/i)).toBeInTheDocument();

    const confirmDeleteBtn = screen.getByRole("button", { name: /delete kit/i });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(kitsApi.deleteKit).toHaveBeenCalledWith("kit1");
      expect(screen.queryByText("Senior Backend Engineer")).not.toBeInTheDocument();
    });
  });

  it("displays error message if deletion fails", async () => {
    vi.mocked(authApi.getMe).mockResolvedValueOnce({ user: mockUser });
    vi.mocked(kitsApi.listKits).mockResolvedValueOnce({ kits: mockSummaries });
    vi.mocked(kitsApi.deleteKit).mockRejectedValueOnce(new Error("Database deletion error."));

    renderWithRouter(<DashboardPage />, { route: "/dashboard", path: "/dashboard" });

    await waitFor(() => {
      expect(screen.getByText("Senior Backend Engineer")).toBeInTheDocument();
    });

    const deleteBtn = screen.getByRole("button", { name: /delete senior backend engineer kit/i });
    fireEvent.click(deleteBtn);

    const confirmDeleteBtn = screen.getByRole("button", { name: /delete kit/i });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(screen.getByText(/database deletion error/i)).toBeInTheDocument();
    });
  });
});
