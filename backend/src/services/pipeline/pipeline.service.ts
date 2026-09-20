/**
 * Core Application Pipeline Service
 * Trao AI Interview Prep Kit
 *
 * Implements the shared, deterministic 16-step generation pipeline
 * conforming strictly to docs/ARCHITECTURE.md and docs/PIPELINE.md.
 *
 * Reused by both the web application and the headless batch evaluator CLI.
 */

import { KitStructure, KitSource, KitCompanyBrief, KitRole, KitQuestion, KitFlashcard, KitSchedule, KitCoverage } from "../../types/kit.js";
import { CrawledPage } from "../crawler/types.js";
import { InterviewResearch } from "../research/types.js";
import { validateJd, validateCompanyUrl, validateDays } from "../../utils/validation.js";
import { requirementExtractionService } from "../requirement-extraction.service.js";
import { crawlerService, CrawlerError } from "../crawler/index.js";
import { researchService } from "../research/index.js";
import { generationService } from "../generation/index.js";
import { coverageService } from "../coverage/index.js";
import { scheduleService, ScheduleError } from "../schedule/index.js";
import { kitValidationService } from "../validation/index.js";
import { LlmError } from "../llm/types.js";

export interface PipelineInput {
  jd: string;
  company_url?: string;
  company?: string;
  role?: string;
  location?: string;
  days?: number;
  allowLocalTestUrls?: boolean;
}

export class PipelineError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code: string, status: number = 500, details?: Record<string, unknown>) {
    super(message);
    this.name = "PipelineError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class PipelineService {
  /**
   * Executes the complete, grounded interview preparation kit pipeline.
   *
   * Steps:
   * 1. Input Validation
   * 2. Requirement Extraction & Stable ID Assignment (r1, r2...)
   * 3. SSRF-Safe Web Crawl (if company_url provided)
   * 4. Factual Research & Brief Synthesis
   * 5. Categorized Question & Flashcard Generation (q1, q2... / f1, f2...)
   * 6. Deterministic Coverage Check (Pass 1) & Targeted Second Pass (Pass 2)
   * 7. Deterministic Schedule Day Allocation
   * 8. Strict Appendix A Schema Validation
   */
  public async executeKitPipeline(input: PipelineInput): Promise<KitStructure> {
    // 1. Input Validation
    const jdResult = validateJd(input.jd);
    if (!jdResult.valid) {
      throw new PipelineError(
        jdResult.error || "Invalid job description.",
        "INVALID_INPUT_PARAMETERS",
        400
      );
    }
    const cleanJd = jdResult.value!;

    let cleanCompanyUrl = "";
    if (input.company_url && input.company_url.trim()) {
      const urlResult = validateCompanyUrl(input.company_url);
      if (!urlResult.valid) {
        throw new PipelineError(
          urlResult.error || "Invalid company_url.",
          "INVALID_INPUT_PARAMETERS",
          400
        );
      }
      cleanCompanyUrl = urlResult.value!;
    }

    const daysResult = validateDays(input.days !== undefined ? input.days : 5);
    if (!daysResult.valid) {
      throw new PipelineError(
        daysResult.error || "Invalid preparation days.",
        "INVALID_INPUT_PARAMETERS",
        400
      );
    }
    const cleanDays = daysResult.value!;

    const companyName = input.company?.trim() || "";
    const roleTitle = input.role?.trim() || "";
    const location = input.location?.trim() || "";

    // 2. Requirement Extraction & Stable ID Assignment
    const extractedRequirements = await requirementExtractionService.extractRequirements(
      cleanJd,
      []
    );

    if (!extractedRequirements || extractedRequirements.length === 0) {
      throw new PipelineError(
        "Failed to extract any requirements from the job description.",
        "INVALID_INPUT_PARAMETERS",
        400
      );
    }

    // 3. SSRF-Safe Web Crawl (if company_url provided)
    let crawledPages: CrawledPage[] = [];
    let pagesUsed: string[] = [];
    let crawlResearchedAt = new Date().toISOString();

    if (cleanCompanyUrl) {
      try {
        const crawlResult = await crawlerService.crawl(cleanCompanyUrl, {
          allowLocalTestUrls: input.allowLocalTestUrls ?? true,
        });
        crawledPages = crawlResult.pages;
        pagesUsed = crawlResult.pagesUsed;
        crawlResearchedAt = crawlResult.stats.endTime;
      } catch (err: unknown) {
        if (err instanceof CrawlerError) {
          // SSRF violations are security errors that fail the pipeline
          if (err.code === "SSRF_FORBIDDEN_DESTINATION") {
            throw new PipelineError(err.message, err.code, 400);
          }
          // External connectivity failures degrade gracefully per docs/ERRORS.md
          pagesUsed = [];
        } else {
          pagesUsed = [];
        }
      }
    }

    // 4. Factual Company & Interview Research
    let companyBrief: KitCompanyBrief = {
      summary: `Interview preparation for ${roleTitle || "Target Role"} at ${companyName || "Target Company"}.`,
      what_they_do: companyName
        ? `${companyName} focuses on the domain outlined in the job description.`
        : "Company domain and focus derived directly from role requirements.",
      sources: cleanCompanyUrl ? [cleanCompanyUrl] : [],
    };
    let interviewResearch: InterviewResearch | undefined = undefined;

    if (cleanCompanyUrl && crawledPages.length > 0) {
      try {
        const researchResult = await researchService.performResearch({
          jd: cleanJd,
          companyUrl: cleanCompanyUrl,
          pages: crawledPages,
          companyHint: companyName,
        });
        companyBrief = {
          summary: researchResult.companyBrief.summary,
          what_they_do: researchResult.companyBrief.what_they_do,
          sources: researchResult.sourcesUsed,
        };
        interviewResearch = researchResult.interviewResearch;
      } catch (err: unknown) {
        // Fallback to basic company brief if LLM research fails
        if (!(err instanceof LlmError)) {
          throw err;
        }
      }
    }

    // 5. Questions & Flashcards Generation
    const generationResult = await generationService.generateKitContent({
      jd: cleanJd,
      requirements: extractedRequirements,
      companyBrief,
      interviewResearch,
      existingQuestions: [],
      existingFlashcards: [],
    });

    let currentQuestions = generationResult.questions;
    const currentFlashcards = generationResult.flashcards;

    // 6. Deterministic Coverage Check (Pass 1) & Targeted Second Pass (Pass 2)
    const pass1 = coverageService.calculateCoverage(
      extractedRequirements,
      currentQuestions,
      1
    );

    let finalCoverage: KitCoverage;

    if (pass1.uncovered_requirement_ids.length === 0) {
      finalCoverage = {
        uncovered_requirement_ids: [],
        passes: 1,
      };
    } else {
      // Second pass targeting uncovered gaps
      const secondPassResult = await coverageService.runSecondPass({
        jd: cleanJd,
        requirements: extractedRequirements,
        existingQuestions: currentQuestions,
        companyBrief,
        interviewResearch,
      });

      currentQuestions = secondPassResult.questions;
      finalCoverage = {
        uncovered_requirement_ids: secondPassResult.uncovered_requirement_ids,
        passes: 2,
      };

      // If must-have requirements remain uncovered after second pass, verify schedule can proceed or fail
      const mustRequirementIds = new Set(
        extractedRequirements.filter((r) => r.priority === "must").map((r) => r.id)
      );
      const uncoveredMusts = finalCoverage.uncovered_requirement_ids.filter((id: string) =>
        mustRequirementIds.has(id)
      );
      if (uncoveredMusts.length > 0) {
        throw new PipelineError(
          `Unable to satisfy must-have requirement coverage after pass 2: [${uncoveredMusts.join(", ")}]`,
          "UNCOVERED_MUST_REQUIREMENTS",
          500,
          { uncoveredMusts }
        );
      }
    }

    // 7. Deterministic Schedule Day Allocation
    let schedule: KitSchedule;
    try {
      schedule = scheduleService.generateSchedule({
        requirements: extractedRequirements,
        questions: currentQuestions,
        days: cleanDays,
      });
    } catch (err: unknown) {
      if (err instanceof ScheduleError) {
        throw new PipelineError(err.message, err.code, err.status, err.details);
      }
      throw err;
    }

    // 8. Construct Candidate KitStructure
    const kitSource: KitSource = {
      company: companyName || "Target Company",
      company_url: cleanCompanyUrl,
      role: roleTitle || "Interview Candidate",
      location: location || "",
      jd_chars: cleanJd.length,
      researched_at: crawlResearchedAt,
      pages_used: pagesUsed,
    };

    const kitRole: KitRole = {
      title: roleTitle || "Interview Candidate",
      seniority: "",
      responsibilities: [],
      requirements: extractedRequirements.map((r) => ({
        id: r.id,
        text: r.text,
        kind: r.kind,
        priority: r.priority,
      })),
    };

    const sanitizedQuestions: KitQuestion[] = currentQuestions.map((q) => ({
      id: q.id,
      requirement_ids: q.requirement_ids,
      category: q.category,
      prompt: q.prompt,
      answer_outline: q.answer_outline,
      difficulty: q.difficulty,
    }));

    const sanitizedFlashcards: KitFlashcard[] = currentFlashcards.map((f) => ({
      id: f.id,
      front: f.front,
      back: f.back,
      requirement_ids: f.requirement_ids,
    }));

    const candidateKit: KitStructure = {
      source: kitSource,
      company_brief: {
        summary: companyBrief.summary,
        what_they_do: companyBrief.what_they_do,
        sources: companyBrief.sources,
      },
      role: kitRole,
      questions: sanitizedQuestions,
      flashcards: sanitizedFlashcards,
      schedule,
      coverage: finalCoverage,
    };

    // 9. Strict Appendix A Schema Validation
    const validationResult = kitValidationService.validateKit(candidateKit as any, {
      rawJd: cleanJd,
      crawledPages,
    });

    if (!validationResult.valid) {
      const errorMsg = validationResult.errors.map((e) => e.message).join("; ");
      throw new PipelineError(
        `Generated kit failed Appendix A schema validation: ${errorMsg}`,
        "SCHEMA_VALIDATION_ERROR",
        500,
        { errors: validationResult.errors }
      );
    }

    return candidateKit;
  }
}

export const pipelineService = new PipelineService();
export const executeKitPipeline = pipelineService.executeKitPipeline.bind(pipelineService);
