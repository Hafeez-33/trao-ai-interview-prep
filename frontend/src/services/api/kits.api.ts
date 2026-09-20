import { apiClient } from "./client.js";
import {
  SafeKit,
  SafeKitSummary,
  KitRequirement,
  KitCoverage,
  KitSchedule,
  UpdateKitParams,
} from "@/types/kit.js";

export interface CreateKitParams {
  jd: string;
  company_url?: string;
  days?: number;
}

export interface ValidationErrorItem {
  code: string;
  path: string;
  message: string;
}

export interface ValidationResponse {
  valid: boolean;
  errors: ValidationErrorItem[];
  warnings: ValidationErrorItem[];
}

export interface ExtractResponse {
  kit: SafeKit;
  requirements: KitRequirement[];
}

export interface CrawlResponse {
  success: boolean;
  kit: SafeKit;
  crawl: {
    startUrl: string;
    domain: string;
    pages_crawled: number;
    pages_used: string[];
    skipped: Array<{ url: string; reason: string }>;
  };
}

export interface ResearchResponse {
  success: boolean;
  kit: SafeKit;
  research: {
    company_brief: SafeKit["company_brief"];
    interview_research: unknown;
    sources_used: string[];
  };
}

export interface GenerateResponse {
  success: boolean;
  kit: SafeKit;
}

export interface CoverageResponse {
  success: boolean;
  kit: SafeKit;
  coverage: KitCoverage;
  generated_count?: number;
}

export interface ScheduleResponse {
  success: boolean;
  kit: SafeKit;
  schedule: KitSchedule;
}

/**
 * Frontend Kit API Service
 * Interacts with /api/v1/kits endpoints using authenticated session cookies.
 */
export const kitsApi = {
  /**
   * Creates a new Kit draft.
   */
  async createKit(params: CreateKitParams): Promise<{ kit: SafeKit }> {
    return apiClient<{ kit: SafeKit }>("/kits", {
      method: "POST",
      body: params,
    });
  },

  /**
   * Updates an existing Kit via PATCH /api/v1/kits/:id
   */
  async updateKit(id: string, params: UpdateKitParams): Promise<{ kit: SafeKit }> {
    return apiClient<{ kit: SafeKit }>(`/kits/${id}`, {
      method: "PATCH",
      body: params,
    });
  },

  /**
   * Retrieves a single Kit by ID.
   */
  async getKit(id: string): Promise<{ kit: SafeKit }> {
    return apiClient<{ kit: SafeKit }>(`/kits/${id}`, {
      method: "GET",
    });
  },

  /**
   * Lists all kits owned by the authenticated user.
   */
  async listKits(): Promise<{ kits: SafeKitSummary[] }> {
    return apiClient<{ kits: SafeKitSummary[] }>("/kits", {
      method: "GET",
    });
  },

  /**
   * Extracts structured requirements from the Kit's Job Description.
   */
  async extractRequirements(id: string): Promise<ExtractResponse> {
    return apiClient<ExtractResponse>(`/kits/${id}/extract`, {
      method: "POST",
    });
  },

  /**
   * Crawls the company website using SSRF-safe scraper.
   */
  async crawlCompany(id: string): Promise<CrawlResponse> {
    return apiClient<CrawlResponse>(`/kits/${id}/crawl`, {
      method: "POST",
      timeoutMs: 45000,
    });
  },

  /**
   * Synthesizes company brief and interview research from cached crawled pages.
   */
  async researchCompany(id: string): Promise<ResearchResponse> {
    return apiClient<ResearchResponse>(`/kits/${id}/research`, {
      method: "POST",
      timeoutMs: 45000,
    });
  },

  /**
   * Generates interview questions and flashcards.
   */
  async generateKit(id: string): Promise<GenerateResponse> {
    return apiClient<GenerateResponse>(`/kits/${id}/generate`, {
      method: "POST",
      timeoutMs: 60000,
    });
  },

  /**
   * Calculates requirement coverage and runs targeted pass 2 for gaps.
   */
  async runCoverage(id: string): Promise<CoverageResponse> {
    return apiClient<CoverageResponse>(`/kits/${id}/coverage`, {
      method: "POST",
      timeoutMs: 45000,
    });
  },

  /**
   * Generates deterministic day-by-day preparation schedule.
   */
  async generateSchedule(id: string, days?: number): Promise<ScheduleResponse> {
    return apiClient<ScheduleResponse>(`/kits/${id}/schedule`, {
      method: "POST",
      body: days !== undefined ? { days } : {},
    });
  },

  /**
   * Deterministically validates the complete kit structure and consistency.
   */
  async validateKit(id: string): Promise<ValidationResponse> {
    return apiClient<ValidationResponse>(`/kits/${id}/validate`, {
      method: "POST",
    });
  },

  /**
   * Triggers controlled regeneration preserving user edits, custom items, and pinned questions.
   */
  async regenerateKit(id: string, scope?: RegenerateScope): Promise<RegenerateResponse> {
    return apiClient<RegenerateResponse>(`/kits/${id}/regenerate`, {
      method: "POST",
      body: scope || {},
      timeoutMs: 60000,
    });
  },
};

export interface RegenerateScope {
  target?: "questions" | "flashcards" | "company_brief" | "all";
  category?: "technical" | "behavioural" | "system-design" | "company-fit";
}

export interface RegenerateResponse {
  success: boolean;
  kit: SafeKit;
}
