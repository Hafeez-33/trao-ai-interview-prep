/**
 * Trao AI Interview Prep Kit
 * Appendix A & B TypeScript Contracts & Schemas
 *
 * Strict contract definitions matching assessment requirements.
 */

// ============================================================================
// 1. Enums & Literal Unions
// ============================================================================

export type RequirementKind = "technical" | "behavioural" | "domain";
export type RequirementPriority = "must" | "nice";

export type QuestionCategory =
  | "technical"
  | "behavioural"
  | "system-design"
  | "company-fit";

export type QuestionDifficulty = 1 | 2 | 3;

export type GenerationStatus =
  | "pending"
  | "crawling"
  | "generating"
  | "completed"
  | "failed";

export type PracticeConfidence = "again" | "hard" | "good" | "easy";

// ============================================================================
// 2. Strict Appendix A Kit Schema (External Assessment Contract)
// ============================================================================

export interface KitSource {
  company: string;
  company_url: string;
  role: string;
  location: string;
  jd_chars: number;
  researched_at: string; // ISO 8601 string, e.g. "2026-09-01T09:12:44Z"
  pages_used: string[];
}

export interface KitCompanyBrief {
  summary: string;
  what_they_do: string;
  sources: string[];
}

export interface KitRequirement {
  id: string; // "r1", "r2", ...
  text: string;
  kind: RequirementKind;
  priority: RequirementPriority;
}

export interface KitRole {
  title: string;
  seniority: string;
  responsibilities: string[];
  requirements: KitRequirement[];
}

export interface KitQuestion {
  id: string; // "q1", "q2", ...
  requirement_ids: string[];
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: QuestionDifficulty; // 1 | 2 | 3
}

export interface KitFlashcard {
  id: string; // "f1", "f2", ...
  front: string;
  back: string;
  requirement_ids: string[];
}

export interface KitScheduleDay {
  day: number; // 1, 2, ...
  focus: string;
  question_ids: string[];
  minutes: number; // Integer minutes (no floats, no strings)
}

export interface KitSchedule {
  days_available: number;
  days: KitScheduleDay[];
}

export interface KitCoverage {
  uncovered_requirement_ids: string[];
  passes: number;
}

/**
 * Exact Appendix A Kit Structure
 * Field names and types must match the Trao specification without exception.
 */
export interface KitStructure {
  source: KitSource;
  company_brief: KitCompanyBrief;
  role: KitRole;
  questions: KitQuestion[];
  flashcards: KitFlashcard[];
  schedule: KitSchedule;
  coverage: KitCoverage;
}

// ============================================================================
// 3. Extended Internal Kit Types (For UI Builder & State Preservation)
// ============================================================================

export interface InternalKitQuestion extends KitQuestion {
  is_custom?: boolean;
  is_edited?: boolean;
  is_pinned?: boolean;
  order?: number;
}

export interface InternalKitFlashcard extends KitFlashcard {
  is_custom?: boolean;
  is_edited?: boolean;
  order?: number;
}

export interface InternalKitCompanyBrief extends KitCompanyBrief {
  is_edited?: boolean;
}

export interface InternalKitRequirement extends KitRequirement {
  is_custom?: boolean;
  is_edited?: boolean;
}

export interface InternalKitStructure extends KitStructure {
  _id?: string;
  userId?: string;
  status?: GenerationStatus;
  progressMessage?: string;
  errorMessage?: string;
  role: {
    title: string;
    seniority: string;
    responsibilities: string[];
    requirements: InternalKitRequirement[];
  };
  questions: InternalKitQuestion[];
  flashcards: InternalKitFlashcard[];
  company_brief: InternalKitCompanyBrief;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// 4. Appendix B Batch Evaluator Contract
// ============================================================================

export interface BatchCaseInput {
  id: string;
  jd: string;
  company_url: string;
  days: number;
}

export interface BatchKitError {
  code: string;
  message: string;
}

export interface BatchKitEntryOk {
  id: string;
  status: "ok";
  kit: KitStructure;
  error: null;
}

export interface BatchKitEntryFailed {
  id: string;
  status: "failed";
  kit: null;
  error: BatchKitError;
}

export type BatchKitEntry = BatchKitEntryOk | BatchKitEntryFailed;

export interface BatchOutputStructure {
  version: "1.0";
  generated_at: string; // ISO 8601 timestamp
  kits: BatchKitEntry[];
}
