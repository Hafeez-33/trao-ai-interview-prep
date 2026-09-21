import { QuestionCategory, QuestionDifficulty } from "./kit.js";

export interface RecommendedQuestionView {
  id: string;
  prompt: string;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  confidence: 1 | 2 | 3 | null;
  attempts: number;
}

export interface WeakSpotRequirement {
  requirement_id: string;
  requirement_text: string;
  priority: "must" | "nice";
  linked_question_count: number;
  attempted_question_count: number;
  unattempted_question_count: number;
  low_confidence_count: number;
  medium_confidence_count: number;
  high_confidence_count: number;
  average_confidence: number | null;
  reason: string;
  recommended_questions: RecommendedQuestionView[];
}

export interface WeakSpotsReport {
  total_requirements: number;
  covered_requirements: number;
  weak_requirements: number;
  unattempted_questions: number;
  low_confidence_questions: number;
  strongest_requirements: string[];
  weak_spots: WeakSpotRequirement[];
}

export interface WeakSpotsResponse {
  success: boolean;
  report: WeakSpotsReport;
}
