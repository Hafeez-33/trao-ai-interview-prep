import { apiClient } from "./client.js";
import { AuthResponse, AuthUserResponse } from "@/types/api.js";

export interface AuthCredentials {
  email: string;
  password: string;
}

/**
 * Frontend Authentication API Service
 * Interacts with /api/v1/auth endpoints using session cookies.
 */
export const authApi = {
  /**
   * Registers a new user account.
   */
  async register(credentials: AuthCredentials): Promise<AuthResponse> {
    return apiClient<AuthResponse>("/auth/register", {
      method: "POST",
      body: credentials,
    });
  },

  /**
   * Authenticates a user with email and password.
   */
  async login(credentials: AuthCredentials): Promise<AuthResponse> {
    return apiClient<AuthResponse>("/auth/login", {
      method: "POST",
      body: credentials,
    });
  },

  /**
   * Terminates the current authenticated session.
   */
  async logout(): Promise<{ message: string }> {
    return apiClient<{ message: string }>("/auth/logout", {
      method: "POST",
    });
  },

  /**
   * Fetches the currently authenticated user session.
   */
  async getMe(): Promise<AuthUserResponse> {
    return apiClient<AuthUserResponse>("/auth/me", {
      method: "GET",
    });
  },
};
