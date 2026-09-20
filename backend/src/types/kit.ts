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

  // Strict Appendix A Structure Fields
  source: KitSource;
  company_brief: KitCompanyBrief;
  role: KitRole;
  questions: KitQuestion[];
  flashcards: KitFlashcard[];
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
    company_brief: doc.company_brief,
    role: doc.role,
    questions: doc.questions || [],
    flashcards: doc.flashcards || [],
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
