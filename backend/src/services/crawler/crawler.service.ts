import {
  CrawlOptions,
  CrawledPage,
  CrawlResult,
  SkippedUrl,
  CrawlerError,
} from "./types.js";
import { normalizeUrl, validateUrlSsrf } from "./ssrf-validator.js";
import { HttpFetcher } from "./http-fetcher.js";
import { HtmlExtractor } from "./html-extractor.js";
import { LinkScorer } from "./link-scorer.js";
import { RobotsParser, RobotsRules } from "./robots-parser.js";
import { HostThrottler } from "./host-throttler.js";

const DEFAULT_MAX_DEPTH = 2;
const DEFAULT_MAX_PAGES = 15;
const DEFAULT_MAX_QUEUED = 50;
const DEFAULT_DELAY_MS = 500;

interface QueueItem {
  url: string;
  depth: number;
  score: number;
  anchorText: string;
}

export class CrawlerService {
  private readonly httpFetcher: HttpFetcher;
  private readonly htmlExtractor: HtmlExtractor;
  private readonly linkScorer: LinkScorer;
  private readonly robotsParser: RobotsParser;
  private readonly hostThrottler: HostThrottler;

  constructor(options?: CrawlOptions) {
    this.httpFetcher = new HttpFetcher({
      timeoutMs: options?.timeoutMs,
      maxPageSizeBytes: options?.maxPageSizeBytes,
      userAgent: options?.userAgent,
      allowLocalTestUrls: options?.allowLocalTestUrls,
    });
    this.htmlExtractor = new HtmlExtractor(options?.maxExtractedChars);
    this.linkScorer = new LinkScorer();
    this.robotsParser = new RobotsParser();
    this.hostThrottler = new HostThrottler();
  }

  /**
   * Executes a bounded, SSRF-safe crawl starting from the given company URL.
   */
  public async crawl(
    startUrl: string,
    options?: CrawlOptions
  ): Promise<CrawlResult> {
    if (!startUrl || typeof startUrl !== "string" || !startUrl.trim()) {
      throw new CrawlerError(
        "A starting company URL is required for crawling.",
        "INVALID_INPUT_PARAMETERS",
        400
      );
    }

    const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
    const maxPages = options?.maxPages ?? DEFAULT_MAX_PAGES;
    const maxQueued = options?.maxQueued ?? DEFAULT_MAX_QUEUED;
    const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;
    const allowLocalTestUrls = options?.allowLocalTestUrls ?? false;

    const startTime = new Date();

    // 1. Validate starting URL safety
    const normalizedStart = await validateUrlSsrf(startUrl, {
      allowLocalTestUrls,
    });
    const parsedStart = new URL(normalizedStart);
    const domain = parsedStart.hostname;

    // 2. Fetch robots.txt rules for the domain
    const robotsRules: RobotsRules = await this.robotsParser.fetchAndParse(
      normalizedStart,
      this.httpFetcher
    );

    // 3. Initialize BFS priority queue
    const queue: QueueItem[] = [
      {
        url: normalizedStart,
        depth: 0,
        score: 100, // Highest priority for starting page
        anchorText: "Homepage",
      },
    ];

    const visitedUrls = new Set<string>();
    const queuedUrls = new Set<string>([normalizedStart]);
    const crawledPages: CrawledPage[] = [];
    const skippedUrls: SkippedUrl[] = [];

    let pagesAttempted = 0;

    // 4. Crawl loop
    while (queue.length > 0 && crawledPages.length < maxPages) {
      // Sort queue so highest-scoring links are popped first
      queue.sort((a, b) => b.score - a.score);
      const currentItem = queue.shift()!;

      if (visitedUrls.has(currentItem.url)) {
        continue;
      }
      visitedUrls.add(currentItem.url);
      pagesAttempted++;

      // Check robots.txt permissions
      if (!this.robotsParser.isAllowed(currentItem.url, robotsRules)) {
        skippedUrls.push({
          url: currentItem.url,
          reason: "Disallowed by robots.txt",
        });
        continue;
      }

      // Respect host crawl rate limit
      await this.hostThrottler.throttle(currentItem.url, delayMs);

      try {
        // Fetch page over HTTP with size & timeout limits
        const fetchRes = await this.httpFetcher.fetchPage(currentItem.url, {
          allowLocalTestUrls,
        });

        // Extract title, readable text, and candidate internal links
        const extracted = this.htmlExtractor.extract(
          fetchRes.html,
          fetchRes.finalUrl
        );

        crawledPages.push({
          url: currentItem.url,
          finalUrl: fetchRes.finalUrl,
          title: extracted.title,
          text: extracted.text,
          depth: currentItem.depth,
          statusCode: fetchRes.statusCode,
          contentType: fetchRes.contentType,
          fetchedAt: new Date().toISOString(),
          relevanceScore: currentItem.score,
          discoveredLinks: extracted.links.map((l) => l.url),
        });

        // If not at maxDepth, discover and enqueue relevant links
        if (currentItem.depth < maxDepth) {
          const rankedLinks = this.linkScorer.rankLinks(extracted.links);

          for (const link of rankedLinks) {
            // Filter out low/negative relevance links (e.g. login, legal, cart)
            if (link.score < 0) {
              continue;
            }

            if (
              !visitedUrls.has(link.url) &&
              !queuedUrls.has(link.url) &&
              queuedUrls.size < maxQueued
            ) {
              queuedUrls.add(link.url);
              queue.push({
                url: link.url,
                depth: currentItem.depth + 1,
                score: link.score,
                anchorText: link.anchorText,
              });
            }
          }
        }
      } catch (err: unknown) {
        // A single page failure must never abort the overall crawl
        const reason = err instanceof Error ? err.message : "Fetch failure";
        skippedUrls.push({
          url: currentItem.url,
          reason,
        });
      }
    }

    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();

    return {
      startUrl: normalizedStart,
      domain,
      pages: crawledPages,
      pagesUsed: crawledPages.map((p) => p.finalUrl || p.url),
      skipped: skippedUrls,
      stats: {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationMs,
        pagesAttempted,
        pagesSucceeded: crawledPages.length,
        pagesSkipped: skippedUrls.length,
      },
    };
  }
}

export const crawlerService = new CrawlerService();
