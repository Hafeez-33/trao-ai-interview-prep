import {
  InternalKitQuestion,
} from "../../types/kit.js";

/**
 * Details of coverage for an individual requirement.
 */
export interface CoverageRequirement {
  requirement_id: string;
  covered: boolean;
  question_ids: string[];
}

/**
 * Deterministic coverage calculation result.
 */
export interface CoverageResult {
  uncovered_requirement_ids: string[];
  passes: number;
  details: CoverageRequirement[];
}

/**
 * Result of targeted second-pass generation.
 */
export interface SecondPassResult {
  questions: InternalKitQuestion[];
  uncovered_requirement_ids: string[];
  generated_count: number;
}

/**
 * Raw question structure returned by LLM in second-pass generation.
 */
export interface RawSecondPassQuestion {
  requirement_ids?: unknown;
  category?: unknown;
  prompt?: unknown;
  answer_outline?: unknown;
  difficulty?: unknown;
  id?: unknown; // In case the model generates its own IDs (which must be discarded)
}

/**
 * Raw output object returned by LLM in second-pass generation.
 */
export interface RawSecondPassOutput {
  questions?: RawSecondPassQuestion[];
}
