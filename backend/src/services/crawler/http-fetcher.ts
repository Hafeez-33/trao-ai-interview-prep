import { CrawlerError } from "./types.js";
import { validateUrlSsrf, normalizeUrl } from "./ssrf-validator.js";

const DEFAULT_USER_AGENT = "TraoInterviewPrepBot/1.0 (+https://trao.ai/bot)";
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_PAGE_SIZE_BYTES = 1.5 * 1024 * 1024; // 1.5 MB
const MAX_REDIRECTS = 3;

export interface FetchOptions {
  timeoutMs?: number;
  maxPageSizeBytes?: number;
  userAgent?: string;
  allowLocalTestUrls?: boolean;
}

export interface FetchResponse {
  url: string;
  finalUrl: string;
  statusCode: number;
  contentType: string;
  html: string;
}

export class HttpFetcher {
  private readonly defaultOptions: Required<FetchOptions>;

  constructor(options?: FetchOptions) {
    this.defaultOptions = {
      timeoutMs: options?.timeoutMs || DEFAULT_TIMEOUT_MS,
      maxPageSizeBytes: options?.maxPageSizeBytes || DEFAULT_MAX_PAGE_SIZE_BYTES,
      userAgent: options?.userAgent || DEFAULT_USER_AGENT,
      allowLocalTestUrls: options?.allowLocalTestUrls || false,
    };
  }

  /**
   * Fetches an HTML page over HTTP/HTTPS with strict SSRF checks, redirect validation,
   * size limits, and content-type filtering.
   */
  public async fetchPage(
    url: string,
    overrideOptions?: FetchOptions
  ): Promise<FetchResponse> {
    const opts = { ...this.defaultOptions, ...overrideOptions };
    let currentUrl = await validateUrlSsrf(url, {
      allowLocalTestUrls: opts.allowLocalTestUrls,
    });
    let redirectCount = 0;

    while (redirectCount <= MAX_REDIRECTS) {
      let controller: AbortController | null = null;
      let timeoutId: NodeJS.Timeout | null = null;

      try {
        controller = new AbortController();
        timeoutId = setTimeout(() => controller?.abort(), opts.timeoutMs);

        const response = await fetch(currentUrl, {
          method: "GET",
          headers: {
            "User-Agent": opts.userAgent,
            Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
          redirect: "manual", // Enforces manual redirect inspection for SSRF
          signal: controller.signal,
        });

        // 1. Handle HTTP Redirects (301, 302, 303, 307, 308)
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          redirectCount++;
          if (redirectCount > MAX_REDIRECTS) {
            throw new CrawlerError(
              `Exceeded maximum redirect limit of ${MAX_REDIRECTS}.`,
              "REDIRECT_LIMIT_EXCEEDED",
              400
            );
          }

          const locationHeader = response.headers.get("location");
          if (!locationHeader) {
            throw new CrawlerError(
              `Redirect status ${response.status} returned without Location header.`,
              "INVALID_REDIRECT",
              400
            );
          }

          const nextUrl = normalizeUrl(locationHeader, currentUrl);
          // Re-validate SSRF on redirect destination before following
          currentUrl = await validateUrlSsrf(nextUrl, {
            allowLocalTestUrls: opts.allowLocalTestUrls,
          });
          continue;
        }

        // 2. Check HTTP status
        if (!response.ok) {
          throw new CrawlerError(
            `HTTP ${response.status} ${response.statusText} for '${currentUrl}'`,
            "HTTP_ERROR",
            response.status
          );
        }

        // 3. Check Content-Type header
        const rawContentType = response.headers.get("content-type") || "";
        const contentType = rawContentType.split(";")[0].trim().toLowerCase();

        if (
          contentType &&
          !contentType.includes("text/html") &&
          !contentType.includes("application/xhtml+xml") &&
          !contentType.includes("text/plain")
        ) {
          throw new CrawlerError(
            `Unsupported content-type '${contentType}'. Only HTML is supported.`,
            "UNSUPPORTED_CONTENT_TYPE",
            415
          );
        }

        // 4. Check Content-Length header
        const contentLengthHeader = response.headers.get("content-length");
        if (contentLengthHeader) {
          const contentLength = parseInt(contentLengthHeader, 10);
          if (!isNaN(contentLength) && contentLength > opts.maxPageSizeBytes) {
            throw new CrawlerError(
              `Content-Length (${contentLength} bytes) exceeds maximum limit of ${opts.maxPageSizeBytes} bytes.`,
              "PAGE_OVERSIZED",
              413
            );
          }
        }

        // 5. Stream response body with size limit enforcement
        const html = await this.readBodyWithLimit(response, opts.maxPageSizeBytes);

        return {
          url,
          finalUrl: currentUrl,
          statusCode: response.status,
          contentType: rawContentType || "text/html",
          html,
        };
      } catch (err: unknown) {
        if (err instanceof CrawlerError) {
          throw err;
        }

        if (err instanceof Error && err.name === "AbortError") {
          throw new CrawlerError(
            `Request timed out after ${opts.timeoutMs}ms for '${currentUrl}'.`,
            "CRAWL_TIMEOUT",
            504
          );
        }

        const message = err instanceof Error ? err.message : "Network error";
        throw new CrawlerError(
          `Failed to fetch '${currentUrl}': ${message}`,
          "COMPANY_UNREACHABLE",
          500
        );
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    }

    throw new CrawlerError(
      `Exceeded maximum redirect limit for '${url}'.`,
      "REDIRECT_LIMIT_EXCEEDED",
      400
    );
  }

  /**
   * Reads response body with strict byte-size enforcement.
   */
  private async readBodyWithLimit(response: Response, maxBytes: number): Promise<string> {
    if (!response.body) {
      return await response.text();
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (value) {
        receivedBytes += value.length;
        if (receivedBytes > maxBytes) {
          reader.cancel();
          throw new CrawlerError(
            `Response body exceeded maximum limit of ${maxBytes} bytes while streaming.`,
            "PAGE_OVERSIZED",
            413
          );
        }
        chunks.push(value);
      }
    }

    const totalBuffer = new Uint8Array(receivedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      totalBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    return new TextDecoder("utf-8").decode(totalBuffer);
  }
}
