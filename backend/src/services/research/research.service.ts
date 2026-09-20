import { CrawledPage } from "../crawler/types.js";
import { normalizeUrl } from "../crawler/ssrf-validator.js";
import { getLlmProvider, ILlmProvider, LlmError } from "../llm/index.js";
import {
  RESEARCH_SYSTEM_PROMPT,
  buildResearchUserPrompt,
} from "../prompts/research.prompt.js";
import {
  InterviewResearch,
  InterviewResearchAvailability,
  RawResearchOutput,
  ResearchResult,
} from "./types.js";

const MAX_RESEARCH_PAGES = 8;
const MAX_TOTAL_CONTEXT_CHARS = 25000;

/**
 * Normalizes a URL and canonicalizes trailing slashes for exact deterministic matching.
 */
export function canonicalizeUrl(rawUrl: string, baseUrl?: string): string {
  try {
    const normalized = normalizeUrl(rawUrl, baseUrl);
    const parsed = new URL(normalized);
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

export class ResearchService {
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
  private parseLlmOutput(rawText: string): RawResearchOutput {
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
      return parsed as RawResearchOutput;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid JSON";
      throw new LlmError(
        `Failed to parse LLM research response: ${message}`,
        "LLM_OUTPUT_PARSE_ERROR",
        500
      );
    }
  }

  /**
   * Selects and bounds the most relevant crawled pages within the token/context budget.
   */
  private selectRelevantPages(pages: CrawledPage[]): CrawledPage[] {
    // 1. Filter only successfully fetched pages with content
    const validPages = pages.filter(
      (p) => p.statusCode === 200 && p.text && p.text.trim().length > 0
    );

    // 2. Sort by relevance score descending
    const sorted = [...validPages].sort((a, b) => b.relevanceScore - a.relevanceScore);

    // 3. Select top pages within character limit
    const selected: CrawledPage[] = [];
    let currentChars = 0;

    for (const page of sorted) {
      if (selected.length >= MAX_RESEARCH_PAGES) {
        break;
      }
      if (currentChars + page.text.length > MAX_TOTAL_CONTEXT_CHARS && selected.length > 0) {
        break;
      }
      selected.push(page);
      currentChars += page.text.length;
    }

    return selected;
  }

  /**
   * Normalizes interview research availability.
   */
  private normalizeAvailability(val: unknown): InterviewResearchAvailability {
    if (typeof val !== "string") return "unavailable";
    const lower = val.toLowerCase().trim();
    if (lower === "available") return "available";
    if (lower === "partial") return "partial";
    return "unavailable";
  }

  /**
   * Main research workflow:
   * 1. Validates server-side crawled pages.
   * 2. Bounds and selects top relevant pages.
   * 3. Constructs prompt with untrusted data safeguards.
   * 4. Invokes LLM.
   * 5. Deterministically validates and normalizes all source URLs against crawler evidence.
   * 6. Enforces honest interview availability.
   */
  public async performResearch(params: {
    jd: string;
    companyUrl: string;
    pages: CrawledPage[];
    companyHint?: string;
  }): Promise<ResearchResult> {
    const { jd, companyUrl, pages, companyHint } = params;

    // Filter valid fetched pages
    const validFetchedPages = pages.filter(
      (p) => p.statusCode === 200 && p.text && p.text.trim().length > 0
    );

    // Build verified URL lookup table (canonicalized -> exact original)
    const verifiedUrlMap = new Map<string, string>();
    for (const p of validFetchedPages) {
      const canonical = canonicalizeUrl(p.url);
      if (canonical) {
        verifiedUrlMap.set(canonical, p.url);
      }
    }

    // If no pages are available or successfully fetched, return honest fallback
    if (validFetchedPages.length === 0) {
      return {
        companyBrief: {
          summary: "Company information could not be retrieved from the provided website.",
          what_they_do: "Unable to verify company operations from available pages.",
          sources: [],
        },
        interviewResearch: {
          availability: "unavailable",
          summary: null,
          sources: [],
        },
        sourcesUsed: [],
        companyName: companyHint || "",
      };
    }

    const selectedPages = this.selectRelevantPages(validFetchedPages);
    const provider = this.getProvider();
    const userPrompt = buildResearchUserPrompt(jd, selectedPages, companyHint);

    const rawOutput = await provider.generateCompletion(userPrompt, {
      systemPrompt: RESEARCH_SYSTEM_PROMPT,
      temperature: 0.1,
      jsonMode: true,
      timeoutMs: 35000,
    });

    const parsed = this.parseLlmOutput(rawOutput);

    // 1. Extract and validate company name
    const rawCompanyName =
      typeof parsed.company_name === "string" ? parsed.company_name.trim() : "";
    const companyName = rawCompanyName || companyHint || "";

    // 2. Validate & normalize company brief sources
    const briefSources: string[] = [];
    const rawBriefSources = Array.isArray(parsed.company_brief?.source_urls)
      ? parsed.company_brief!.source_urls
      : [];

    for (const rawUrl of rawBriefSources) {
      if (typeof rawUrl !== "string") continue;
      const canonical = canonicalizeUrl(rawUrl);
      if (canonical && verifiedUrlMap.has(canonical)) {
        const exactUrl = verifiedUrlMap.get(canonical)!;
        if (!briefSources.includes(exactUrl)) {
          briefSources.push(exactUrl);
        }
      }
    }

    // If LLM returned no valid sources but valid pages were used in context, fallback to top context URLs
    if (briefSources.length === 0 && selectedPages.length > 0) {
      for (const p of selectedPages.slice(0, 2)) {
        if (!briefSources.includes(p.url)) {
          briefSources.push(p.url);
        }
      }
    }

    const briefSummary =
      typeof parsed.company_brief?.summary === "string" && parsed.company_brief.summary.trim()
        ? parsed.company_brief.summary.trim()
        : "Company overview synthesized from crawled public pages.";

    const whatTheyDo =
      typeof parsed.company_brief?.what_they_do === "string" && parsed.company_brief.what_they_do.trim()
        ? parsed.company_brief.what_they_do.trim()
        : "Products and services detailed on company website.";

    // 3. Validate & normalize interview research
    const rawInterview = parsed.interview_research;
    let availability = this.normalizeAvailability(rawInterview?.availability);
    const interviewSources: string[] = [];

    const rawInterviewSources = Array.isArray(rawInterview?.source_urls)
      ? rawInterview!.source_urls
      : [];

    for (const rawUrl of rawInterviewSources) {
      if (typeof rawUrl !== "string") continue;
      const canonical = canonicalizeUrl(rawUrl);
      if (canonical && verifiedUrlMap.has(canonical)) {
        const exactUrl = verifiedUrlMap.get(canonical)!;
        if (!interviewSources.includes(exactUrl)) {
          interviewSources.push(exactUrl);
        }
      }
    }

    let interviewSummary: string | null =
      typeof rawInterview?.summary === "string" && rawInterview.summary.trim()
        ? rawInterview.summary.trim()
        : null;

    // Enforce factuality: if availability is not unavailable, but no verified sources or summary exist, force unavailable
    if (availability !== "unavailable") {
      if (!interviewSummary || interviewSources.length === 0) {
        availability = "unavailable";
        interviewSummary = null;
        interviewSources.length = 0;
      }
    } else {
      interviewSummary = null;
      interviewSources.length = 0;
    }

    // 4. Combined verified sources used
    const allSourcesUsed = Array.from(new Set([...briefSources, ...interviewSources]));

    return {
      companyBrief: {
        summary: briefSummary,
        what_they_do: whatTheyDo,
        sources: briefSources,
      },
      interviewResearch: {
        availability,
        summary: interviewSummary,
        sources: interviewSources,
      },
      sourcesUsed: allSourcesUsed,
      companyName,
    };
  }
}

export const researchService = new ResearchService();
