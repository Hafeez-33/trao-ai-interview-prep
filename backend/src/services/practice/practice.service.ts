import { findKitById } from "../../db/kits.js";
import {
  findPracticeProgress,
  createPracticeProgress,
  updatePracticeProgress,
  resetPracticeProgress,
  QuestionPracticeState,
} from "../../db/practice.js";
import { InternalKitQuestion } from "../../types/kit.js";
import { isValidObjectId } from "../../utils/validation.js";
import {
  PracticeConfidenceLevel,
  PracticeError,
  PracticeQuestionView,
  PracticeStateResponse,
} from "./types.js";

/**
 * Deterministically compares two question IDs.
 * Parses numerical values from 'q{N}' (e.g. 'q1' < 'q2' < 'q10')
 * and falls back to standard locale comparison.
 */
export function compareQuestionIds(a: string, b: string): number {
  const matchA = a.match(/^q(\d+)$/i);
  const matchB = b.match(/^q(\d+)$/i);

  if (matchA && matchB) {
    const numA = parseInt(matchA[1], 10);
    const numB = parseInt(matchB[1], 10);
    if (numA !== numB) {
      return numA - numB;
    }
  }

  return a.localeCompare(b);
}

export class PracticeService {
  /**
   * Sanitizes an internal kit question into a clean public practice question view.
   * Strips all internal builder flags (is_custom, is_edited, is_pinned, order).
   */
  private toPracticeQuestionView(q: InternalKitQuestion): PracticeQuestionView {
    return {
      id: q.id,
      requirement_ids: q.requirement_ids || [],
      category: q.category,
      prompt: q.prompt,
      answer_outline: q.answer_outline,
      difficulty: q.difficulty,
    };
  }

  /**
   * Determines priority score for a question based on its confidence rating:
   * - Unattempted (null) -> 0 (highest priority)
   * - Confidence 1 (Low) -> 1
   * - Confidence 2 (Medium) -> 2
   * - Confidence 3 (High) -> 3 (lowest priority)
   */
  private getConfidencePriority(confidence: PracticeConfidenceLevel | null): number {
    if (confidence === null || confidence === undefined) {
      return 0;
    }
    return confidence; // 1, 2, or 3
  }

  /**
   * Selects the next question to practice based on deterministic prioritization:
   * 1. Unattempted questions first (confidence === null)
   * 2. Among practiced questions: confidence 1 first, then confidence 2, then confidence 3
   * 3. Deterministic tie-breaker: question ID order (q1, q2, q3...)
   * 4. Never use question text for prioritization
   * 5. If all questions have non-null confidence, practice is completed -> returns null
   */
  public selectNextQuestion(
    questionStates: QuestionPracticeState[],
    kitQuestions: InternalKitQuestion[]
  ): InternalKitQuestion | null {
    if (kitQuestions.length === 0) {
      return null;
    }

    const questionMap = new Map<string, InternalKitQuestion>();
    for (const q of kitQuestions) {
      questionMap.set(q.id, q);
    }

    // Filter states to only questions currently present in the kit
    const validStates = questionStates.filter((s) => questionMap.has(s.question_id));

    // If every question has a recorded confidence, practice is completed
    const allCompleted =
      validStates.length > 0 &&
      validStates.every((s) => s.confidence !== null && s.confidence !== undefined);

    if (allCompleted) {
      return null;
    }

    // Sort candidate states deterministically
    const sortedStates = [...validStates].sort((a, b) => {
      const priorityA = this.getConfidencePriority(a.confidence);
      const priorityB = this.getConfidencePriority(b.confidence);

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      return compareQuestionIds(a.question_id, b.question_id);
    });

    if (sortedStates.length === 0) {
      return null;
    }

    const nextId = sortedStates[0].question_id;
    return questionMap.get(nextId) || null;
  }

  /**
   * Synchronizes practice progress question states with current kit questions.
   * Preserves existing confidence and attempt counts, adds newly introduced questions,
   * and drops questions no longer in the kit.
   */
  private synchronizeQuestionStates(
    existingStates: QuestionPracticeState[],
    kitQuestions: InternalKitQuestion[]
  ): QuestionPracticeState[] {
    const kitQuestionIdSet = new Set(kitQuestions.map((q) => q.id));
    const stateMap = new Map<string, QuestionPracticeState>();

    for (const s of existingStates) {
      if (kitQuestionIdSet.has(s.question_id)) {
        stateMap.set(s.question_id, s);
      }
    }

    return kitQuestions.map((q) => {
      const existing = stateMap.get(q.id);
      if (existing) {
        return existing;
      }
      return {
        question_id: q.id,
        confidence: null,
        attempts: 0,
      };
    });
  }

  /**
   * Gets or creates practice state for a given kit and authenticated user.
   */
  public async getOrCreatePracticeState(
    kitId: string,
    userId: string
  ): Promise<PracticeStateResponse> {
    if (!isValidObjectId(kitId)) {
      throw new PracticeError("Invalid Kit ID format.", "INVALID_INPUT_PARAMETERS", 400);
    }

    const kit = await findKitById(kitId, userId);
    if (!kit) {
      throw new PracticeError("Kit not found.", "KIT_NOT_FOUND", 404);
    }

    const kitQuestions = kit.questions || [];
    const questionIds = kitQuestions.map((q) => q.id);

    let progress = await findPracticeProgress(kitId, userId);

    if (!progress) {
      progress = await createPracticeProgress(kitId, userId, questionIds);
    } else {
      // Synchronize states in case kit questions were edited/added/removed
      const currentStates = progress.questionStates;
      const synchronized = this.synchronizeQuestionStates(currentStates, kitQuestions);
      const statesChanged =
        synchronized.length !== currentStates.length ||
        synchronized.some((s, idx) => s.question_id !== currentStates[idx]?.question_id);

      if (statesChanged) {
        const updated = await updatePracticeProgress(kitId, userId, {
          questionStates: synchronized,
        });
        progress = updated || {
          ...progress,
          questionStates: synchronized,
        };
      }
    }

    const states = progress.questionStates;
    const totalQuestions = kitQuestions.length;
    const attemptedQuestions = states.filter((s) => s.attempts > 0).length;
    const completedQuestions = states.filter(
      (s) => s.confidence !== null && s.confidence !== undefined
    ).length;

    const isCompleted = totalQuestions > 0 && completedQuestions === totalQuestions;
    const nextQuestion = isCompleted ? null : this.selectNextQuestion(states, kitQuestions);

    return {
      kit_id: kitId,
      total_questions: totalQuestions,
      attempted_questions: attemptedQuestions,
      completed_questions: completedQuestions,
      completed: isCompleted,
      current_question_id: nextQuestion ? nextQuestion.id : null,
      next_question: nextQuestion ? this.toPracticeQuestionView(nextQuestion) : null,
    };
  }

  /**
   * Records confidence for a specific question.
   * Increments attempts, updates timestamp, updates confidence,
   * updates completion status, and deterministically computes the next question.
   */
  public async recordConfidence(
    kitId: string,
    userId: string,
    questionId: string,
    confidence: unknown
  ): Promise<PracticeStateResponse> {
    if (!isValidObjectId(kitId)) {
      throw new PracticeError("Invalid Kit ID format.", "INVALID_INPUT_PARAMETERS", 400);
    }

    if (
      typeof confidence !== "number" ||
      !Number.isInteger(confidence) ||
      confidence < 1 ||
      confidence > 3
    ) {
      throw new PracticeError(
        "Invalid confidence level. Allowed values: 1 (Low), 2 (Medium), 3 (High).",
        "INVALID_INPUT_PARAMETERS",
        400
      );
    }

    const confLevel = confidence as PracticeConfidenceLevel;

    const kit = await findKitById(kitId, userId);
    if (!kit) {
      throw new PracticeError("Kit not found.", "KIT_NOT_FOUND", 404);
    }

    const kitQuestions = kit.questions || [];
    const targetQuestion = kitQuestions.find((q) => q.id === questionId);

    if (!targetQuestion) {
      throw new PracticeError(
        `Question with ID '${questionId}' not found in this kit.`,
        "QUESTION_NOT_FOUND",
        404
      );
    }

    // Ensure progress exists
    let progress = await findPracticeProgress(kitId, userId);
    if (!progress) {
      const questionIds = kitQuestions.map((q) => q.id);
      progress = await createPracticeProgress(kitId, userId, questionIds);
    }

    const synchronized = this.synchronizeQuestionStates(progress.questionStates, kitQuestions);
    const now = new Date();

    const updatedStates: QuestionPracticeState[] = synchronized.map((s) => {
      if (s.question_id === questionId) {
        return {
          ...s,
          confidence: confLevel,
          attempts: (s.attempts || 0) + 1,
          lastPracticedAt: now.toISOString(),
        };
      }
      return s;
    });

    const totalQuestions = kitQuestions.length;
    const attemptedQuestions = updatedStates.filter((s) => s.attempts > 0).length;
    const completedQuestions = updatedStates.filter(
      (s) => s.confidence !== null && s.confidence !== undefined
    ).length;

    const isCompleted = totalQuestions > 0 && completedQuestions === totalQuestions;
    const nextQuestion = isCompleted ? null : this.selectNextQuestion(updatedStates, kitQuestions);

    await updatePracticeProgress(kitId, userId, {
      questionStates: updatedStates,
      currentQuestionId: nextQuestion ? nextQuestion.id : null,
      completed: isCompleted,
      lastPracticedAt: now,
    });

    return {
      kit_id: kitId,
      total_questions: totalQuestions,
      attempted_questions: attemptedQuestions,
      completed_questions: completedQuestions,
      completed: isCompleted,
      current_question_id: nextQuestion ? nextQuestion.id : null,
      next_question: nextQuestion ? this.toPracticeQuestionView(nextQuestion) : null,
    };
  }

  /**
   * Resets practice progress for a given kit and user.
   * Clears confidence ratings, resets attempts to 0, sets completed to false,
   * and returns the user to the first deterministic question (q1).
   */
  public async resetPractice(
    kitId: string,
    userId: string
  ): Promise<PracticeStateResponse> {
    if (!isValidObjectId(kitId)) {
      throw new PracticeError("Invalid Kit ID format.", "INVALID_INPUT_PARAMETERS", 400);
    }

    const kit = await findKitById(kitId, userId);
    if (!kit) {
      throw new PracticeError("Kit not found.", "KIT_NOT_FOUND", 404);
    }

    const kitQuestions = kit.questions || [];
    const questionIds = kitQuestions.map((q) => q.id);

    // Reset progress in database
    await resetPracticeProgress(kitId, userId, questionIds);

    const initialStates: QuestionPracticeState[] = questionIds.map((qId) => ({
      question_id: qId,
      confidence: null,
      attempts: 0,
    }));

    const nextQuestion = this.selectNextQuestion(initialStates, kitQuestions);

    return {
      kit_id: kitId,
      total_questions: kitQuestions.length,
      attempted_questions: 0,
      completed_questions: 0,
      completed: false,
      current_question_id: nextQuestion ? nextQuestion.id : null,
      next_question: nextQuestion ? this.toPracticeQuestionView(nextQuestion) : null,
    };
  }
}

export const practiceService = new PracticeService();
