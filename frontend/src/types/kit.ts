/**
 * Frontend Kit Contract Types
 * Source of truth: shared/contracts/kit.schema.ts
 *
 * Exposes only public SafeKit / Appendix A data structures.
 * Internal persistence metadata (userId, MongoDB internals, crawled_pages,
 * is_custom, is_edited, is_pinned, order) are strictly excluded.
 */

import type {
  RequirementKind,
  RequirementPriority,
  QuestionCategory,
  QuestionDifficulty,
  GenerationStatus,
  PracticeConfidence,
  KitSource,
  KitCompanyBrief,
  KitRequirement,
  KitRole,
  KitQuestion,
  KitFlashcard,
  KitScheduleDay,
  KitSchedule,
  KitCoverage,
  KitStructure,
} from "@shared/contracts/kit.schema.js";

export type {
  RequirementKind,
  RequirementPriority,
  QuestionCategory,
  QuestionDifficulty,
  GenerationStatus,
  PracticeConfidence,
  KitSource,
  KitCompanyBrief,
  KitRequirement,
  KitRole,
  KitQuestion,
  KitFlashcard,
  KitScheduleDay,
  KitSchedule,
  KitCoverage,
  KitStructure,
};

/**
 * Public SafeKit envelope returned by the API (e.g. GET /api/v1/kits/:id).
 * Conforms strictly to Appendix A with public envelope identifiers.
 */
export interface SafeKit extends KitStructure {
  _id: string;
  status: GenerationStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Public summary representation for kit listings (GET /api/v1/kits).
 */
export interface SafeKitSummary {
  _id: string;
  company: string;
  role: string;
  status: GenerationStatus;
  createdAt: string;
}
