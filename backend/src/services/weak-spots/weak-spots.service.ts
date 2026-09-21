import { findKitById } from "../../db/kits.js";
import { findPracticeProgress, QuestionPracticeState } from "../../db/practice.js";
import { InternalKitQuestion, KitRequirement } from "../../types/kit.js";
import { isValidObjectId } from "../../utils/validation.js";
import {
  RecommendedQuestionView,
  WeakSpotRequirement,
  WeakSpotsError,
  WeakSpotsReport,
} from "./types.js";

/**
 * Deterministically compares two requirement IDs.
 * Parses numerical values from 'r{N}' (e.g. 'r1' < 'r2' < 'r10')
 * and falls back to standard locale comparison.
 */
export function compareRequirementIds(a: string, b: string): number {
  const matchA = a.match(/^r(\d+)$/i);
  const matchB = b.match(/^r(\d+)$/i);

  if (matchA && matchB) {
    const numA = parseInt(matchA[1], 10);
    const numB = parseInt(matchB[1], 10);
    if (numA !== numB) {
      return numA - numB;
    }
  }

  return a.localeCompare(b);
}

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

/**
 * Deterministic recommendation score for questions:
 * 1. Low confidence (confidence === 1) -> rank 1 (top priority)
 * 2. Unattempted (confidence === null) -> rank 2
 * 3. Medium confidence (confidence === 2) -> rank 3
 * 4. High confidence (confidence === 3) -> rank 4 (lowest priority)
 */
function getQuestionRecommendationRank(confidence: 1 | 2 | 3 | null): number {
  if (confidence === 1) return 1;
  if (confidence === null) return 2;
  if (confidence === 2) return 3;
  if (confidence === 3) return 4;
  return 5;
}

export class WeakSpotsService {
  /**
   * Generates a deterministic Weak Spots analysis for a Kit based on existing
   * practice mode data and requirement mappings.
   *
   * Constraints:
   * - Zero LLM calls.
   * - Zero web crawling.
   * - Zero database mutations (Kit and PracticeProgress remain byte-for-byte unchanged).
   * - 100% deterministic ranking.
   */
  public async generateWeakSpotsReport(
    kitId: string,
    userId: string
  ): Promise<WeakSpotsReport> {
    if (!userId || typeof userId !== "string") {
      throw new WeakSpotsError(
        "Authentication required.",
        "UNAUTHORIZED",
        401
      );
    }

    if (!kitId || !isValidObjectId(kitId)) {
      throw new WeakSpotsError(
        "Invalid Kit ID format.",
        "INVALID_INPUT_PARAMETERS",
        400
      );
    }

    // 1. Load Kit enforcing strict user ownership
    const kit = await findKitById(kitId, userId);
    if (!kit) {
      throw new WeakSpotsError(
        "Kit not found.",
        "KIT_NOT_FOUND",
        404
      );
    }

    const requirements: KitRequirement[] = kit.role?.requirements || [];
    const questions: InternalKitQuestion[] = kit.questions || [];

    // 2. Load existing practice progress
    const practiceProgressDoc = await findPracticeProgress(kitId, userId);
    const practiceMap = new Map<string, QuestionPracticeState>();

    if (practiceProgressDoc?.questionStates) {
      for (const state of practiceProgressDoc.questionStates) {
        practiceMap.set(state.question_id, state);
      }
    }

    // Calculate global stats across all Kit questions
    let totalUnattemptedQuestions = 0;
    let totalLowConfidenceQuestions = 0;

    for (const q of questions) {
      const state = practiceMap.get(q.id);
      const conf = state ? state.confidence : null;
      if (conf === null) {
        totalUnattemptedQuestions++;
      } else if (conf === 1) {
        totalLowConfidenceQuestions++;
      }
    }

    if (requirements.length === 0) {
      return {
        total_requirements: 0,
        covered_requirements: 0,
        weak_requirements: 0,
        unattempted_questions: totalUnattemptedQuestions,
        low_confidence_questions: totalLowConfidenceQuestions,
        strongest_requirements: [],
        weak_spots: [],
      };
    }

    // Build question lookup map
    const questionLookup = new Map<string, InternalKitQuestion>();
    for (const q of questions) {
      questionLookup.set(q.id, q);
    }

    let coveredRequirementsCount = 0;
    const weakSpots: WeakSpotRequirement[] = [];
    const strongCandidates: Array<{ id: string; avg: number; linkedCount: number }> = [];

    // 3. Evaluate each requirement deterministically
    for (const req of requirements) {
      // Find all Kit questions that reference this requirement ID
      const linkedQuestions = questions.filter(
        (q) => Array.isArray(q.requirement_ids) && q.requirement_ids.includes(req.id)
      );

      const linkedCount = linkedQuestions.length;
      if (linkedCount > 0) {
        coveredRequirementsCount++;
      }

      let attemptedCount = 0;
      let unattemptedCount = 0;
      let lowConfidenceCount = 0;
      let mediumConfidenceCount = 0;
      let highConfidenceCount = 0;
      let confidenceSum = 0;

      const recommendedQuestionViews: RecommendedQuestionView[] = [];

      for (const q of linkedQuestions) {
        const state = practiceMap.get(q.id);
        const conf: 1 | 2 | 3 | null = state && state.confidence !== undefined ? state.confidence : null;
        const attempts = state && typeof state.attempts === "number" ? state.attempts : 0;

        if (conf === null) {
          unattemptedCount++;
        } else if (conf === 1) {
          attemptedCount++;
          lowConfidenceCount++;
          confidenceSum += 1;
        } else if (conf === 2) {
          attemptedCount++;
          mediumConfidenceCount++;
          confidenceSum += 2;
        } else if (conf === 3) {
          attemptedCount++;
          highConfidenceCount++;
          confidenceSum += 3;
        }

        recommendedQuestionViews.push({
          id: q.id,
          prompt: q.prompt,
          category: q.category,
          difficulty: q.difficulty,
          confidence: conf,
          attempts,
        });
      }

      const avgConfidence =
        attemptedCount > 0 ? Number((confidenceSum / attemptedCount).toFixed(2)) : null;

      // Deterministic Weak Spot Conditions:
      // Condition A: Zero linked questions
      // Condition B: Unattempted linked questions
      // Condition C: Confidence-1 answers
      // Condition D: Average confidence below 2
      const isZeroLinked = linkedCount === 0;
      const hasUnattempted = unattemptedCount > 0;
      const hasLowConfidence = lowConfidenceCount > 0;
      const isLowAverage = avgConfidence !== null && avgConfidence < 2;

      const isWeakSpot = isZeroLinked || hasUnattempted || hasLowConfidence || isLowAverage;

      if (isWeakSpot) {
        // Construct clear, honest diagnostic reason
        const reasonParts: string[] = [];
        if (isZeroLinked) {
          reasonParts.push("No interview questions are linked to this requirement");
        } else {
          if (hasLowConfidence) {
            reasonParts.push(`${lowConfidenceCount} question(s) marked with low confidence (rating 1)`);
          }
          if (hasUnattempted) {
            reasonParts.push(`${unattemptedCount} linked question(s) unattempted`);
          }
          if (isLowAverage) {
            reasonParts.push(`average confidence (${avgConfidence?.toFixed(1)}) is below 2.0`);
          }
        }

        const reason = reasonParts.join("; ") + ".";

        // Sort recommended questions deterministically:
        // 1. Low confidence (1)
        // 2. Unattempted (null)
        // 3. Medium confidence (2)
        // 4. High confidence (3)
        // 5. Question ID ascending
        recommendedQuestionViews.sort((a, b) => {
          const rankA = getQuestionRecommendationRank(a.confidence);
          const rankB = getQuestionRecommendationRank(b.confidence);
          if (rankA !== rankB) {
            return rankA - rankB;
          }
          return compareQuestionIds(a.id, b.id);
        });

        weakSpots.push({
          requirement_id: req.id,
          requirement_text: req.text,
          priority: req.priority,
          linked_question_count: linkedCount,
          attempted_question_count: attemptedCount,
          unattempted_question_count: unattemptedCount,
          low_confidence_count: lowConfidenceCount,
          medium_confidence_count: mediumConfidenceCount,
          high_confidence_count: highConfidenceCount,
          average_confidence: avgConfidence,
          reason,
          recommended_questions: recommendedQuestionViews,
        });
      } else {
        // Requirement has questions, all attempted, no confidence 1, avg confidence >= 2
        strongCandidates.push({
          id: req.id,
          avg: avgConfidence || 3,
          linkedCount,
        });
      }
    }

    // 4. Sort Weak Spots deterministically by strict priority:
    // 1. MUST requirements before NICE requirements.
    // 2. Requirements with confidence-1 answers.
    // 3. Requirements with unattempted questions.
    // 4. Lower average confidence.
    // 5. Higher number of affected questions.
    // 6. Requirement ID ascending as final tiebreaker.
    weakSpots.sort((a, b) => {
      // 1. MUST before NICE
      if (a.priority === "must" && b.priority !== "must") return -1;
      if (a.priority !== "must" && b.priority === "must") return 1;

      // 2. Confidence-1 presence & count (higher low_confidence_count first)
      const hasLowA = a.low_confidence_count > 0 ? 1 : 0;
      const hasLowB = b.low_confidence_count > 0 ? 1 : 0;
      if (hasLowA !== hasLowB) return hasLowB - hasLowA;
      if (a.low_confidence_count !== b.low_confidence_count) {
        return b.low_confidence_count - a.low_confidence_count;
      }

      // 3. Unattempted presence & count (higher unattempted_count first)
      const hasUnattemptedA = a.unattempted_question_count > 0 ? 1 : 0;
      const hasUnattemptedB = b.unattempted_question_count > 0 ? 1 : 0;
      if (hasUnattemptedA !== hasUnattemptedB) return hasUnattemptedB - hasUnattemptedA;
      if (a.unattempted_question_count !== b.unattempted_question_count) {
        return b.unattempted_question_count - a.unattempted_question_count;
      }

      // 4. Lower average confidence first (null / lowest avg first)
      const avgA = a.average_confidence === null ? 0 : a.average_confidence;
      const avgB = b.average_confidence === null ? 0 : b.average_confidence;
      if (avgA !== avgB) return avgA - avgB;

      // 5. Higher number of affected questions (low + unattempted)
      const affectedA = a.low_confidence_count + a.unattempted_question_count;
      const affectedB = b.low_confidence_count + b.unattempted_question_count;
      if (affectedA !== affectedB) return affectedB - affectedA;

      // 6. Final tie-breaker: requirement ID ascending (r1, r2, r3...)
      return compareRequirementIds(a.requirement_id, b.requirement_id);
    });

    // 5. Sort strongest requirements deterministically
    strongCandidates.sort((a, b) => {
      if (b.avg !== a.avg) return b.avg - a.avg;
      if (b.linkedCount !== a.linkedCount) return b.linkedCount - a.linkedCount;
      return compareRequirementIds(a.id, b.id);
    });

    const strongestRequirementIds = strongCandidates.map((c) => c.id);

    return {
      total_requirements: requirements.length,
      covered_requirements: coveredRequirementsCount,
      weak_requirements: weakSpots.length,
      unattempted_questions: totalUnattemptedQuestions,
      low_confidence_questions: totalLowConfidenceQuestions,
      strongest_requirements: strongestRequirementIds,
      weak_spots: weakSpots,
    };
  }
}

export const weakSpotsService = new WeakSpotsService();
