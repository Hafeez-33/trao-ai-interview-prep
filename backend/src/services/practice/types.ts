import { QuestionCategory, QuestionDifficulty } from "../../types/kit.js";

export type PracticeConfidenceLevel = 1 | 2 | 3;

export interface PracticeQuestionView {
  id: string;
  requirement_ids: string[];
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: QuestionDifficulty;
}

export interface PracticeStateResponse {
  kit_id: string;
  total_questions: number;
  attempted_questions: number;
  completed_questions: number;
  completed: boolean;
  current_question_id: string | null;
  next_question: PracticeQuestionView | null;
}

export class PracticeError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code:
      | "INVALID_INPUT_PARAMETERS"
      | "UNAUTHORIZED"
      | "KIT_NOT_FOUND"
      | "QUESTION_NOT_FOUND"
      | "PRACTICE_COMPLETED"
      | "PRACTICE_OPERATION_FAILED",
    status: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "PracticeError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
