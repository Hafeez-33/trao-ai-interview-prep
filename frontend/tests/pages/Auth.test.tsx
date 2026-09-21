import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { LoginPage } from "@/pages/LoginPage.js";
import { RegisterPage } from "@/pages/RegisterPage.js";
import { renderWithRouter, mockUser } from "../helpers/test-utils.js";
import { authApi } from "@/services/api/auth.api.js";

vi.mock("@/services/api/auth.api.js", () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    getMe: vi.fn(),
  },
}));

describe("Authentication Pages (UI Tests)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("LoginPage", () => {
    it("renders email, password inputs, sign in button, and register link", () => {
      renderWithRouter(<LoginPage />, { route: "/login", path: "/login" });

      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /sign up/i })).toHaveAttribute("href", "/register");
    });

    it("displays validation error when submitting with empty fields", async () => {
      renderWithRouter(<LoginPage />, { route: "/login", path: "/login" });

      fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

      expect(screen.getByText(/please enter both email and password/i)).toBeInTheDocument();
      expect(authApi.login).not.toHaveBeenCalled();
    });

    it("submits valid credentials and calls authApi.login", async () => {
      vi.mocked(authApi.login).mockResolvedValueOnce({ user: mockUser });

      renderWithRouter(<LoginPage />, { route: "/login", path: "/login" });

      fireEvent.change(screen.getByLabelText(/email address/i), {
        target: { value: "alice@example.com" },
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: "password123" },
      });

      fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

      await waitFor(() => {
        expect(authApi.login).toHaveBeenCalledWith({
          email: "alice@example.com",
          password: "password123",
        });
      });
    });

    it("displays error message when login fails", async () => {
      vi.mocked(authApi.login).mockRejectedValueOnce(
        new Error("Invalid email or password.")
      );

      renderWithRouter(<LoginPage />, { route: "/login", path: "/login" });

      fireEvent.change(screen.getByLabelText(/email address/i), {
        target: { value: "wrong@example.com" },
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: "wrongpass" },
      });

      fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
      });
    });
  });

  describe("RegisterPage", () => {
    it("renders email, password fields and sign up button", () => {
      renderWithRouter(<RegisterPage />, { route: "/register", path: "/register" });

      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /sign up/i })).toBeInTheDocument();
    });

    it("displays validation error when password is less than 8 characters", async () => {
      renderWithRouter(<RegisterPage />, { route: "/register", path: "/register" });

      fireEvent.change(screen.getByLabelText(/email address/i), {
        target: { value: "alice@example.com" },
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: "short" },
      });

      fireEvent.click(screen.getByRole("button", { name: /sign up/i }));

      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
      expect(authApi.register).not.toHaveBeenCalled();
    });

    it("submits valid credentials and calls authApi.register", async () => {
      vi.mocked(authApi.register).mockResolvedValueOnce({ user: mockUser });

      renderWithRouter(<RegisterPage />, { route: "/register", path: "/register" });

      fireEvent.change(screen.getByLabelText(/email address/i), {
        target: { value: "newuser@example.com" },
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: "strongpassword123" },
      });

      fireEvent.click(screen.getByRole("button", { name: /sign up/i }));

      await waitFor(() => {
        expect(authApi.register).toHaveBeenCalledWith({
          email: "newuser@example.com",
          password: "strongpassword123",
        });
      });
    });
  });
});
