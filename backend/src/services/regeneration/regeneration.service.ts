import {
  findKitById,
  updateKitStatus,
  updateKitRegenerationResult,
  restoreKitOnFailedRegeneration,
} from "../../db/kits.js";
import {
  InternalKitQuestion,
  InternalKitFlashcard,
  KitCoverage,
  KitSchedule,
  KitCompanyBrief,
  IKitDocument,
  toSafeKit,
} from "../../types/kit.js";
import { generationService } from "../generation/index.js";
import { coverageService } from "../coverage/index.js";
import { scheduleService } from "../schedule/index.js";
import { kitValidationService } from "../validation/index.js";
import { researchService } from "../research/index.js";
import { RegenerateKitParams, RegenerateResult, RegenerationError } from "./types.js";

const VALID_TARGETS = new Set(["questions", "flashcards", "company_brief", "all"]);
const VALID_CATEGORIES = new Set(["technical", "behavioural", "system-design", "company-fit"]);

export class RegenerationService {
  /**
   * Controlled regeneration while preserving all user-owned content.
   */
  public async regenerate(
    kitId: string,
    userId: string,
    params: RegenerateKitParams = {}
  ): Promise<RegenerateResult> {
    const target = params.target || "all";
    const category = params.category;

    // 1. Validate Scope Parameters
    if (!VALID_TARGETS.has(target)) {
      throw new RegenerationError(
        `Invalid regeneration target: '${target}'. Allowed targets: questions, flashcards, company_brief, all.`,
        "INVALID_INPUT_PARAMETERS",
        400
      );
    }

    if (category !== undefined) {
      if (!VALID_CATEGORIES.has(category)) {
        throw new RegenerationError(
          `Invalid question category: '${category}'. Allowed categories: technical, behavioural, system-design, company-fit.`,
          "INVALID_INPUT_PARAMETERS",
          400
        );
      }
      if (target !== "questions" && target !== "all") {
        throw new RegenerationError(
          `Category filter '${category}' is only applicable when target is 'questions' or 'all'.`,
          "INVALID_INPUT_PARAMETERS",
          400
        );
      }
    }

    // 2. Load Existing Kit & Verify Ownership
    const kit = await findKitById(kitId, userId);
    if (!kit) {
      throw new RegenerationError("Kit not found.", "KIT_NOT_FOUND", 404);
    }

    // 3. Concurrency Protection
    if (kit.status === "generating" || kit.status === "crawling") {
      throw new RegenerationError(
        "Kit is currently undergoing generation or crawling. Please wait until it completes.",
        "CONCURRENT_OPERATION",
        409
      );
    }

    const requirements = kit.role?.requirements || [];
    if (requirements.length === 0) {
      throw new RegenerationError(
        "Kit has no extracted requirements. Run /extract first.",
        "INVALID_INPUT_PARAMETERS",
        400
      );
    }

    // 4. In-Memory Snapshot of Previous Valid State (Failure Safety)
    const previousState = {
      questions: [...(kit.questions || [])],
      flashcards: [...(kit.flashcards || [])],
      coverage: kit.coverage
        ? {
            uncovered_requirement_ids: [...(kit.coverage.uncovered_requirement_ids || [])],
            passes: kit.coverage.passes || 0,
          }
        : { uncovered_requirement_ids: [], passes: 0 },
      schedule: kit.schedule
        ? {
            days_available: kit.schedule.days_available || 5,
            days: [...(kit.schedule.days || [])],
          }
        : { days_available: 5, days: [] },
      company_brief: kit.company_brief
        ? {
            summary: kit.company_brief.summary || "",
            what_they_do: kit.company_brief.what_they_do || "",
            sources: [...(kit.company_brief.sources || [])],
            is_edited: kit.company_brief.is_edited,
          }
        : { summary: "", what_they_do: "", sources: [] },
    };

    // 5. Transition status to "generating"
    await updateKitStatus(kitId, userId, "generating");

    try {
      // 6. Partition Content & Determine What Needs Regeneration
      let candidateBrief: KitCompanyBrief = { ...previousState.company_brief };

      // Regenerate company brief if requested and NOT protected
      if (target === "company_brief" || target === "all") {
        const isBriefProtected = kit.company_brief?.is_edited === true;
        if (!isBriefProtected && kit.crawled_pages && kit.crawled_pages.length > 0 && kit.source?.company_url) {
          const researchResult = await researchService.performResearch({
            jd: kit.jd || "",
            companyUrl: kit.source.company_url,
            pages: kit.crawled_pages,
            companyHint: kit.source.company || "",
          });
          candidateBrief = {
            summary: researchResult.companyBrief.summary,
            what_they_do: researchResult.companyBrief.what_they_do,
            sources: researchResult.companyBrief.sources,
            is_edited: false,
          };
        }
      }

      // Partition Questions
      const existingQuestions = kit.questions || [];
      const isQuestionProtected = (q: InternalKitQuestion): boolean =>
        q.is_custom === true || q.is_edited === true || q.is_pinned === true;

      let preservedQuestions: InternalKitQuestion[] = [];
      const questionsNeedRegeneration = target === "questions" || target === "all";

      if (!questionsNeedRegeneration) {
        preservedQuestions = [...existingQuestions];
      } else if (category) {
        // Specific category regeneration:
        // Questions outside the category are completely preserved
        const otherCategoryQuestions = existingQuestions.filter((q) => q.category !== category);
        // Questions inside the category: only protected ones are preserved
        const protectedCategoryQuestions = existingQuestions.filter(
          (q) => q.category === category && isQuestionProtected(q)
        );
        preservedQuestions = [...otherCategoryQuestions, ...protectedCategoryQuestions];
      } else {
        // Full question regeneration: only protected questions are preserved
        preservedQuestions = existingQuestions.filter(isQuestionProtected);
      }

      // Partition Flashcards
      const existingFlashcards = kit.flashcards || [];
      const isFlashcardProtected = (f: InternalKitFlashcard): boolean =>
        f.is_custom === true || f.is_edited === true;

      let preservedFlashcards: InternalKitFlashcard[] = [];
      const flashcardsNeedRegeneration = target === "flashcards" || target === "all";

      if (!flashcardsNeedRegeneration) {
        preservedFlashcards = [...existingFlashcards];
      } else {
        // Only protected flashcards are preserved
        preservedFlashcards = existingFlashcards.filter(isFlashcardProtected);
      }

      // 7. Generate Replacement Content via LLM
      let generatedNewQuestions: InternalKitQuestion[] = [];
      let generatedNewFlashcards: InternalKitFlashcard[] = [];

      if (questionsNeedRegeneration || flashcardsNeedRegeneration) {
        const genResult = await generationService.generateKitContent({
          jd: kit.jd || "",
          requirements,
          companyBrief: candidateBrief,
          interviewResearch: kit.interview_research,
          // Pass empty array so generationService returns fresh candidates without double-merging
          existingQuestions: [],
          existingFlashcards: [],
        });

        if (questionsNeedRegeneration) {
          if (category) {
            // Keep only new questions that match the target category
            generatedNewQuestions = genResult.questions.filter((q) => q.category === category);
          } else {
            generatedNewQuestions = genResult.questions;
          }
        }

        if (flashcardsNeedRegeneration) {
          generatedNewFlashcards = genResult.flashcards;
        }
      }

      // 8. Combine preserved content + new replacement content & Reassign Sequential Deterministic IDs
      const rawCombinedQuestions = [...preservedQuestions, ...generatedNewQuestions];
      const validReqIds = new Set(requirements.map((r) => r.id));
      const fallbackReqId = requirements[0].id;

      let qCounter = 1;
      const finalQuestions: InternalKitQuestion[] = rawCombinedQuestions.map((q) => {
        // Validate requirement references
        const validIds = (q.requirement_ids || []).filter((id) => validReqIds.has(id));
        const finalIds = validIds.length > 0 ? validIds : [fallbackReqId];

        return {
          ...q,
          id: `q${qCounter++}`,
          requirement_ids: finalIds,
        };
      });

      const rawCombinedFlashcards = [...preservedFlashcards, ...generatedNewFlashcards];
      let fCounter = 1;
      const finalFlashcards: InternalKitFlashcard[] = rawCombinedFlashcards.map((f) => {
        const validIds = (f.requirement_ids || []).filter((id) => validReqIds.has(id));
        const finalIds = validIds.length > 0 ? validIds : [fallbackReqId];

        return {
          ...f,
          id: `f${fCounter++}`,
          requirement_ids: finalIds,
        };
      });

      // 9. Recalculate Coverage (Phase 9 Deterministic Engine + Targeted Pass 2 if needed)
      let finalCoverage: KitCoverage;
      let coverageQuestions = finalQuestions;

      const pass1 = coverageService.calculateCoverage(requirements, coverageQuestions, 1);
      if (pass1.uncovered_requirement_ids.length === 0) {
        finalCoverage = {
          uncovered_requirement_ids: [],
          passes: 1,
        };
      } else {
        // Targeted pass 2 for missing requirements
        const secondPass = await coverageService.runSecondPass({
          jd: kit.jd || "",
          requirements,
          existingQuestions: coverageQuestions,
          companyBrief: candidateBrief,
          interviewResearch: kit.interview_research,
        });
        coverageQuestions = secondPass.questions;
        finalCoverage = {
          uncovered_requirement_ids: secondPass.uncovered_requirement_ids,
          passes: 2,
        };
      }

      // 10. Recalculate Schedule (Phase 10 Deterministic Engine)
      const daysCount = kit.schedule?.days_available || 5;
      const finalSchedule = scheduleService.generateSchedule({
        requirements,
        questions: coverageQuestions,
        days: daysCount,
      });

      // 11. Validate Final Kit (Phase 11 Deterministic Validation Engine)
      const candidateKitDoc: IKitDocument = {
        ...kit,
        company_brief: candidateBrief,
        questions: coverageQuestions,
        flashcards: finalFlashcards,
        coverage: finalCoverage,
        schedule: finalSchedule,
        status: "completed",
        updatedAt: new Date(),
      };

      const validation = kitValidationService.validateKit(candidateKitDoc, {
        rawJd: kit.jd,
        crawledPages: kit.crawled_pages,
      });

      if (!validation.valid && validation.errors.length > 0) {
        throw new RegenerationError(
          `Validation failed after regeneration: ${validation.errors[0].message}`,
          "SCHEMA_VALIDATION_ERROR",
          500,
          validation.errors
        );
      }

      // 12. Persist Validated Result in MongoDB with Ownership Enforcement
      const updatedKit = await updateKitRegenerationResult(kitId, userId, {
        questions: coverageQuestions,
        flashcards: finalFlashcards,
        coverage: finalCoverage,
        schedule: finalSchedule,
        company_brief: candidateBrief,
        status: "completed",
      });

      if (!updatedKit) {
        throw new RegenerationError("Failed to update kit document.", "KIT_NOT_FOUND", 404);
      }

      return {
        success: true,
        kit: toSafeKit(updatedKit),
      };
    } catch (err: unknown) {
      // Failure Safety: Revert to previous valid state & mark status as "failed"
      const errorMessage = err instanceof Error ? err.message : "Regeneration failed";
      await restoreKitOnFailedRegeneration(kitId, userId, previousState, errorMessage);

      if (err instanceof RegenerationError) {
        throw err;
      }
      throw new RegenerationError(errorMessage, "REGENERATION_FAILED", 500);
    }
  }
}

export const regenerationService = new RegenerationService();
