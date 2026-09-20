import { ObjectId } from "mongodb";

export const MAX_JD_LENGTH = 50000;
export const MIN_JD_LENGTH = 10;
export const MIN_DAYS = 1;
export const MAX_DAYS = 60;

export interface ValidationResult<T = unknown> {
  valid: boolean;
  value?: T;
  error?: string;
}

/**
 * Validates a job description according to Phase 1/4 security constraints:
 * - Must be a string.
 * - Must not be empty or whitespace-only.
 * - Must be between MIN_JD_LENGTH (10) and MAX_JD_LENGTH (50,000) characters.
 * - Trims surrounding whitespace without silently truncating.
 */
export function validateJd(jd: unknown): ValidationResult<string> {
  if (jd === undefined || jd === null) {
    return { valid: false, error: "Job description is required." };
  }

  if (typeof jd !== "string") {
    return { valid: false, error: "Job description must be a string." };
  }

  const trimmed = jd.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: "Job description cannot be empty or whitespace-only." };
  }

  if (trimmed.length < MIN_JD_LENGTH) {
    return {
      valid: false,
      error: `Job description must be at least ${MIN_JD_LENGTH} characters long.`,
    };
  }

  if (trimmed.length > MAX_JD_LENGTH) {
    return {
      valid: false,
      error: `Job description exceeds maximum permitted length of ${MAX_JD_LENGTH} characters.`,
    };
  }

  return { valid: true, value: trimmed };
}

/**
 * Validates company_url if provided.
 * Must be a valid HTTP or HTTPS URL string.
 */
export function validateCompanyUrl(url: unknown): ValidationResult<string | undefined> {
  if (url === undefined || url === null || url === "") {
    return { valid: true, value: undefined };
  }

  if (typeof url !== "string") {
    return { valid: false, error: "company_url must be a string." };
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return { valid: true, value: undefined };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { valid: false, error: "company_url must use http or https protocol." };
    }
    return { valid: true, value: trimmed };
  } catch {
    return { valid: false, error: "company_url must be a valid URL." };
  }
}

/**
 * Validates days before interview if provided.
 * Must be an integer between 1 and 60.
 */
export function validateDays(days: unknown): ValidationResult<number | undefined> {
  if (days === undefined || days === null) {
    return { valid: true, value: undefined };
  }

  const num = typeof days === "number" ? days : parseInt(String(days), 10);

  if (isNaN(num) || !Number.isInteger(num)) {
    return { valid: false, error: "days must be an integer." };
  }

  if (num < MIN_DAYS || num > MAX_DAYS) {
    return {
      valid: false,
      error: `days must be between ${MIN_DAYS} and ${MAX_DAYS}.`,
    };
  }

  return { valid: true, value: num };
}

/**
 * Validates standard 24-character hexadecimal MongoDB ObjectId string.
 */
export function isValidObjectId(id: unknown): boolean {
  if (typeof id !== "string") return false;
  return ObjectId.isValid(id) && /^[0-9a-fA-F]{24}$/.test(id);
}
