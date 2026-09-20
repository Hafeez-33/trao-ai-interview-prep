import { ApiError } from "@/types/api.js";

/**
 * Normalized API Client Error containing status code and structured error metadata.
 */
export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, status: number, code = "API_ERROR", details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Request options extending standard RequestInit with optional timeout.
 */
export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  timeoutMs?: number;
}

/**
 * Base API URL derived from public environment variable or defaulting to local proxy.
 */
const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || "/api/v1";

/**
 * Central typed API Client wrapper around fetch.
 * Enforces session credentials, JSON serialization, and structured error handling.
 */
export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, timeoutMs = 30000, headers = {}, signal, ...customConfig } = options;

  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = cleanEndpoint.startsWith("http")
    ? cleanEndpoint
    : `${API_BASE_URL.replace(/\/$/, "")}${cleanEndpoint}`;

  const controller = new AbortController();
  const timeoutId = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;

  // Chain external signal if provided
  if (signal) {
    signal.addEventListener("abort", () => controller.abort());
  }

  const requestHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(headers as Record<string, string>),
  };

  let requestBody: string | undefined;
  if (body !== undefined && body !== null) {
    requestHeaders["Content-Type"] = "application/json";
    requestBody = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, {
      ...customConfig,
      headers: requestHeaders,
      body: requestBody,
      credentials: "include", // Required for session cookie authentication
      signal: controller.signal,
    });

    let data: unknown;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errPayload = data as { error?: ApiError; message?: string } | undefined;
      const code = errPayload?.error?.code || "HTTP_ERROR";
      const message =
        errPayload?.error?.message ||
        errPayload?.message ||
        `Request failed with status ${response.status}`;
      const details = errPayload?.error?.details;

      throw new ApiClientError(message, response.status, code, details);
    }

    return data as T;
  } catch (error: unknown) {
    if (error instanceof ApiClientError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiClientError("Request timed out or was aborted.", 408, "TIMEOUT");
    }

    const message = error instanceof Error ? error.message : "Network error occurred.";
    throw new ApiClientError(message, 0, "NETWORK_ERROR");
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
