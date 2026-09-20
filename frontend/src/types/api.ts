/**
 * Frontend API Response and Error Types
 */

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T = unknown> {
  success?: boolean;
  message?: string;
  data?: T;
  error?: ApiError;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthResponse {
  user: AuthUser;
  token?: string;
  message?: string;
}

export interface AuthUserResponse {
  user: AuthUser;
}
