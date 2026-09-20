import React from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner.js";

export type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export interface GenerationStepProps {
  stepNumber: number;
  title: string;
  description: string;
  status: StepStatus;
}

export const GenerationStep: React.FC<GenerationStepProps> = ({
  stepNumber,
  title,
  description,
  status,
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case "completed":
        return (
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "var(--radius-full)",
              backgroundColor: "var(--color-success)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: "var(--text-sm)",
            }}
          >
            ✓
          </div>
        );
      case "running":
        return (
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "var(--radius-full)",
              backgroundColor: "var(--color-primary-subtle)",
              color: "var(--color-primary-light)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LoadingSpinner size="sm" label={`Running step ${stepNumber}: ${title}`} />
          </div>
        );
      case "failed":
        return (
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "var(--radius-full)",
              backgroundColor: "var(--color-error)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: "var(--text-sm)",
            }}
          >
            ✕
          </div>
        );
      case "skipped":
        return (
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "var(--radius-full)",
              backgroundColor: "var(--bg-surface-raised)",
              color: "var(--text-muted)",
              border: "1px dashed var(--border-default)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "var(--text-xs)",
            }}
          >
            —
          </div>
        );
      case "pending":
      default:
        return (
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "var(--radius-full)",
              backgroundColor: "var(--bg-surface-raised)",
              color: "var(--text-muted)",
              border: "1px solid var(--border-default)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
              fontSize: "var(--text-xs)",
            }}
          >
            {stepNumber}
          </div>
        );
    }
  };

  const isCurrent = status === "running";
  const isFailed = status === "failed";
  const isCompleted = status === "completed";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--space-4)",
        padding: "var(--space-3) var(--space-4)",
        borderRadius: "var(--radius-md)",
        backgroundColor: isCurrent
          ? "var(--color-primary-subtle)"
          : isFailed
          ? "var(--color-error-bg)"
          : "transparent",
        border: isCurrent
          ? "1px solid var(--color-primary-light)"
          : isFailed
          ? "1px solid var(--color-error)"
          : "1px solid transparent",
        transition: "all 0.2s ease-in-out",
      }}
    >
      <div style={{ flexShrink: 0, marginTop: "2px" }}>{getStatusIcon()}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <h4
            style={{
              fontSize: "var(--text-base)",
              fontWeight: 600,
              color: isCompleted
                ? "var(--text-primary)"
                : isCurrent
                ? "var(--color-primary-light)"
                : isFailed
                ? "var(--color-error)"
                : "var(--text-secondary)",
            }}
          >
            {title}
          </h4>
          {status === "skipped" && (
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>(Optional / Skipped)</span>
          )}
        </div>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "2px", margin: 0 }}>
          {description}
        </p>
      </div>
    </div>
  );
};
