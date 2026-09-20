import {
  KitSchedule,
  KitScheduleDay,
  KitRequirement,
  KitQuestion,
  InternalKitQuestion,
  QuestionCategory,
} from "../../types/kit.js";
import { ScheduleGenerationParams, ScheduleError } from "./types.js";

/**
 * Minute durations mapped deterministically from question difficulty.
 * Difficulty 1 = 15 minutes
 * Difficulty 2 = 25 minutes
 * Difficulty 3 = 45 minutes
 */
const DIFFICULTY_MINUTES: Record<number, number> = {
  1: 15,
  2: 25,
  3: 45,
};

/**
 * Positive integer minutes allocated for review / practice on days with no new questions.
 */
const REVIEW_DAY_MINUTES = 30;

export class ScheduleService {
  /**
   * Generates a deterministic interview preparation schedule.
   *
   * Rules:
   * 1. Days available must be an integer between 1 and 60.
   * 2. Exactly `days` entries are created with sequential numbers 1..N.
   * 3. Every "must" requirement must be covered by at least one scheduled question.
   * 4. Questions are prioritized deterministically: Must requirements first, higher difficulty first.
   * 5. Minutes are positive integers derived from difficulty.
   * 6. Focus strings are derived deterministically from the day's question categories.
   * 7. No LLM calls.
   */
  public generateSchedule(params: ScheduleGenerationParams): KitSchedule {
    const { requirements, questions, days } = params;

    // 1. Validate days
    if (
      typeof days !== "number" ||
      !Number.isInteger(days) ||
      days < 1 ||
      days > 60
    ) {
      throw new ScheduleError(
        `Invalid preparation days: ${days}. Must be an integer between 1 and 60.`,
        "INVALID_INPUT_PARAMETERS",
        400
      );
    }

    // 2. Validate requirements
    if (!requirements || !Array.isArray(requirements) || requirements.length === 0) {
      throw new ScheduleError(
        "Cannot generate schedule without requirements.",
        "INVALID_INPUT_PARAMETERS",
        400
      );
    }

    // 3. Validate questions
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      throw new ScheduleError(
        "Cannot generate schedule without interview questions. Run /generate first.",
        "INVALID_INPUT_PARAMETERS",
        400
      );
    }

    // 4. Index valid requirements and must-have requirements
    const validReqIds = new Set(requirements.map((r) => r.id));
    const mustReqIds = new Set(
      requirements.filter((r) => r.priority === "must").map((r) => r.id)
    );

    // 5. Must-Requirement Guarantee:
    // Check that every requirement with priority === "must" is referenced by at least one question
    const coveredMustReqIds = new Set<string>();
    const validQuestions: (KitQuestion | InternalKitQuestion)[] = [];

    for (const q of questions) {
      if (!q || !q.id) continue;

      const rawReqIds = Array.isArray(q.requirement_ids) ? q.requirement_ids : [];
      const qValidReqs = rawReqIds.filter((id) => typeof id === "string" && validReqIds.has(id.trim()));

      for (const reqId of qValidReqs) {
        if (mustReqIds.has(reqId)) {
          coveredMustReqIds.add(reqId);
        }
      }

      validQuestions.push(q);
    }

    // Check if any must requirement is uncovered
    const uncoveredMustIds: string[] = [];
    for (const mustId of mustReqIds) {
      if (!coveredMustReqIds.has(mustId)) {
        uncoveredMustIds.push(mustId);
      }
    }

    if (uncoveredMustIds.length > 0) {
      throw new ScheduleError(
        `Cannot generate schedule: must-have requirement '${uncoveredMustIds[0]}' has no associated interview questions.`,
        "UNCOVERED_MUST_REQUIREMENTS",
        400,
        { uncovered_must_requirement_ids: uncoveredMustIds }
      );
    }

    // 6. Deterministic Question Prioritization
    // Primary ordering:
    // a. Questions connected to "must" requirements before "nice" requirements
    // b. Higher difficulty before lower difficulty (3 > 2 > 1)
    // c. More valid requirements covered before fewer
    // d. Stable deterministic tie-breaker: question ID order (q1, q2...)
    const sortedQuestions = [...validQuestions].sort((a, b) => {
      const aReqs = (a.requirement_ids || []).filter((id) => validReqIds.has(id));
      const bReqs = (b.requirement_ids || []).filter((id) => validReqIds.has(id));

      const aHasMust = aReqs.some((id) => mustReqIds.has(id));
      const bHasMust = bReqs.some((id) => mustReqIds.has(id));

      // 1. Must before Nice
      if (aHasMust !== bHasMust) {
        return aHasMust ? -1 : 1;
      }

      // 2. Higher difficulty first (3 > 2 > 1)
      const aDiff = a.difficulty || 2;
      const bDiff = b.difficulty || 2;
      if (aDiff !== bDiff) {
        return bDiff - aDiff;
      }

      // 3. Count of valid requirements covered
      if (aReqs.length !== bReqs.length) {
        return bReqs.length - aReqs.length;
      }

      // 4. Stable tie-breaker: question ID numeric or lexical
      const aNum = parseInt(a.id.replace(/\D/g, ""), 10);
      const bNum = parseInt(b.id.replace(/\D/g, ""), 10);
      if (!isNaN(aNum) && !isNaN(bNum) && aNum !== bNum) {
        return aNum - bNum;
      }

      return a.id.localeCompare(b.id);
    });

    // 7. Day Distribution
    // Distribute sorted questions across exactly `days` buckets
    const Q = sortedQuestions.length;
    const scheduleDays: KitScheduleDay[] = [];

    if (Q >= days) {
      // Chunk distribution
      const baseCount = Math.floor(Q / days);
      const remainder = Q % days;

      let currentIndex = 0;
      for (let dayNum = 1; dayNum <= days; dayNum++) {
        // First `remainder` days get baseCount + 1, remaining days get baseCount
        const countForDay = dayNum <= remainder ? baseCount + 1 : baseCount;
        const dayQuestions = sortedQuestions.slice(currentIndex, currentIndex + countForDay);
        currentIndex += countForDay;

        const questionIds = dayQuestions.map((q) => q.id);
        const minutes = this.calculateMinutes(dayQuestions);
        const focus = this.determineFocus(dayQuestions);

        scheduleDays.push({
          day: dayNum,
          focus,
          question_ids: questionIds,
          minutes,
        });
      }
    } else {
      // Q < days: each question gets its own day first, remaining days are review/consolidation
      for (let dayNum = 1; dayNum <= days; dayNum++) {
        if (dayNum <= Q) {
          const q = sortedQuestions[dayNum - 1];
          const dayQuestions = [q];
          scheduleDays.push({
            day: dayNum,
            focus: this.determineFocus(dayQuestions),
            question_ids: [q.id],
            minutes: this.calculateMinutes(dayQuestions),
          });
        } else {
          // Review / consolidation day
          scheduleDays.push({
            day: dayNum,
            focus: "Review, Mock Practice & Consolidation",
            question_ids: [],
            minutes: REVIEW_DAY_MINUTES,
          });
        }
      }
    }

    return {
      days_available: days,
      days: scheduleDays,
    };
  }

  /**
   * Calculates total integer minutes for a set of questions based on difficulty.
   */
  private calculateMinutes(questions: (KitQuestion | InternalKitQuestion)[]): number {
    if (questions.length === 0) {
      return REVIEW_DAY_MINUTES;
    }

    let total = 0;
    for (const q of questions) {
      const diff = q.difficulty || 2;
      total += DIFFICULTY_MINUTES[diff] || 25;
    }

    return total;
  }

  /**
   * Deterministically determines the daily focus title based on the questions' categories.
   */
  private determineFocus(questions: (KitQuestion | InternalKitQuestion)[]): string {
    if (questions.length === 0) {
      return "Review, Mock Practice & Consolidation";
    }

    const categories = new Set<QuestionCategory>();
    for (const q of questions) {
      if (q.category) {
        categories.add(q.category);
      }
    }

    const hasTech = categories.has("technical");
    const hasSys = categories.has("system-design");
    const hasBehav = categories.has("behavioural");
    const hasFit = categories.has("company-fit");

    // Specific category combinations
    if (hasTech && hasSys && !hasBehav && !hasFit) {
      return "Technical Architecture & Core Systems";
    }
    if (hasBehav && hasFit && !hasTech && !hasSys) {
      return "Behavioural, Leadership & Culture Fit";
    }
    if (hasTech && hasBehav && !hasSys && !hasFit) {
      return "Technical & Behavioural Competencies";
    }

    // Single category
    if (categories.size === 1) {
      if (hasTech) return "Technical Deep Dive & Coding";
      if (hasSys) return "System Design & Architecture";
      if (hasBehav) return "Behavioural & Leadership Questions";
      if (hasFit) return "Company Fit & Culture Alignment";
    }

    // Multiple or general
    if (hasTech || hasSys) {
      return "Core Technical Systems & Interview Practice";
    }

    return "Comprehensive Interview Preparation & Review";
  }
}

export const scheduleService = new ScheduleService();
