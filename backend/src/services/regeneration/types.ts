import {
  QuestionCategory,
  SafeKit,
} from "../../types/kit.js";

export type RegenerateTarget = "questions" | "flashcards" | "company_brief" | "all";

export interface RegenerateKitParams {
  target?: RegenerateTarget;
  category?: QuestionCategory;
}

export interface RegenerateResult {
  success: boolean;
  kit: SafeKit;
}

export class RegenerationError extends Error {
  public code: string;
  public status: number;
  public details?: unknown;

  constructor(message: string, code = "REGENERATION_FAILED", status = 500, details?: unknown) {
    super(message);
    this.name = "RegenerationError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
