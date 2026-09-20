import { ILlmProvider, LlmCompletionOptions, LlmError } from "./types.js";
import { config } from "../../config/env.js";

const DEFAULT_GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_TIMEOUT_MS = 25000;

export class GeminiLlmProvider implements ILlmProvider {
  public readonly name = "gemini";
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseEndpoint: string;

  constructor(apiKey?: string, model?: string, endpoint?: string) {
    this.apiKey = (apiKey || config.llmApiKey || "").trim();
    this.model = (model || config.geminiModel || "gemini-2.5-flash").trim();
    this.baseEndpoint = (endpoint || DEFAULT_GEMINI_ENDPOINT).replace(/\/+$/, "");
  }

  public async generateCompletion(
    prompt: string,
    options?: LlmCompletionOptions
  ): Promise<string> {
    if (!this.apiKey) {
      throw new LlmError(
        "LLM API key is not configured. Please set LLM_API_KEY in the environment.",
        "LLM_API_KEY_MISSING",
        500
      );
    }

    const timeoutMs = options?.timeoutMs || DEFAULT_TIMEOUT_MS;
    const url = `${this.baseEndpoint}/${encodeURIComponent(this.model)}:generateContent`;

    const requestBody: Record<string, unknown> = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: options?.temperature !== undefined ? options.temperature : 0.2,
        ...(options?.maxTokens ? { maxOutputTokens: options.maxTokens } : {}),
        ...(options?.jsonMode ? { responseMimeType: "application/json" } : {}),
      },
    };

    if (options?.systemPrompt) {
      requestBody.systemInstruction = {
        parts: [{ text: options.systemPrompt }],
      };
    }

    let controller: AbortController | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      controller = new AbortController();
      timeoutId = setTimeout(() => controller?.abort(), timeoutMs);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorDetails = "";
        try {
          const errJson = (await response.json()) as any;
          errorDetails = errJson?.error?.message || "";
        } catch {
          errorDetails = `HTTP ${response.status} ${response.statusText}`;
        }

        // Sanitize any potential API key leakage in provider error responses
        const safeError = errorDetails.replace(/key=[a-zA-Z0-9_\-]+/gi, "key=***");

        if (response.status === 429) {
          throw new LlmError(
            `Gemini rate limit exceeded: ${safeError}`,
            "LLM_RATE_LIMIT_EXCEEDED",
            429,
            true
          );
        }

        if (response.status === 400) {
          throw new LlmError(
            `Invalid Gemini request: ${safeError}`,
            "LLM_PROVIDER_ERROR",
            400,
            false
          );
        }

        throw new LlmError(
          `Gemini API error (${response.status}): ${safeError}`,
          "LLM_PROVIDER_ERROR",
          response.status >= 500 ? 503 : response.status,
          response.status >= 500
        );
      }

      const data = (await response.json()) as any;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (typeof text !== "string") {
        const finishReason = data?.candidates?.[0]?.finishReason;
        throw new LlmError(
          `Gemini returned empty or blocked output (finishReason: ${finishReason || "unknown"}).`,
          "LLM_OUTPUT_PARSE_ERROR",
          500
        );
      }

      return text;
    } catch (error: unknown) {
      if (error instanceof LlmError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new LlmError(
          `Gemini request timed out after ${timeoutMs}ms.`,
          "LLM_TIMEOUT",
          504,
          true
        );
      }

      const rawMessage = error instanceof Error ? error.message : "Unknown network error";
      const safeMessage = rawMessage.replace(/key=[a-zA-Z0-9_\-]+/gi, "key=***");
      throw new LlmError(
        `Failed to connect to Gemini API: ${safeMessage}`,
        "LLM_PROVIDER_ERROR",
        500
      );
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}
