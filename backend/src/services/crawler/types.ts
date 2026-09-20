/**
 * Configuration options for the web crawler.
 */
export interface CrawlOptions {
  maxDepth?: number;
  maxPages?: number;
  maxQueued?: number;
  timeoutMs?: number;
  maxPageSizeBytes?: number;
  maxExtractedChars?: number;
  delayMs?: number;
  userAgent?: string;
  allowLocalTestUrls?: boolean;
}

/**
 * Representation of an individual successfully fetched and parsed page.
 */
export interface CrawledPage {
  url: string;
  finalUrl: string;
  title: string;
  text: string;
  depth: number;
  statusCode: number;
  contentType: string;
  fetchedAt: string; // ISO timestamp
  relevanceScore: number;
  discoveredLinks: string[];
}

/**
 * Record of a URL that was skipped or failed during crawl.
 */
export interface SkippedUrl {
  url: string;
  reason: string;
}

/**
 * Operational crawl metrics and duration.
 */
export interface CrawlStats {
  startTime: string;
  endTime: string;
  durationMs: number;
  pagesAttempted: number;
  pagesSucceeded: number;
  pagesSkipped: number;
}

/**
 * Complete result output of a crawl operation.
 */
export interface CrawlResult {
  startUrl: string;
  domain: string;
  pages: CrawledPage[];
  pagesUsed: string[];
  skipped: SkippedUrl[];
  stats: CrawlStats;
}

/**
 * Structured error class for crawler operations.
 * Guaranteed never to leak credentials or internal network topology.
 */
export class CrawlerError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(message: string, code = "CRAWLER_ERROR", status = 500) {
    super(message);
    this.name = "CrawlerError";
    this.code = code;
    this.status = status;
  }
}
