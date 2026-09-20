import {
  KitRequirement,
  KitCompanyBrief,
  QuestionCategory,
  QuestionDifficulty,
  InternalKitQuestion,
  KitQuestion,
} from "../../types/kit.js";
import { InterviewResearch } from "../research/types.js";
import { getLlmProvider, ILlmProvider, LlmError } from "../llm/index.js";
import {
  COVERAGE_SECOND_PASS_SYSTEM_PROMPT,
  buildSecondPassUserPrompt,
} from "../prompts/coverage.prompt.js";
import {
  CoverageResult,
  CoverageRequirement,
  SecondPassResult,
  RawSecondPassOutput,
} from "./types.js";

export class CoverageService {
  private llmProvider?: ILlmProvider;

  constructor(provider?: ILlmProvider) {
    this.llmProvider = provider;
  }

  private getProvider(): ILlmProvider {
    return this.llmProvider || getLlmProvider();
  }

  /**
   * Deterministically calculates requirement coverage.
   *
   * Rules:
   * 1. Valid requirement IDs are taken from kit.role.requirements.
   * 2. Inspect every question's explicit requirement_ids.
   * 3. Invalid/hallucinated requirement IDs are ignored.
   * 4. A requirement is covered if at least one question explicitly references that requirement ID.
   * 5. Preserves requirement order from kit.role.requirements.
   * 6. Does NOT use LLM or fuzzy/semantic text matching.
   */
  public calculateCoverage(
    requirements: KitRequirement[],
    questions: (KitQuestion | InternalKitQuestion)[],
    passCount = 1
  ): CoverageResult {
    const validReqIdSet = new Set(requirements.map((r) => r.id));

    // Map each valid requirement ID to covering question IDs
    const reqToQuestionIds = new Map<string, string[]>();
    for (const req of requirements) {
      reqToQuestionIds.set(req.id, []);
    }

    // Inspect every question
    for (const q of questions) {
      if (!q || !Array.isArray(q.requirement_ids)) continue;

      for (const rawId of q.requirement_ids) {
        if (typeof rawId !== "string") continue;
        const reqId = rawId.trim();

        // Only valid requirement IDs from requirements list count
        if (validReqIdSet.has(reqId)) {
          const list = reqToQuestionIds.get(reqId);
          if (list && q.id && !list.includes(q.id)) {
            list.push(q.id);
          }
        }
      }
    }

    const details: CoverageRequirement[] = [];
    const uncovered_requirement_ids: string[] = [];

    // Maintain original requirement order
    for (const req of requirements) {
      const qIds = reqToQuestionIds.get(req.id) || [];
      const covered = qIds.length > 0;

      details.push({
        requirement_id: req.id,
        covered,
        question_ids: qIds,
      });

      if (!covered) {
        uncovered_requirement_ids.push(req.id);
      }
    }

    return {
      uncovered_requirement_ids,
      passes: passCount,
      details,
    };
  }

  /**
   * Cleans and parses raw JSON output from the LLM, stripping markdown code blocks.
   */
  private parseLlmOutput(rawText: string): RawSecondPassOutput {
    let cleaned = rawText.trim();

    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
      cleaned = cleaned.replace(/\s*```$/, "");
      cleaned = cleaned.trim();
    }

    try {
      const parsed = JSON.parse(cleaned);
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("Parsed LLM output is not a valid JSON object.");
      }
      return parsed as RawSecondPassOutput;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid JSON";
      throw new LlmError(
        `Failed to parse LLM second-pass response: ${message}`,
        "LLM_OUTPUT_PARSE_ERROR",
        500
      );
    }
  }

  /**
   * Normalizes category string to one of the 4 strict Appendix A QuestionCategory literals.
   */
  private normalizeCategory(cat: unknown): QuestionCategory {
    if (typeof cat !== "string") return "technical";
    const lower = cat.toLowerCase().trim().replace(/[\s_]+/g, "-");

    if (
      lower === "behavioural" ||
      lower === "behavioral" ||
      lower === "culture" ||
      lower === "soft-skills" ||
      lower === "leadership"
    ) {
      return "behavioural";
    }

    if (
      lower === "system-design" ||
      lower === "systemdesign" ||
      lower === "architecture" ||
      lower === "sys-design"
    ) {
      return "system-design";
    }

    if (
      lower === "company-fit" ||
      lower === "companyfit" ||
      lower === "culture-fit" ||
      lower === "fit" ||
      lower === "product"
    ) {
      return "company-fit";
    }

    return "technical";
  }

  /**
   * Normalizes difficulty to 1, 2, or 3.
   */
  private normalizeDifficulty(diff: unknown): QuestionDifficulty {
    if (typeof diff === "number" && (diff === 1 || diff === 2 || diff === 3)) {
      return diff as QuestionDifficulty;
    }

    if (typeof diff === "string") {
      const parsed = parseInt(diff, 10);
      if (parsed === 1 || parsed === 2 || parsed === 3) {
        return parsed as QuestionDifficulty;
      }
      const lower = diff.toLowerCase().trim();
      if (lower === "easy" || lower === "beginner" || lower === "foundational") return 1;
      if (lower === "hard" || lower === "expert" || lower === "advanced") return 3;
    }

    return 2;
  }

  /**
   * Generates a normalized comparison key for duplicate detection.
   */
  private getComparisonKey(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Executes targeted second-pass generation if requirements are uncovered.
   *
   * Flow:
   * 1. Calculate pass-1 coverage from current questions.
   * 2. If 0 uncovered requirements, return immediately with passes=1 and 0 generated questions.
   * 3. If uncovered requirements exist:
   *    a. Invoke LLM with uncovered requirements only.
   *    b. Parse and normalize candidate questions.
   *    c. Sanitize requirement IDs: keep ONLY IDs present in uncovered list and valid kit requirements.
   *    d. Discard model-generated IDs.
   *    e. Filter out duplicate prompts and empty questions.
   *    f. Preserve all existing protected questions (is_custom, is_edited, is_pinned) and existing questions.
   *    g. Assign deterministic sequential IDs (q1, q2, q3...).
   *    h. Recalculate deterministic coverage with passes=2.
   */
  public async runSecondPass(params: {
    jd: string;
    requirements: KitRequirement[];
    existingQuestions: InternalKitQuestion[];
    companyBrief?: KitCompanyBrief;
    interviewResearch?: InterviewResearch;
  }): Promise<SecondPassResult> {
    const {
      jd,
      requirements,
      existingQuestions = [],
      companyBrief,
      interviewResearch,
    } = params;

    if (!requirements || requirements.length === 0) {
      throw new LlmError(
        "Cannot calculate coverage or run second pass without requirements.",
        "INVALID_INPUT_PARAMETERS",
        400
      );
    }

    // 1. Calculate Pass 1 coverage
    const pass1 = this.calculateCoverage(requirements, existingQuestions, 1);

    if (pass1.uncovered_requirement_ids.length === 0) {
      // 100% covered! Do NOT invoke LLM second pass
      return {
        questions: existingQuestions,
        uncovered_requirement_ids: [],
        generated_count: 0,
      };
    }

    // 2. Filter uncovered requirements
    const uncoveredReqIdSet = new Set(pass1.uncovered_requirement_ids);
    const uncoveredReqs = requirements.filter((r) => uncoveredReqIdSet.has(r.id));

    // 3. Build targeted prompt and invoke LLM
    const provider = this.getProvider();
    const userPrompt = buildSecondPassUserPrompt({
      jd,
      uncoveredRequirements: uncoveredReqs,
      companyBrief,
      interviewResearch,
    });

    const rawOutput = await provider.generateCompletion(userPrompt, {
      systemPrompt: COVERAGE_SECOND_PASS_SYSTEM_PROMPT,
      temperature: 0.3,
      jsonMode: true,
      timeoutMs: 30000,
    });

    const parsed = this.parseLlmOutput(rawOutput);

    // 4. Sanitize and normalize second-pass questions
    const seenQuestionKeys = new Set<string>();

    // Index existing questions to prevent duplicates
    for (const q of existingQuestions) {
      seenQuestionKeys.add(this.getComparisonKey(q.prompt));
    }

    const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
    const newNormalizedQuestions: Omit<InternalKitQuestion, "id">[] = [];

    for (const rawQ of rawQuestions) {
      if (!rawQ || typeof rawQ !== "object") continue;

      const rawPrompt = typeof rawQ.prompt === "string" ? rawQ.prompt.trim() : "";
      if (!rawPrompt || rawPrompt.length < 5) continue;

      const compKey = this.getComparisonKey(rawPrompt);
      if (seenQuestionKeys.has(compKey)) continue; // Deduplicate
      seenQuestionKeys.add(compKey);

      // Validate & filter requirement IDs:
      // MUST be present in uncovered list AND in kit requirements
      const rawReqIds = Array.isArray(rawQ.requirement_ids) ? rawQ.requirement_ids : [];
      const validIds: string[] = [];
      for (const id of rawReqIds) {
        if (typeof id === "string") {
          const trimmed = id.trim();
          if (uncoveredReqIdSet.has(trimmed)) {
            validIds.push(trimmed);
          }
        }
      }

      // If no valid uncovered requirement IDs were referenced, this question cannot cover any gap
      if (validIds.length === 0) {
        continue;
      }

      const rawOutline =
        typeof rawQ.answer_outline === "string" && rawQ.answer_outline.trim()
          ? rawQ.answer_outline.trim()
          : "Key reasoning and trade-offs aligned with role requirements.";

      newNormalizedQuestions.push({
        requirement_ids: Array.from(new Set(validIds)),
        category: this.normalizeCategory(rawQ.category),
        prompt: rawPrompt,
        answer_outline: rawOutline,
        difficulty: this.normalizeDifficulty(rawQ.difficulty),
      });
    }

    // 5. Merge existing questions and new questions, preserving protected questions
    // Existing questions (protected + standard) are kept
    const mergedList: InternalKitQuestion[] = [];
    let qCounter = 1;

    for (const q of existingQuestions) {
      mergedList.push({
        ...q,
        id: `q${qCounter++}`,
      });
    }

    for (const newQ of newNormalizedQuestions) {
      mergedList.push({
        ...newQ,
        id: `q${qCounter++}`,
      });
    }

    // 6. Recalculate deterministic coverage with merged questions (Pass 2)
    const pass2 = this.calculateCoverage(requirements, mergedList, 2);

    return {
      questions: mergedList,
      uncovered_requirement_ids: pass2.uncovered_requirement_ids,
      generated_count: newNormalizedQuestions.length,
    };
  }
}

export const coverageService = new CoverageService();
