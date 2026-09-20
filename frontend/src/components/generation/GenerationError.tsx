import React from "react";

export interface GenerationErrorProps {
  failedStepTitle: string;
  errorCode?: string;
  errorMessage?: string;
  onRetry: () => void;
  isRetrying?: boolean;
}

/**
 * Maps structured backend error codes to helpful, user-friendly explanations.
 */
function getHumanFriendlyMessage(code?: string, rawMsg?: string): string {
  switch (code) {
    case "LLM_OUTPUT_PARSE_ERROR":
      return "The AI returned an invalid response format while generating content. Retrying usually resolves this.";
    case "UNCOVERED_MUST_REQUIREMENTS":
      return "Some must-have role requirements could not be paired with interview questions. Please retry generation.";
    case "COMPANY_UNREACHABLE":
      return "The company website could not be reached. Generation can continue using the Job Description alone.";
    case "LLM_RATE_LIMIT_EXCEEDED":
      return "AI service is currently busy handling high request volume. Please wait a moment and retry.";
    case "NO_CRAWL_DATA":
      return "No website content was collected. You can retry the crawl step or proceed with JD analysis.";
    case "TIMEOUT":
      return "The operation timed out while waiting for AI generation or website retrieval. Please try again.";
    case "NETWORK_ERROR":
      return "Network connection issue. Please check your internet connection and try again.";
    default:
      return rawMsg || "An unexpected error occurred during this pipeline step. Please try again.";
  }
}

export const GenerationError: React.FC<GenerationErrorProps> = ({
  failedStepTitle,
  errorCode,
  errorMessage,
  onRetry,
  isRetrying = false,
}) => {
  const friendlyMessage = getHumanFriendlyMessage(errorCode, errorMessage);

  return (
    <div
      role="alert"
      className="card"
      style={{
        backgroundColor: "var(--color-error-bg)",
        borderColor: "var(--color-error)",
        padding: "var(--space-6)",
        marginTop: "var(--space-6)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "var(--radius-full)",
            backgroundColor: "var(--color-error)",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          !
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: "var(--text-base)", color: "var(--color-error)", marginBottom: "var(--space-1)" }}>
            Step Failed: {failedStepTitle}
          </h3>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", marginBottom: "var(--space-4)" }}>
            {friendlyMessage}
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
            <button
              type="button"
              onClick={onRetry}
              disabled={isRetrying}
              className="btn btn-primary"
              style={{
                backgroundColor: "var(--color-error)",
                fontSize: "var(--text-sm)",
                padding: "var(--space-2) var(--space-4)",
              }}
            >
              {isRetrying ? "Retrying Step..." : "↻ Retry This Step"}
            </button>
            {errorCode && (
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                Code: {errorCode}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
