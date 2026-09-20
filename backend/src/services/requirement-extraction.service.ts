import {
  KitRequirement,
  RequirementKind,
  RequirementPriority,
} from "../types/kit.js";
import { getLlmProvider, ILlmProvider, LlmError } from "./llm/index.js";
import {
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionUserPrompt,
} from "./prompts/extraction.prompt.js";

interface RawRequirementItem {
  id?: unknown;
  text?: unknown;
  kind?: unknown;
  priority?: unknown;
}

interface RawExtractionOutput {
  requirements?: RawRequirementItem[];
}

export class RequirementExtractionService {
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
  private parseLlmOutput(rawText: string): RawExtractionOutput {
    let cleaned = rawText.trim();

    // Remove markdown code fences e.g. ```json ... ``` or ``` ... ```
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
      return parsed as RawExtractionOutput;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid JSON";
      throw new LlmError(
        `Failed to parse LLM extraction response: ${message}`,
        "LLM_OUTPUT_PARSE_ERROR",
        500
      );
    }
  }

  /**
   * Normalizes category string to one of the strict Appendix A RequirementKind literals.
   */
  private normalizeKind(kind: unknown): RequirementKind {
    if (typeof kind !== "string") return "technical";
    const lower = kind.trim().toLowerCase();

    if (
      lower === "technical" ||
      lower === "tech" ||
      lower === "hard_skill" ||
      lower === "engineering"
    ) {
      return "technical";
    }

    if (
      lower === "behavioural" ||
      lower === "behavioral" ||
      lower === "soft_skill" ||
      lower === "leadership" ||
      lower === "culture"
    ) {
      return "behavioural";
    }

    if (
      lower === "domain" ||
      lower === "industry" ||
      lower === "business" ||
      lower === "product"
    ) {
      return "domain";
    }

    return "technical";
  }

  /**
   * Normalizes priority string to one of the strict Appendix A RequirementPriority literals.
   */
  private normalizePriority(priority: unknown): RequirementPriority {
    if (typeof priority !== "string") return "must";
    const lower = priority.trim().toLowerCase();

    if (
      lower === "nice" ||
      lower === "nice to have" ||
      lower === "preferred" ||
      lower === "optional" ||
      lower === "bonus" ||
      lower === "plus"
    ) {
      return "nice";
    }

    return "must";
  }

  /**
   * Normalizes requirement text for duplicate comparison.
   */
  private getComparisonKey(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Main requirement extraction workflow:
   * 1. Constructs untrusted-data-safe prompt.
   * 2. Calls LLM provider.
   * 3. Validates and normalizes output into Appendix A structure with deterministic sequential IDs (r1, r2, ...).
   * 4. Deduplicates requirements while preserving meaningful specificity.
   */
  public async extractRequirements(
    jd: string,
    existingRequirements: KitRequirement[] = []
  ): Promise<KitRequirement[]> {
    if (!jd || typeof jd !== "string" || !jd.trim()) {
      throw new LlmError(
        "Job description is required for requirement extraction.",
        "INVALID_INPUT_PARAMETERS",
        400
      );
    }

    const provider = this.getProvider();
    const userPrompt = buildExtractionUserPrompt(jd);

    // Call LLM
    const rawOutput = await provider.generateCompletion(userPrompt, {
      systemPrompt: EXTRACTION_SYSTEM_PROMPT,
      temperature: 0.2,
      jsonMode: true,
      timeoutMs: 30000,
    });

    const parsed = this.parseLlmOutput(rawOutput);

    if (!Array.isArray(parsed.requirements)) {
      throw new LlmError(
        "LLM output missing 'requirements' array.",
        "LLM_OUTPUT_PARSE_ERROR",
        500
      );
    }

    const seenKeys = new Set<string>();
    const normalizedList: Omit<KitRequirement, "id">[] = [];

    // Separate user custom items if present (state preservation)
    const customItems = existingRequirements.filter(
      (r: any) => r.is_custom === true
    );
    for (const custom of customItems) {
      seenKeys.add(this.getComparisonKey(custom.text));
    }

    for (const raw of parsed.requirements) {
      if (!raw || typeof raw !== "object") continue;

      const rawText = typeof raw.text === "string" ? raw.text.trim() : "";
      if (!rawText || rawText.length < 3) {
        continue;
      }

      const compKey = this.getComparisonKey(rawText);
      if (seenKeys.has(compKey)) {
        continue; // Deduplicate
      }

      seenKeys.add(compKey);
      normalizedList.push({
        text: rawText,
        kind: this.normalizeKind(raw.kind),
        priority: this.normalizePriority(raw.priority),
      });
    }

    // Assign deterministic application-controlled IDs (r1, r2, r3, ...)
    let counter = 1;
    const finalRequirements: KitRequirement[] = [];

    // Append preserved custom requirements first if any
    for (const custom of customItems) {
      finalRequirements.push({
        id: `r${counter++}`,
        text: custom.text,
        kind: custom.kind,
        priority: custom.priority,
        ...(custom as any),
      });
    }

    for (const item of normalizedList) {
      finalRequirements.push({
        id: `r${counter++}`,
        text: item.text,
        kind: item.kind,
        priority: item.priority,
      });
    }

    return finalRequirements;
  }
}

export const requirementExtractionService = new RequirementExtractionService();
