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
