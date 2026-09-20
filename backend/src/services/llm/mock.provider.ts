import { ILlmProvider, LlmCompletionOptions } from "./types.js";

export type MockResponseHandler = (
  prompt: string,
  options?: LlmCompletionOptions
) => string | Promise<string>;

/**
 * Deterministic Mock LLM Provider for unit and integration testing.
 * Prevents network calls and avoids consuming LLM API quota during test runs.
 */
export class MockLlmProvider implements ILlmProvider {
  public readonly name = "mock";
  private responseHandler: MockResponseHandler | string;
  private shouldThrowError: Error | null = null;
  private callCount = 0;
  private lastPrompt: string | null = null;
  private lastOptions?: LlmCompletionOptions;

  constructor(defaultResponse?: string | MockResponseHandler) {
    this.responseHandler =
      defaultResponse ||
      ((prompt: string, options?: LlmCompletionOptions) => {
        if (
          options?.systemPrompt?.includes("company and interview research") ||
          prompt.includes("<source_page")
        ) {
          return JSON.stringify({
            company_name: "Example Corp",
            company_brief: {
              summary: "Example Corp develops cloud-native analytics platforms.",
              what_they_do: "They provide high-performance data processing software.",
              source_urls: ["http://127.0.0.1:64159/about"],
            },
            interview_research: {
              availability: "unavailable",
              summary: null,
              source_urls: [],
            },
          });
        }

        if (
          options?.systemPrompt?.includes("TARGETED interview questions") ||
          prompt.includes("<uncovered_requirements>")
        ) {
          const matches = [...prompt.matchAll(/ID:\s*([a-zA-Z0-9_-]+)/g)];
          const ids = Array.from(new Set(matches.map((m) => m[1])));
          const questions = ids.map((id) => ({
            requirement_ids: [id],
            category: "technical",
            prompt: `Targeted interview question covering requirement ${id}`,
            answer_outline: `Technical assessment and trade-offs for ${id}.`,
            difficulty: 2,
          }));
          return JSON.stringify({ questions });
        }

        if (
          options?.systemPrompt?.includes("interview preparation coach") ||
          prompt.includes("<requirements>")
        ) {
          return JSON.stringify({
            questions: [
              {
                requirement_ids: ["r1"],
                category: "technical",
                prompt: "How does the Node.js event loop handle asynchronous I/O and microtasks?",
                answer_outline: "Explain the libuv thread pool, phases of the event loop, process.nextTick, and Promise microtask queue.",
                difficulty: 2,
              },
              {
                requirement_ids: ["r2"],
                category: "system-design",
                prompt: "How would you architect a fault-tolerant distributed streaming pipeline for high-throughput events?",
                answer_outline: "Discuss partitioning, consumer groups, backpressure, exactly-once vs at-least-once delivery, and state checkpointing.",
                difficulty: 3,
              },
              {
                requirement_ids: ["r3"],
                category: "behavioural",
                prompt: "Tell me about a time you resolved a critical disagreement with cross-functional stakeholders regarding system architecture.",
                answer_outline: "Highlight the situation, objective data used, trade-off communication, consensus building, and project outcome.",
                difficulty: 1,
              },
              {
                requirement_ids: ["r4"],
                category: "company-fit",
                prompt: "How do you align your technical architecture decisions with business domain constraints in a fast-paced product environment?",
                answer_outline: "Discuss balancing technical debt with shipping velocity, domain-driven design, and customer feedback loops.",
                difficulty: 2,
              },
            ],
            flashcards: [
              {
                requirement_ids: ["r1"],
                front: "What is the difference between process.nextTick() and setImmediate() in Node.js?",
                back: "process.nextTick() fires immediately after the current operation before the event loop continues; setImmediate() executes on the check phase of the event loop.",
              },
              {
                requirement_ids: ["r2"],
                front: "What is backpressure in streaming systems?",
                back: "A mechanism that slows down the producer when the consumer cannot process data fast enough, preventing buffer overflow and memory exhaustion.",
              },
            ],
          });
        }
        return JSON.stringify({
          requirements: [
            {
              text: "Proficiency in Node.js and TypeScript",
              kind: "technical",
              priority: "must",
            },
            {
              text: "Experience designing distributed systems",
              kind: "technical",
              priority: "must",
            },
            {
              text: "Strong cross-functional communication",
              kind: "behavioural",
              priority: "nice",
            },
            {
              text: "Knowledge of financial compliance",
              kind: "domain",
              priority: "nice",
            },
          ],
        });
      });
  }

  public setMockResponse(response: string | MockResponseHandler): void {
    this.responseHandler = response;
  }

  public setShouldThrow(error: Error | null): void {
    this.shouldThrowError = error;
  }

  public getLastPrompt(): string | null {
    return this.lastPrompt;
  }

  public getLastOptions(): LlmCompletionOptions | undefined {
    return this.lastOptions;
  }

  public getCallCount(): number {
    return this.callCount;
  }

  public reset(): void {
    this.callCount = 0;
    this.lastPrompt = null;
    this.lastOptions = undefined;
    this.shouldThrowError = null;
  }

  public async generateCompletion(
    prompt: string,
    options?: LlmCompletionOptions
  ): Promise<string> {
    this.callCount++;
    this.lastPrompt = prompt;
    this.lastOptions = options;

    if (this.shouldThrowError) {
      throw this.shouldThrowError;
    }

    if (typeof this.responseHandler === "function") {
      return this.responseHandler(prompt, options);
    }

    return this.responseHandler;
  }
}
