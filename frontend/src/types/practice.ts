import type { QuestionCategory, QuestionDifficulty } from "./kit.js";

export type PracticeConfidenceLevel = 1 | 2 | 3;

export interface PracticeQuestionView {
  id: string;
  requirement_ids: string[];
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: QuestionDifficulty;
}

export interface PracticeState {
  kit_id: string;
  total_questions: number;
  attempted_questions: number;
  completed_questions: number;
  completed: boolean;
  current_question_id: string | null;
  next_question: PracticeQuestionView | null;
}

export interface PracticeResponse {
  success: boolean;
  practice: PracticeState;
}
