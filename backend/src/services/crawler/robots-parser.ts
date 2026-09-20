import { HttpFetcher } from "./http-fetcher.js";

export interface RobotsRules {
  disallowedPaths: string[];
  crawlDelay?: number;
}

export class RobotsParser {
  /**
   * Attempts to fetch and parse robots.txt for a given base URL.
   * If unavailable, returns empty rules without throwing.
   */
  public async fetchAndParse(
    baseUrl: string,
    fetcher: HttpFetcher
  ): Promise<RobotsRules> {
    const rules: RobotsRules = {
      disallowedPaths: [],
    };

    try {
      const parsedBase = new URL(baseUrl);
      const robotsUrl = `${parsedBase.protocol}//${parsedBase.host}/robots.txt`;

      const response = await fetcher.fetchPage(robotsUrl);
      if (response.statusCode === 200 && response.html) {
        this.parseContent(response.html, rules);
      }
    } catch {
      // Graceful degradation: if robots.txt is unavailable or 404, proceed with crawl
    }

    return rules;
  }

  /**
   * Parses robots.txt text content looking for relevant User-agent directives.
   */
  public parseContent(content: string, rules: RobotsRules): void {
    const lines = content.split(/\r?\n/);
    let appliesToBot = false;

    for (const rawLine of lines) {
      const line = rawLine.split("#")[0].trim(); // Strip comments
      if (!line) continue;

      const [directive, ...rest] = line.split(":");
      const value = rest.join(":").trim();
      const dirLower = directive.toLowerCase().trim();

      if (dirLower === "user-agent") {
        const agent = value.toLowerCase();
        appliesToBot = agent === "*" || agent.includes("traointerviewprepbot");
      } else if (appliesToBot) {
        if (dirLower === "disallow" && value) {
          rules.disallowedPaths.push(value);
        } else if (dirLower === "crawl-delay") {
          const delay = parseFloat(value);
          if (!isNaN(delay) && delay > 0) {
            rules.crawlDelay = delay;
          }
        }
      }
    }
  }

  /**
   * Checks if a specific URL path is permitted under the parsed robots.txt rules.
   */
  public isAllowed(targetUrl: string, rules: RobotsRules): boolean {
    try {
      const parsed = new URL(targetUrl);
      const path = parsed.pathname;

      for (const disallowed of rules.disallowedPaths) {
        if (disallowed === "/") {
          return false;
        }
        if (path.startsWith(disallowed)) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }
}
