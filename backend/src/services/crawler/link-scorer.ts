import { DiscoveredLink } from "./html-extractor.js";

interface KeywordScore {
  keyword: string;
  weight: number;
}

const HIGH_PRIORITY_KEYWORDS: KeywordScore[] = [
  { keyword: "careers", weight: 10 },
  { keyword: "career", weight: 10 },
  { keyword: "jobs", weight: 10 },
  { keyword: "job", weight: 10 },
  { keyword: "hiring", weight: 10 },
  { keyword: "work-with-us", weight: 10 },
  { keyword: "join-us", weight: 10 },
  { keyword: "open-roles", weight: 10 },
  { keyword: "engineering", weight: 9 },
  { keyword: "interview", weight: 10 },
  { keyword: "culture", weight: 8 },
];

const MEDIUM_PRIORITY_KEYWORDS: KeywordScore[] = [
  { keyword: "about", weight: 7 },
  { keyword: "about-us", weight: 7 },
  { keyword: "company", weight: 6 },
  { keyword: "team", weight: 6 },
  { keyword: "leadership", weight: 6 },
  { keyword: "values", weight: 6 },
  { keyword: "mission", weight: 6 },
  { keyword: "handbook", weight: 8 },
  { keyword: "life-at", weight: 7 },
];

const DOMAIN_PRODUCT_KEYWORDS: KeywordScore[] = [
  { keyword: "product", weight: 5 },
  { keyword: "products", weight: 5 },
  { keyword: "platform", weight: 5 },
  { keyword: "technology", weight: 5 },
  { keyword: "tech", weight: 5 },
  { keyword: "blog", weight: 4 },
  { keyword: "newsroom", weight: 4 },
  { keyword: "press", weight: 4 },
];

const NEGATIVE_KEYWORDS: KeywordScore[] = [
  { keyword: "privacy", weight: -10 },
  { keyword: "terms", weight: -10 },
  { keyword: "legal", weight: -10 },
  { keyword: "cookie", weight: -10 },
  { keyword: "login", weight: -10 },
  { keyword: "signin", weight: -10 },
  { keyword: "signup", weight: -10 },
  { keyword: "cart", weight: -10 },
  { keyword: "checkout", weight: -10 },
  { keyword: "billing", weight: -10 },
  { keyword: "pricing", weight: -8 },
  { keyword: "help", weight: -6 },
  { keyword: "support", weight: -6 },
];

const ALL_RULES = [
  ...HIGH_PRIORITY_KEYWORDS,
  ...MEDIUM_PRIORITY_KEYWORDS,
  ...DOMAIN_PRODUCT_KEYWORDS,
  ...NEGATIVE_KEYWORDS,
];

export class LinkScorer {
  /**
   * Calculates a deterministic relevance score for a link based on its URL path and anchor text.
   */
  public scoreLink(url: string, anchorText = ""): number {
    let score = 0;
    const urlLower = url.toLowerCase();
    const anchorLower = anchorText.toLowerCase();

    for (const rule of ALL_RULES) {
      if (urlLower.includes(rule.keyword)) {
        score += rule.weight;
      }
      if (anchorLower.includes(rule.keyword)) {
        score += Math.round(rule.weight * 0.8);
      }
    }

    return score;
  }

  /**
   * Sorts links descending by relevance score.
   */
  public rankLinks(links: DiscoveredLink[]): (DiscoveredLink & { score: number })[] {
    return links
      .map((link) => ({
        ...link,
        score: this.scoreLink(link.url, link.anchorText),
      }))
      .sort((a, b) => b.score - a.score);
  }
}
