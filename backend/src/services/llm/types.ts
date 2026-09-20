/**
 * Options provided to the LLM completion call.
 */
export interface LlmCompletionOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  jsonMode?: boolean;
}

/**
 * Common abstraction for LLM providers (Gemini, Mock, etc.).
 */
export interface ILlmProvider {
  readonly name: string;
  generateCompletion(
    prompt: string,
    options?: LlmCompletionOptions
  ): Promise<string>;
}

/**
 * Structured error class for LLM operations.
 * Guaranteed never to leak API keys or secrets in error messages.
 */
export class LlmError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly isRetryable: boolean;

  constructor(
    message: string,
    code = "LLM_PROVIDER_ERROR",
    status = 500,
    isRetryable = false
  ) {
    // Sanitize any potential sensitive information
    const sanitized = message.replace(/key=[a-zA-Z0-9_\-]+/gi, "key=***");
    super(sanitized);
    this.name = "LlmError";
    this.code = code;
    this.status = status;
    this.isRetryable = isRetryable;
  }
}
