import * as cheerio from "cheerio";
import { normalizeUrl } from "./ssrf-validator.js";

const DEFAULT_MAX_EXTRACTED_CHARS = 8000;

export interface DiscoveredLink {
  url: string;
  anchorText: string;
}

export interface ExtractedPageData {
  title: string;
  text: string;
  links: DiscoveredLink[];
}

export class HtmlExtractor {
  private readonly maxChars: number;

  constructor(maxChars = DEFAULT_MAX_EXTRACTED_CHARS) {
    this.maxChars = maxChars;
  }

  /**
   * Extracts clean readable text, page title, and internal links from raw HTML.
   */
  public extract(html: string, baseUrl: string): ExtractedPageData {
    const $ = cheerio.load(html);

    // 1. Remove non-content elements and navigation clutter
    $("script, style, noscript, iframe, svg, canvas, nav, header, footer, form, button").remove();

    // 2. Extract page title
    const title =
      $("title").text().trim() ||
      $("h1").first().text().trim() ||
      "Untitled";

    // 3. Extract readable text from main content or body
    const contentContainer = $("main, article, #content, .content").length
      ? $("main, article, #content, .content")
      : $("body");

    let text = contentContainer.text().replace(/\s+/g, " ").trim();
    if (text.length > this.maxChars) {
      text = text.slice(0, this.maxChars);
    }

    // 4. Extract discovered links
    const links: DiscoveredLink[] = [];
    const seenUrls = new Set<string>();

    const baseParsed = new URL(baseUrl);
    const baseHost = baseParsed.hostname.toLowerCase();

    $("a[href]").each((_, el) => {
      const rawHref = $(el).attr("href")?.trim();
      if (!rawHref) return;

      // Skip non-navigational links
      if (
        rawHref.startsWith("#") ||
        rawHref.startsWith("javascript:") ||
        rawHref.startsWith("mailto:") ||
        rawHref.startsWith("tel:")
      ) {
        return;
      }

      try {
        const resolvedUrl = normalizeUrl(rawHref, baseUrl);
        const targetParsed = new URL(resolvedUrl);
        const targetHost = targetParsed.hostname.toLowerCase();

        // Check same-host / same-domain policy (allow identical host or subdomains of the base host)
        const isSameHost =
          targetHost === baseHost ||
          targetHost.endsWith(`.${baseHost}`) ||
          baseHost.endsWith(`.${targetHost}`);

        if (isSameHost && !seenUrls.has(resolvedUrl)) {
          seenUrls.add(resolvedUrl);
          const anchorText = $(el).text().replace(/\s+/g, " ").trim();
          links.push({
            url: resolvedUrl,
            anchorText,
          });
        }
      } catch {
        // Ignore unparseable or invalid URLs
      }
    });

    return {
      title,
      text,
      links,
    };
  }
}
