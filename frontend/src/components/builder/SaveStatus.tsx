import React from "react";

export type SaveState = "idle" | "unsaved" | "saving" | "saved" | "error";

export interface SaveStatusProps {
  status: SaveState;
  errorMessage?: string;
}

export const SaveStatus: React.FC<SaveStatusProps> = ({ status, errorMessage }) => {
  switch (status) {
    case "saving":
      return (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-2)",
            fontSize: "var(--text-xs)",
            color: "var(--color-primary-light)",
            fontWeight: 600,
          }}
        >
          <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
          <span>Saving...</span>
        </div>
      );
    case "saved":
      return (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-2)",
            fontSize: "var(--text-xs)",
            color: "var(--color-success)",
            fontWeight: 600,
          }}
        >
          <span>✓</span>
          <span>Saved</span>
        </div>
      );
    case "unsaved":
      return (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-2)",
            fontSize: "var(--text-xs)",
            color: "var(--color-warning)",
            fontWeight: 600,
          }}
        >
          <span>●</span>
          <span>Unsaved changes</span>
        </div>
      );
    case "error":
      return (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-2)",
            fontSize: "var(--text-xs)",
            color: "var(--color-error)",
            fontWeight: 600,
          }}
        >
          <span>✕</span>
          <span>Save failed{errorMessage ? `: ${errorMessage}` : ""}</span>
        </div>
      );
    case "idle":
    default:
      return null;
  }
};
