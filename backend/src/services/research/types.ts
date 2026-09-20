import { KitCompanyBrief } from "../../types/kit.js";

export type InterviewResearchAvailability = "available" | "partial" | "unavailable";

export interface InterviewResearch {
  availability: InterviewResearchAvailability;
  summary: string | null;
  sources: string[];
}

export interface ResearchResult {
  companyBrief: KitCompanyBrief;
  interviewResearch: InterviewResearch;
  sourcesUsed: string[];
  companyName?: string;
}

export interface RawResearchBrief {
  summary?: unknown;
  what_they_do?: unknown;
  source_urls?: unknown;
}

export interface RawInterviewResearch {
  availability?: unknown;
  summary?: unknown;
  source_urls?: unknown;
}

export interface RawResearchOutput {
  company_name?: unknown;
  company_brief?: RawResearchBrief;
  interview_research?: RawInterviewResearch;
}
