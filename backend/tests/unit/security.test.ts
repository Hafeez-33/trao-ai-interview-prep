import { describe, it, expect } from "vitest";
import { normalizeUrl, validateUrlSsrf } from "../../src/services/crawler/ssrf-validator.js";
import { toSafeKit, toSafeKitSummary, IKitDocument } from "../../src/types/kit.js";
import { toSafeUser } from "../../src/types/auth.js";
import { ObjectId } from "mongodb";

describe("Security Boundaries & Sanitization (Unit Tests)", () => {
  describe("SSRF URL & Destination Filtering", () => {
    it("rejects non-HTTP protocols (file://, ftp://, javascript:, data:)", async () => {
      expect(() => normalizeUrl("file:///etc/passwd")).toThrow(/SSRF_FORBIDDEN_DESTINATION|Unsupported protocol/);
      expect(() => normalizeUrl("ftp://ftp.example.com")).toThrow(/SSRF_FORBIDDEN_DESTINATION|Unsupported protocol/);
      expect(() => normalizeUrl("javascript:alert(1)")).toThrow(/SSRF_FORBIDDEN_DESTINATION|Unsupported protocol/);
      expect(() => normalizeUrl("data:text/html,<h1>Hello</h1>")).toThrow(/SSRF_FORBIDDEN_DESTINATION|Unsupported protocol/);
    });

    it("rejects loopback and private IP addresses in production mode", async () => {
      await expect(validateUrlSsrf("http://127.0.0.1/admin", { allowLocalTestUrls: false })).rejects.toThrow(/forbidden|SSRF/);
      await expect(validateUrlSsrf("http://10.0.0.1/internal", { allowLocalTestUrls: false })).rejects.toThrow(/forbidden|SSRF/);
      await expect(validateUrlSsrf("http://172.16.0.1/status", { allowLocalTestUrls: false })).rejects.toThrow(/forbidden|SSRF/);
      await expect(validateUrlSsrf("http://192.168.1.1/router", { allowLocalTestUrls: false })).rejects.toThrow(/forbidden|SSRF/);
    });

    it("rejects cloud metadata IP addresses", async () => {
      await expect(validateUrlSsrf("http://169.254.169.254/latest/meta-data", { allowLocalTestUrls: false })).rejects.toThrow(/forbidden|SSRF/);
      await expect(validateUrlSsrf("http://100.100.100.200/meta", { allowLocalTestUrls: false })).rejects.toThrow(/forbidden|SSRF/);
      await expect(validateUrlSsrf("http://metadata.google.internal/computeMetadata/v1", { allowLocalTestUrls: false })).rejects.toThrow(/forbidden|SSRF/);
    });
  });

  describe("SafeKit & SafeUser Public Boundary", () => {
    it("toSafeKit strips internal builder flags and pipeline documents", () => {
      const internalDoc: IKitDocument = {
        _id: new ObjectId("6ab0b02647b5ec03f320cfd8"),
        userId: "6ab0b02647b5ec03f320cfd6",
        jd: "Valid JD for senior engineer role.",
        status: "completed",
        source: {
          company: "Acme",
          company_url: "https://example.com",
          role: "Backend Lead",
          location: "Remote",
          jd_chars: 100,
          researched_at: "2026-09-20T10:00:00.000Z",
          pages_used: ["https://example.com/about"],
        },
        company_brief: {
          summary: "Acme Summary",
          what_they_do: "Cloud",
          sources: ["https://example.com/about"],
          is_edited: true,
        },
        role: {
          title: "Backend Lead",
          level: "Senior",
          requirements: [
            { id: "r1", text: "Node.js", kind: "technical", priority: "must" },
          ],
        },
        questions: [
          {
            id: "q1",
            category: "technical",
            prompt: "Event loop prompt",
            difficulty: 2,
            requirement_ids: ["r1"],
            answer_outline: "Point 1",
            is_custom: true,
            is_edited: true,
            is_pinned: true,
            order: 1,
          },
        ],
        flashcards: [
          {
            id: "f1",
            front: "Front text",
            back: "Back text",
            requirement_ids: ["r1"],
            is_custom: true,
            is_edited: true,
            order: 1,
          },
        ],
        coverage: {
          uncovered_requirement_ids: [],
          passes: 1,
        },
        schedule: {
          days_available: 1,
          days: [
            { day: 1, focus: "Tech", minutes: 30, question_ids: ["q1"] },
          ],
        },
        crawled_pages: [
          { url: "https://example.com", title: "Home", text: "Internal crawled text", relevance_score: 1 },
        ],
        interview_research: {
          availability: "available",
          summary: "Internal research",
          sources: [],
        },
        createdAt: new Date("2026-09-20T10:00:00.000Z"),
        updatedAt: new Date("2026-09-20T10:05:00.000Z"),
      };

      const safeKit = toSafeKit(internalDoc);

      // Verify stripped internal fields
      expect((safeKit as any).crawled_pages).toBeUndefined();
      expect((safeKit as any).interview_research).toBeUndefined();
      expect((safeKit.company_brief as any).is_edited).toBeUndefined();
      expect((safeKit.questions[0] as any).is_custom).toBeUndefined();
      expect((safeKit.questions[0] as any).is_edited).toBeUndefined();
      expect((safeKit.questions[0] as any).is_pinned).toBeUndefined();
      expect((safeKit.questions[0] as any).order).toBeUndefined();
      expect((safeKit.flashcards[0] as any).is_custom).toBeUndefined();
      expect((safeKit.flashcards[0] as any).is_edited).toBeUndefined();
      expect(safeKit._id).toBe("6ab0b02647b5ec03f320cfd8");
    });

    it("toSafeKitSummary strips userId and details from summary list view", () => {
      const internalDoc: IKitDocument = {
        _id: new ObjectId("6ab0b02647b5ec03f320cfd8"),
        userId: "6ab0b02647b5ec03f320cfd6",
        jd: "Valid JD for senior engineer role.",
        status: "completed",
        source: {
          company: "Acme",
          company_url: "https://example.com",
          role: "Backend Lead",
          location: "Remote",
          jd_chars: 100,
          researched_at: "2026-09-20T10:00:00.000Z",
          pages_used: ["https://example.com/about"],
        },
        company_brief: { summary: "Acme", what_they_do: "Cloud", sources: [] },
        role: {
          title: "Backend Lead",
          level: "Senior",
          requirements: [],
        },
        questions: [],
        flashcards: [],
        coverage: { uncovered_requirement_ids: [], passes: 1 },
        schedule: { days_available: 1, days: [] },
        createdAt: new Date("2026-09-20T10:00:00.000Z"),
        updatedAt: new Date("2026-09-20T10:05:00.000Z"),
      };

      const summary = toSafeKitSummary(internalDoc);
      expect((summary as any).userId).toBeUndefined();
      expect(summary._id).toBe("6ab0b02647b5ec03f320cfd8");
      expect(summary.company).toBe("Acme");
      expect(summary.role).toBe("Backend Lead");
    });

    it("toSafeUser strips passwordHash and exposes string id", () => {
      const userDoc = {
        _id: new ObjectId("6ab0b02647b5ec03f320cfd6"),
        email: "alice@example.com",
        name: "Alice Developer",
        passwordHash: "$2a$10$e8w.x7W4L1s1T2u3V4w5Ye7Z8y9D.AIzaSyD9x8y7Z6w5V4u3T2s",
        createdAt: new Date("2026-09-20T10:00:00.000Z"),
        updatedAt: new Date("2026-09-20T10:00:00.000Z"),
      };

      const safeUser = toSafeUser(userDoc);
      expect((safeUser as any).passwordHash).toBeUndefined();
      expect((safeUser as any).password).toBeUndefined();
      expect(safeUser.id).toBe("6ab0b02647b5ec03f320cfd6");
      expect(safeUser.email).toBe("alice@example.com");
    });
  });
});
