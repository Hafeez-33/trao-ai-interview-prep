import { ObjectId } from "mongodb";

export type GenerationStatus =
  | "pending"
  | "crawling"
  | "generating"
  | "completed"
  | "failed";

export type RequirementKind = "technical" | "behavioural" | "domain";
export type RequirementPriority = "must" | "nice";

export type QuestionCategory =
  | "technical"
  | "behavioural"
  | "system-design"
  | "company-fit";

export type QuestionDifficulty = 1 | 2 | 3;

export interface KitSource {
  company: string;
  company_url: string;
  role: string;
  location: string;
  jd_chars: number;
  researched_at: string; // ISO 8601 string, e.g. "2026-09-01T09:12:44Z"
  pages_used: string[];
}

import { CrawledPage } from "../services/crawler/types.js";
import { InterviewResearch } from "../services/research/types.js";

export interface KitCompanyBrief {
  summary: string;
  what_they_do: string;
  sources: string[];
  is_edited?: boolean;
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

export interface InternalKitQuestion extends KitQuestion {
  is_custom?: boolean;
  is_edited?: boolean;
  is_pinned?: boolean;
  order?: number;
}

export interface KitFlashcard {
  id: string; // "f1", "f2", ...
  front: string;
  back: string;
  requirement_ids: string[];
}

export interface InternalKitFlashcard extends KitFlashcard {
  is_custom?: boolean;
  is_edited?: boolean;
  order?: number;
}

export interface KitScheduleDay {
  day: number; // 1, 2, ...
  focus: string;
  question_ids: string[];
  minutes: number;
}

export interface KitSchedule {
  days_available: number;
  days: KitScheduleDay[];
}

export interface KitCoverage {
  uncovered_requirement_ids: string[];
  passes: number;
}

export interface KitStructure {
  source: KitSource;
  company_brief: KitCompanyBrief;
  role: KitRole;
  questions: KitQuestion[];
  flashcards: KitFlashcard[];
  schedule: KitSchedule;
  coverage: KitCoverage;
}

/**
 * MongoDB document representation for a Kit.
 * Stored within the `kits` collection.
 */
export interface IKitDocument {
  _id?: ObjectId;
  userId: string;
  status: GenerationStatus;
  progressMessage?: string;
  errorMessage?: string;
  jd: string;

  // Strict Appendix A Structure Fields (with internal builder flags)
  source: KitSource;
  company_brief: KitCompanyBrief;
  role: KitRole;
  questions: InternalKitQuestion[];
  flashcards: InternalKitFlashcard[];
  schedule: KitSchedule;
  coverage: KitCoverage;

  // Internal server-side cached crawler data & research
  crawled_pages?: CrawledPage[];
  interview_research?: InterviewResearch;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Sanitizes an internal question to the strict Appendix A contract.
 */
function sanitizeQuestion(q: InternalKitQuestion): KitQuestion {
  return {
    id: q.id,
    requirement_ids: q.requirement_ids,
    category: q.category,
    prompt: q.prompt,
    answer_outline: q.answer_outline,
    difficulty: q.difficulty,
  };
}

/**
 * Sanitizes an internal flashcard to the strict Appendix A contract.
 */
function sanitizeFlashcard(f: InternalKitFlashcard): KitFlashcard {
  return {
    id: f.id,
    front: f.front,
    back: f.back,
    requirement_ids: f.requirement_ids,
  };
}

/**
 * Sanitizes company brief to strict Appendix A fields (removes is_edited).
 */
function sanitizeCompanyBrief(b: KitCompanyBrief): KitCompanyBrief {
  return {
    summary: b.summary,
    what_they_do: b.what_they_do,
    sources: b.sources,
  };
}

/**
 * Serialized Safe Kit representation returned by the API.
 * Guarantees _id is a string and conforms to the Appendix A contract.
 */
export interface SafeKit {
  _id: string;
  userId: string;
  status: GenerationStatus;
  progressMessage?: string;
  errorMessage?: string;
  jd: string;
  source: KitSource;
  company_brief: KitCompanyBrief;
  role: KitRole;
  questions: KitQuestion[];
  flashcards: KitFlashcard[];
  schedule: KitSchedule;
  coverage: KitCoverage;
  createdAt: string;
  updatedAt: string;
}

/**
 * Summary representation for list endpoints (GET /api/v1/kits).
 * Matches docs/API.md summary schema.
 */
export interface SafeKitSummary {
  _id: string;
  company: string;
  role: string;
  status: GenerationStatus;
  createdAt: string;
}

/**
 * Parameters accepted for creating a new Kit.
 */
export interface CreateKitParams {
  userId: string;
  jd: string;
  company_url?: string;
  days?: number;
}

/**
 * Parameters accepted for updating an existing Kit in Phase 4.
 */
export interface UpdateKitParams {
  jd?: string;
  company_url?: string;
  days?: number;
}

/**
 * Converts a MongoDB IKitDocument into a client-safe SafeKit.
 * Strictly cleanses any internal builder metadata to guarantee Appendix A conformance.
 */
export function toSafeKit(doc: IKitDocument): SafeKit {
  return {
    _id: doc._id ? doc._id.toString() : "",
    userId: doc.userId,
    status: doc.status,
    ...(doc.progressMessage ? { progressMessage: doc.progressMessage } : {}),
    ...(doc.errorMessage ? { errorMessage: doc.errorMessage } : {}),
    jd: doc.jd,
    source: doc.source,
    company_brief: sanitizeCompanyBrief(doc.company_brief),
    role: doc.role,
    questions: (doc.questions || []).map(sanitizeQuestion),
    flashcards: (doc.flashcards || []).map(sanitizeFlashcard),
    schedule: doc.schedule,
    coverage: doc.coverage,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/**
 * Converts a MongoDB IKitDocument into a SafeKitSummary for kit listing.
 */
export function toSafeKitSummary(doc: IKitDocument): SafeKitSummary {
  return {
    _id: doc._id ? doc._id.toString() : "",
    company: doc.source?.company || "",
    role: doc.role?.title || doc.source?.role || "",
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
  };
}

// ============================================================================
// Appendix B Batch Evaluator Contract
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
