import {
  KitRequirement,
  KitCompanyBrief,
  QuestionCategory,
  QuestionDifficulty,
  InternalKitQuestion,
  InternalKitFlashcard,
} from "../../types/kit.js";
import { InterviewResearch } from "../research/types.js";
import { getLlmProvider, ILlmProvider, LlmError } from "../llm/index.js";
import {
  GENERATION_SYSTEM_PROMPT,
  buildGenerationUserPrompt,
} from "../prompts/generation.prompt.js";
import {
  GenerationResult,
  RawGenerationOutput,
} from "./types.js";

export class GenerationService {
  private llmProvider?: ILlmProvider;

  constructor(provider?: ILlmProvider) {
    this.llmProvider = provider;
  }

  private getProvider(): ILlmProvider {
    return this.llmProvider || getLlmProvider();
  }

  /**
   * Cleans and parses raw JSON output from the LLM, stripping markdown wrappers if present.
   */
  private parseLlmOutput(rawText: string): RawGenerationOutput {
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
      return parsed as RawGenerationOutput;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid JSON";
      throw new LlmError(
        `Failed to parse LLM generation response: ${message}`,
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
   * Main generation workflow:
   * 1. Validates requirements exist.
   * 2. Calls LLM provider with structured JSON schema.
   * 3. Parses and normalizes questions and flashcards.
   * 4. Enforces valid requirement IDs.
   * 5. Deduplicates content.
   * 6. Preserves protected user-edited/custom/pinned items (docs/STATE.md).
   * 7. Assigns deterministic application-controlled sequential IDs (q1, q2... and f1, f2...).
   */
  public async generateKitContent(params: {
    jd: string;
    requirements: KitRequirement[];
    companyBrief?: KitCompanyBrief;
    interviewResearch?: InterviewResearch;
    existingQuestions?: InternalKitQuestion[];
    existingFlashcards?: InternalKitFlashcard[];
  }): Promise<GenerationResult> {
    const {
      jd,
      requirements,
      companyBrief,
      interviewResearch,
      existingQuestions = [],
      existingFlashcards = [],
    } = params;

    if (!requirements || requirements.length === 0) {
      throw new LlmError(
        "Cannot generate questions and flashcards without extracted requirements.",
        "INVALID_INPUT_PARAMETERS",
        400
      );
    }

    const validReqIds = new Set(requirements.map((r) => r.id));
    const fallbackReqId = requirements[0].id;

    const provider = this.getProvider();
    const userPrompt = buildGenerationUserPrompt({
      jd,
      requirements,
      companyBrief,
      interviewResearch,
    });

    const rawOutput = await provider.generateCompletion(userPrompt, {
      systemPrompt: GENERATION_SYSTEM_PROMPT,
      temperature: 0.3,
      jsonMode: true,
      timeoutMs: 40000,
    });

    const parsed = this.parseLlmOutput(rawOutput);

    // ==========================================
    // 1. QUESTION PROCESSING & STATE PRESERVATION
    // ==========================================
    const seenQuestionKeys = new Set<string>();
    const preservedQuestions: InternalKitQuestion[] = [];

    // Retain protected existing questions (is_custom, is_edited, is_pinned)
    for (const q of existingQuestions) {
      if (q.is_custom || q.is_edited || q.is_pinned) {
        preservedQuestions.push(q);
        seenQuestionKeys.add(this.getComparisonKey(q.prompt));
      }
    }

    const newNormalizedQuestions: Omit<InternalKitQuestion, "id">[] = [];
    const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];

    for (const rawQ of rawQuestions) {
      if (!rawQ || typeof rawQ !== "object") continue;

      const rawPrompt = typeof rawQ.prompt === "string" ? rawQ.prompt.trim() : "";
      if (!rawPrompt || rawPrompt.length < 5) continue;

      const compKey = this.getComparisonKey(rawPrompt);
      if (seenQuestionKeys.has(compKey)) continue; // Deduplicate
      seenQuestionKeys.add(compKey);

      // Validate & filter requirement references
      const rawReqIds = Array.isArray(rawQ.requirement_ids) ? rawQ.requirement_ids : [];
      const validIds: string[] = [];
      for (const id of rawReqIds) {
        if (typeof id === "string" && validReqIds.has(id.trim())) {
          validIds.push(id.trim());
        }
      }

      // If no valid requirement IDs were referenced, attach fallback requirement
      const finalReqIds = validIds.length > 0 ? Array.from(new Set(validIds)) : [fallbackReqId];

      const rawOutline =
        typeof rawQ.answer_outline === "string" && rawQ.answer_outline.trim()
          ? rawQ.answer_outline.trim()
          : "Key reasoning and trade-offs aligned with role requirements.";

      newNormalizedQuestions.push({
        requirement_ids: finalReqIds,
        category: this.normalizeCategory(rawQ.category),
        prompt: rawPrompt,
        answer_outline: rawOutline,
        difficulty: this.normalizeDifficulty(rawQ.difficulty),
      });
    }

    // Assign deterministic sequential IDs (q1, q2, q3...)
    let qCounter = 1;
    const finalQuestions: InternalKitQuestion[] = [];

    for (const q of preservedQuestions) {
      finalQuestions.push({
        ...q,
        id: `q${qCounter++}`,
      });
    }

    for (const q of newNormalizedQuestions) {
      finalQuestions.push({
        ...q,
        id: `q${qCounter++}`,
      });
    }

    // ==========================================
    // 2. FLASHCARD PROCESSING & STATE PRESERVATION
    // ==========================================
    const seenFlashcardKeys = new Set<string>();
    const preservedFlashcards: InternalKitFlashcard[] = [];

    // Retain protected existing flashcards (is_custom, is_edited)
    for (const f of existingFlashcards) {
      if (f.is_custom || f.is_edited) {
        preservedFlashcards.push(f);
        seenFlashcardKeys.add(this.getComparisonKey(f.front));
      }
    }

    const newNormalizedFlashcards: Omit<InternalKitFlashcard, "id">[] = [];
    const rawFlashcards = Array.isArray(parsed.flashcards) ? parsed.flashcards : [];

    for (const rawF of rawFlashcards) {
      if (!rawF || typeof rawF !== "object") continue;

      const rawFront = typeof rawF.front === "string" ? rawF.front.trim() : "";
      const rawBack = typeof rawF.back === "string" ? rawF.back.trim() : "";
      if (!rawFront || !rawBack || rawFront.length < 3 || rawBack.length < 3) continue;

      const compKey = this.getComparisonKey(rawFront);
      if (seenFlashcardKeys.has(compKey)) continue; // Deduplicate
      seenFlashcardKeys.add(compKey);

      // Validate & filter requirement references
      const rawReqIds = Array.isArray(rawF.requirement_ids) ? rawF.requirement_ids : [];
      const validIds: string[] = [];
      for (const id of rawReqIds) {
        if (typeof id === "string" && validReqIds.has(id.trim())) {
          validIds.push(id.trim());
        }
      }

      const finalReqIds = validIds.length > 0 ? Array.from(new Set(validIds)) : [fallbackReqId];

      newNormalizedFlashcards.push({
        front: rawFront,
        back: rawBack,
        requirement_ids: finalReqIds,
      });
    }

    // Assign deterministic sequential IDs (f1, f2, f3...)
    let fCounter = 1;
    const finalFlashcards: InternalKitFlashcard[] = [];

    for (const f of preservedFlashcards) {
      finalFlashcards.push({
        ...f,
        id: `f${fCounter++}`,
      });
    }

    for (const f of newNormalizedFlashcards) {
      finalFlashcards.push({
        ...f,
        id: `f${fCounter++}`,
      });
    }

    return {
      questions: finalQuestions,
      flashcards: finalFlashcards,
    };
  }
}

export const generationService = new GenerationService();
