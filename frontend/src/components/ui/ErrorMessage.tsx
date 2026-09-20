import React from "react";

export interface ErrorMessageProps {
  message: string;
  title?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  title = "An error occurred",
  onRetry,
  className = "",
}) => {
  return (
    <div
      role="alert"
      className={`error-message-box ${className}`}
      style={{
        backgroundColor: "var(--color-error-bg)",
        border: "1px solid var(--color-error)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
        color: "var(--text-primary)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-error)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <strong style={{ color: "var(--color-error)", fontSize: "var(--text-sm)" }}>
          {title}
        </strong>
      </div>
      <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
        {message}
      </p>
      {onRetry && (
        <div style={{ marginTop: "var(--space-2)" }}>
          <button
            type="button"
            onClick={onRetry}
            className="btn btn-secondary"
            style={{ fontSize: "var(--text-xs)", padding: "var(--space-1) var(--space-3)" }}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};
