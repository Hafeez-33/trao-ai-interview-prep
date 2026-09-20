import { Request, Response, NextFunction } from "express";
import {
  createKit,
  findKitById,
  listKitsByUser,
  updateKit,
  deleteKit,
  updateKitRequirements,
  updateKitCrawlResult,
  updateKitResearchResult,
  updateKitQuestionsAndFlashcards,
  updateKitStatus,
} from "../db/kits.js";
import {
  toSafeKit,
  toSafeKitSummary,
  UpdateKitParams,
} from "../types/kit.js";
import {
  validateJd,
  validateCompanyUrl,
  validateDays,
  isValidObjectId,
} from "../utils/validation.js";
import { requirementExtractionService } from "../services/requirement-extraction.service.js";
import { LlmError } from "../services/llm/types.js";
import { crawlerService, CrawlerError } from "../services/crawler/index.js";
import { researchService } from "../services/research/index.js";
import { generationService } from "../services/generation/index.js";
import { config } from "../config/env.js";

/**
 * Helper to retrieve the authenticated user ID from the request session.
 */
function getAuthUserId(req: Request): string | null {
  return req.session?.user?.id || req.user?.id || null;
}

/**
 * POST /api/v1/kits
 * Creates a new Kit draft with validated Job Description and Phase 1 source fields.
 */
export async function createKitHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
      return;
    }

    const { jd, company_url, days } = req.body || {};

    // 1. Validate Job Description (Mandatory)
    const jdResult = validateJd(jd);
    if (!jdResult.valid) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUT_PARAMETERS",
          message: jdResult.error || "Invalid job description.",
        },
      });
      return;
    }

    // 2. Validate company_url (Optional)
    const urlResult = validateCompanyUrl(company_url);
    if (!urlResult.valid) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUT_PARAMETERS",
          message: urlResult.error || "Invalid company_url.",
        },
      });
      return;
    }

    // 3. Validate days (Optional)
    const daysResult = validateDays(days);
    if (!daysResult.valid) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUT_PARAMETERS",
          message: daysResult.error || "Invalid days.",
        },
      });
      return;
    }

    // 4. Persist Kit to database
    const newKit = await createKit({
      userId,
      jd: jdResult.value!,
      company_url: urlResult.value,
      days: daysResult.value,
    });

    res.status(201).json({
      kit: toSafeKit(newKit),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/kits
 * Lists all kits owned by the authenticated user, ordered newest first.
 */
export async function listKitsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
      return;
    }

    const kits = await listKitsByUser(userId);

    res.status(200).json({
      kits: kits.map(toSafeKitSummary),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/kits/:id
 * Retrieves a single Kit by ID. Enforces ownership at the database query level.
 */
export async function getKitByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
      return;
    }

    const id = typeof req.params.id === "string" ? req.params.id : "";

    if (!isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUT_PARAMETERS",
          message: "Invalid Kit ID format.",
        },
      });
      return;
    }

    const kit = await findKitById(id, userId);

    if (!kit) {
      // Prevents revealing whether another user's Kit exists
      res.status(404).json({
        success: false,
        error: {
          code: "KIT_NOT_FOUND",
          message: "Kit not found.",
        },
      });
      return;
    }

    res.status(200).json({
      kit: toSafeKit(kit),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/kits/:id
 * Updates editable Phase 1/4 source/JD information.
 * Strictly preserves kit ownership and rejects unallowed field modifications.
 */
export async function updateKitHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
      return;
    }

    const id = typeof req.params.id === "string" ? req.params.id : "";

    if (!isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUT_PARAMETERS",
          message: "Invalid Kit ID format.",
        },
      });
      return;
    }

    const { jd, company_url, days } = req.body || {};

    // Ensure at least one valid Phase 4 field is present
    if (jd === undefined && company_url === undefined && days === undefined) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUT_PARAMETERS",
          message: "At least one editable field (jd, company_url, days) must be provided.",
        },
      });
      return;
    }

    const updateParams: UpdateKitParams = {};

    if (jd !== undefined) {
      const jdResult = validateJd(jd);
      if (!jdResult.valid) {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_INPUT_PARAMETERS",
            message: jdResult.error || "Invalid job description.",
          },
        });
        return;
      }
      updateParams.jd = jdResult.value!;
    }

    if (company_url !== undefined) {
      const urlResult = validateCompanyUrl(company_url);
      if (!urlResult.valid) {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_INPUT_PARAMETERS",
            message: urlResult.error || "Invalid company_url.",
          },
        });
        return;
      }
      updateParams.company_url = urlResult.value;
    }

    if (days !== undefined) {
      const daysResult = validateDays(days);
      if (!daysResult.valid) {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_INPUT_PARAMETERS",
            message: daysResult.error || "Invalid days.",
          },
        });
        return;
      }
      updateParams.days = daysResult.value;
    }

    const updatedKit = await updateKit(id, userId, updateParams);

    if (!updatedKit) {
      // Prevents revealing whether another user's Kit exists
      res.status(404).json({
        success: false,
        error: {
          code: "KIT_NOT_FOUND",
          message: "Kit not found.",
        },
      });
      return;
    }

    res.status(200).json({
      kit: toSafeKit(updatedKit),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/kits/:id
 * Deletes a Kit owned by the authenticated user.
 */
export async function deleteKitHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
      return;
    }

    const id = typeof req.params.id === "string" ? req.params.id : "";

    if (!isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUT_PARAMETERS",
          message: "Invalid Kit ID format.",
        },
      });
      return;
    }

    const deleted = await deleteKit(id, userId);

    if (!deleted) {
      // Prevents revealing whether another user's Kit exists
      res.status(404).json({
        success: false,
        error: {
          code: "KIT_NOT_FOUND",
          message: "Kit not found.",
        },
      });
      return;
    }

    res.status(200).json({
      message: "Kit deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/kits/:id/extract
 * Extracts and normalizes structured requirements from the Kit's stored Job Description.
 */
export async function extractRequirementsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
      return;
    }

    const id = typeof req.params.id === "string" ? req.params.id : "";

    if (!isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUT_PARAMETERS",
          message: "Invalid Kit ID format.",
        },
      });
      return;
    }

    // 1. Fetch existing kit (ownership enforced at DB level)
    const kit = await findKitById(id, userId);
    if (!kit) {
      res.status(404).json({
        success: false,
        error: {
          code: "KIT_NOT_FOUND",
          message: "Kit not found.",
        },
      });
      return;
    }

    if (!kit.jd || !kit.jd.trim()) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUT_PARAMETERS",
          message: "Kit does not contain a valid Job Description.",
        },
      });
      return;
    }

    // 2. Extract and normalize requirements via extraction service
    const existingRequirements = kit.role?.requirements || [];
    const extractedRequirements = await requirementExtractionService.extractRequirements(
      kit.jd,
      existingRequirements
    );

    // 3. Persist normalized requirements into MongoDB
    const updatedKit = await updateKitRequirements(id, userId, extractedRequirements);

    if (!updatedKit) {
      res.status(404).json({
        success: false,
        error: {
          code: "KIT_NOT_FOUND",
          message: "Kit not found.",
        },
      });
      return;
    }

    res.status(200).json({
      kit: toSafeKit(updatedKit),
      requirements: extractedRequirements,
    });
  } catch (error: unknown) {
    if (error instanceof LlmError) {
      res.status(error.status).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }
    next(error);
  }
}

/**
 * POST /api/v1/kits/:id/crawl
 * Runs the SSRF-safe, bounded web crawler against the Kit's company_url.
 */
export async function crawlCompanyHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
      return;
    }

    const id = typeof req.params.id === "string" ? req.params.id : "";

    if (!isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUT_PARAMETERS",
          message: "Invalid Kit ID format.",
        },
      });
      return;
    }

    // 1. Fetch kit and verify ownership
    const kit = await findKitById(id, userId);
    if (!kit) {
      res.status(404).json({
        success: false,
        error: {
          code: "KIT_NOT_FOUND",
          message: "Kit not found.",
        },
      });
      return;
    }

    const companyUrl = kit.source?.company_url?.trim();
    if (!companyUrl) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUT_PARAMETERS",
          message: "Kit does not have a company_url configured for crawling.",
        },
      });
      return;
    }

    // 2. Determine local test URL permission
    const allowLocalTestUrls =
      config.nodeEnv === "test" ||
      process.env.ALLOW_LOCAL_TEST_URLS === "true";

    // 3. Execute crawler
    const crawlResult = await crawlerService.crawl(companyUrl, {
      allowLocalTestUrls,
    });

    // 4. Update Kit in MongoDB with researched pages, cached page contents, and timestamp
    const updatedKit = await updateKitCrawlResult(
      id,
      userId,
      crawlResult.pagesUsed,
      crawlResult.stats.endTime,
      crawlResult.pages
    );

    res.status(200).json({
      success: true,
      kit: toSafeKit(updatedKit || kit),
      crawl: {
        startUrl: crawlResult.startUrl,
        domain: crawlResult.domain,
        pages_crawled: crawlResult.pages.length,
        pages: crawlResult.pages,
        pages_used: crawlResult.pagesUsed,
        skipped: crawlResult.skipped,
        stats: crawlResult.stats,
      },
    });
  } catch (error: unknown) {
    if (error instanceof CrawlerError) {
      res.status(error.status).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }
    next(error);
  }
}

/**
 * POST /api/v1/kits/:id/research
 * Runs factual company and interview research based strictly on server-side cached crawler pages.
 * Client-submitted pages in req.body are strictly ignored (Correction 1).
 */
export async function researchCompanyHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
      return;
    }

    const id = typeof req.params.id === "string" ? req.params.id : "";

    if (!isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUT_PARAMETERS",
          message: "Invalid Kit ID format.",
        },
      });
      return;
    }

    // 1. Fetch existing kit (ownership enforced at DB query level)
    const kit = await findKitById(id, userId);
    if (!kit) {
      res.status(404).json({
        success: false,
        error: {
          code: "KIT_NOT_FOUND",
          message: "Kit not found.",
        },
      });
      return;
    }

    const companyUrl = kit.source?.company_url?.trim();
    if (!companyUrl) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUT_PARAMETERS",
          message: "Kit does not have a company_url configured for research.",
        },
      });
      return;
    }

    // 2. Consume ONLY server-side cached crawler pages (Correction 1)
    const crawledPages = kit.crawled_pages || [];
    if (crawledPages.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: "NO_CRAWL_DATA",
          message: "No crawled website pages found for this Kit. Run /crawl before executing research.",
        },
      });
      return;
    }

    // 3. Execute research service
    const researchResult = await researchService.performResearch({
      jd: kit.jd || "",
      companyUrl,
      pages: crawledPages,
      companyHint: kit.source?.company || "",
    });

    // 4. Update Kit in MongoDB with ownership and state preservation (Correction 2)
    const updatedKit = await updateKitResearchResult(
      id,
      userId,
      researchResult,
      true // preserveEditedBrief
    );

    if (!updatedKit) {
      res.status(404).json({
        success: false,
        error: {
          code: "KIT_NOT_FOUND",
          message: "Kit not found.",
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      kit: toSafeKit(updatedKit),
      research: {
        company_brief: updatedKit.company_brief,
        interview_research: researchResult.interviewResearch,
        sources_used: researchResult.sourcesUsed,
      },
    });
  } catch (error: unknown) {
    if (error instanceof LlmError) {
      res.status(error.status).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }
    next(error);
  }
}

/**
 * POST /api/v1/kits/:id/generate
 * Generates interview questions and study flashcards for a Kit based on its requirements, JD, and research.
 */
export async function generateKitHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
      return;
    }

    const id = typeof req.params.id === "string" ? req.params.id : "";

    if (!isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUT_PARAMETERS",
          message: "Invalid Kit ID format.",
        },
      });
      return;
    }

    // 1. Fetch existing kit (ownership enforced at DB query level)
    const kit = await findKitById(id, userId);
    if (!kit) {
      res.status(404).json({
        success: false,
        error: {
          code: "KIT_NOT_FOUND",
          message: "Kit not found.",
        },
      });
      return;
    }

    // 2. Validate requirements exist
    const requirements = kit.role?.requirements || [];
    if (requirements.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUT_PARAMETERS",
          message: "Kit does not have any extracted requirements. Run /extract first.",
        },
      });
      return;
    }

    // 3. Transition status to "generating"
    await updateKitStatus(id, userId, "generating");

    try {
      // 4. Run generation service
      const generationResult = await generationService.generateKitContent({
        jd: kit.jd || "",
        requirements,
        companyBrief: kit.company_brief,
        interviewResearch: kit.interview_research,
        existingQuestions: kit.questions || [],
        existingFlashcards: kit.flashcards || [],
      });

      // 5. Persist questions and flashcards with "completed" status
      const updatedKit = await updateKitQuestionsAndFlashcards(
        id,
        userId,
        generationResult.questions,
        generationResult.flashcards,
        "completed"
      );

      if (!updatedKit) {
        res.status(404).json({
          success: false,
          error: {
            code: "KIT_NOT_FOUND",
            message: "Kit not found.",
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        kit: toSafeKit(updatedKit),
      });
    } catch (genError: unknown) {
      // Record failure status on Kit
      const errMessage =
        genError instanceof Error ? genError.message : "Generation failed";
      await updateKitStatus(id, userId, "failed", errMessage);
      throw genError;
    }
  } catch (error: unknown) {
    if (error instanceof LlmError) {
      res.status(error.status).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }
    next(error);
  }
}
