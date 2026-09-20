import { ILlmProvider } from "./types.js";
import { GeminiLlmProvider } from "./gemini.provider.js";
import { MockLlmProvider } from "./mock.provider.js";
import { config } from "../../config/env.js";

export * from "./types.js";
export * from "./gemini.provider.js";
export * from "./mock.provider.js";

let activeProvider: ILlmProvider | null = null;

/**
 * Returns the currently active LLM provider.
 * Defaults to GeminiLlmProvider if an API key is available or in production,
 * or MockLlmProvider during automated unit tests.
 */
export function getLlmProvider(): ILlmProvider {
  if (activeProvider) {
    return activeProvider;
  }

  if (config.nodeEnv === "test" || !config.llmApiKey) {
    activeProvider = new MockLlmProvider();
  } else {
    activeProvider = new GeminiLlmProvider();
  }

  return activeProvider;
}

/**
 * Allows injecting a custom or mock LLM provider (e.g. for testing).
 */
export function setLlmProvider(provider: ILlmProvider | null): void {
  activeProvider = provider;
}
