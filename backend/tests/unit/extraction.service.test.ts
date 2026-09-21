import { describe, it, expect, vi } from "vitest";
import { RequirementExtractionService } from "../../src/services/requirement-extraction.service.js";
import type { ILlmProvider } from "../../src/services/llm/index.js";

describe("RequirementExtractionService (Unit Tests)", () => {
  it("extracts structured requirements from valid JD with deterministic IDs (r1, r2, r3)", async () => {
    const mockLlm: ILlmProvider = {
      name: "mock-llm",
      generateCompletion: vi.fn().mockResolvedValue(
        JSON.stringify({
          requirements: [
            { text: "Node.js & TypeScript microservices", kind: "technical", priority: "must" },
            { text: "Experience with MongoDB", kind: "technical", priority: "nice" },
            { text: "System design & distributed caching", kind: "technical", priority: "must" },
          ],
        })
      ),
    };

    const service = new RequirementExtractionService(mockLlm);
    const reqs = await service.extractRequirements(
      "We are looking for a Senior Engineer with Node.js, TypeScript, MongoDB, and distributed systems."
    );

    expect(reqs).toHaveLength(3);
    expect(reqs[0].id).toBe("r1");
    expect(reqs[0].kind).toBe("technical");
    expect(reqs[0].priority).toBe("must");
    expect(reqs[1].id).toBe("r2");
    expect(reqs[1].priority).toBe("nice");
    expect(reqs[2].id).toBe("r3");
  });

  it("rejects empty JD with INVALID_INPUT_PARAMETERS", async () => {
    const service = new RequirementExtractionService();
    await expect(service.extractRequirements("")).rejects.toThrow();
    await expect(service.extractRequirements("   \n\t   ")).rejects.toThrow();
  });

  it("normalizes invalid or unknown kind and priority values to safe defaults", async () => {
    const mockLlm: ILlmProvider = {
      name: "mock-llm",
      generateCompletion: vi.fn().mockResolvedValue(
        JSON.stringify({
          requirements: [
            { text: "Teamwork skills", kind: "behavioral", priority: "optional" },
            { text: "Architecture patterns", kind: "engineering", priority: "critical" },
          ],
        })
      ),
    };

    const service = new RequirementExtractionService(mockLlm);
    const reqs = await service.extractRequirements(
      "Senior engineer required for teamwork and architecture."
    );

    expect(reqs[0].kind).toBe("behavioural");
    expect(reqs[0].priority).toBe("nice");
    expect(reqs[1].kind).toBe("technical");
    expect(reqs[1].priority).toBe("must");
  });

  it("handles markdown wrapped JSON responses e.g. ```json ... ```", async () => {
    const mockLlm: ILlmProvider = {
      name: "mock-llm",
      generateCompletion: vi.fn().mockResolvedValue(
        "```json\n" +
        JSON.stringify({
          requirements: [
            { text: "PostgreSQL querying", kind: "technical", priority: "must" },
          ],
        }) +
        "\n```"
      ),
    };

    const service = new RequirementExtractionService(mockLlm);
    const reqs = await service.extractRequirements("Database developer proficient in SQL.");
    expect(reqs).toHaveLength(1);
    expect(reqs[0].id).toBe("r1");
    expect(reqs[0].text).toBe("PostgreSQL querying");
  });

  it("throws LLM_OUTPUT_PARSE_ERROR when LLM returns invalid non-JSON string", async () => {
    const mockLlm: ILlmProvider = {
      name: "mock-llm",
      generateCompletion: vi.fn().mockResolvedValue("Sorry, I cannot extract requirements from this text."),
    };

    const service = new RequirementExtractionService(mockLlm);
    await expect(
      service.extractRequirements("Valid job description for software engineering role.")
    ).rejects.toThrow(/LLM_OUTPUT_PARSE_ERROR|Failed to parse/);
  });

  it("removes empty requirements and deduplicates identical texts", async () => {
    const mockLlm: ILlmProvider = {
      name: "mock-llm",
      generateCompletion: vi.fn().mockResolvedValue(
        JSON.stringify({
          requirements: [
            { text: "Node.js mastery", kind: "technical", priority: "must" },
            { text: "   ", kind: "technical", priority: "nice" },
            { text: "node.js mastery", kind: "technical", priority: "must" },
            { text: "Docker deployment", kind: "technical", priority: "nice" },
          ],
        })
      ),
    };

    const service = new RequirementExtractionService(mockLlm);
    const reqs = await service.extractRequirements("Node.js and Docker developer job description.");
    expect(reqs).toHaveLength(2);
    expect(reqs[0].id).toBe("r1");
    expect(reqs[0].text).toBe("Node.js mastery");
    expect(reqs[1].id).toBe("r2");
    expect(reqs[1].text).toBe("Docker deployment");
  });
});
