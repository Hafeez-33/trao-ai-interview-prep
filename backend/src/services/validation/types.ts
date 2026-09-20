import { CrawledPage } from "../crawler/types.js";

/**
 * Validation error item with deterministic code, property path, and human-readable message.
 */
export interface ValidationError {
  code: string;
  path: string;
  message: string;
}

/**
 * Validation warning item with deterministic code, property path, and human-readable message.
 */
export interface ValidationWarning {
  code: string;
  path: string;
  message: string;
}

/**
 * Structured validation result returned by KitValidationService.
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Optional contextual data passed to validation when available from the internal store.
 */
export interface ValidationOptions {
  /**
   * Stored Job Description text to verify source.jd_chars against.
   */
  rawJd?: string;
  /**
   * Internally verified crawler pages to verify company_brief.sources against.
   */
  crawledPages?: CrawledPage[];
}

/**
 * Validation error codes taxonomy.
 */
export const ValidationErrorCode = {
  INVALID_SCHEMA: "INVALID_SCHEMA",
  MISSING_FIELD: "MISSING_FIELD",
  INVALID_TYPE: "INVALID_TYPE",
  EMPTY_VALUE: "EMPTY_VALUE",
  DUPLICATE_REQUIREMENT_ID: "DUPLICATE_REQUIREMENT_ID",
  DUPLICATE_QUESTION_ID: "DUPLICATE_QUESTION_ID",
  DUPLICATE_FLASHCARD_ID: "DUPLICATE_FLASHCARD_ID",
  INVALID_REQUIREMENT_REFERENCE: "INVALID_REQUIREMENT_REFERENCE",
  INVALID_QUESTION_CATEGORY: "INVALID_QUESTION_CATEGORY",
  INVALID_DIFFICULTY: "INVALID_DIFFICULTY",
  INVALID_COVERAGE: "INVALID_COVERAGE",
  INVALID_SCHEDULE: "INVALID_SCHEDULE",
  MISSING_MUST_REQUIREMENT: "MISSING_MUST_REQUIREMENT",
  INVALID_SOURCE_URL: "INVALID_SOURCE_URL",
  INVALID_JD_CHAR_COUNT: "INVALID_JD_CHAR_COUNT",
  INVALID_DAYS: "INVALID_DAYS",
  INVALID_DAY_NUMBER: "INVALID_DAY_NUMBER",
  INVALID_MINUTES: "INVALID_MINUTES",
  DUPLICATE_SCHEDULE_QUESTION: "DUPLICATE_SCHEDULE_QUESTION",
  INTERNAL_FIELD_LEAK: "INTERNAL_FIELD_LEAK",
} as const;

export type ValidationErrorCode =
  (typeof ValidationErrorCode)[keyof typeof ValidationErrorCode];
