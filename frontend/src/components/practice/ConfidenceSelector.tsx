import React from "react";
import { PracticeConfidenceLevel } from "@/types/practice.js";

export interface ConfidenceSelectorProps {
  selectedConfidence: PracticeConfidenceLevel | null;
  onSelectConfidence: (confidence: PracticeConfidenceLevel) => void;
  disabled?: boolean;
}

interface ConfidenceOption {
  level: PracticeConfidenceLevel;
  label: string;
  description: string;
  icon: string;
}

const CONFIDENCE_OPTIONS: ConfidenceOption[] = [
  {
    level: 1,
    label: "1 — Low",
    description: "Struggled or needs significant review",
    icon: "△",
  },
  {
    level: 2,
    label: "2 — Medium",
    description: "Good understanding but needs polish",
    icon: "◇",
  },
  {
    level: 3,
    label: "3 — High",
    description: "Confident and fully articulated",
    icon: "○",
  },
];

export const ConfidenceSelector: React.FC<ConfidenceSelectorProps> = ({
  selectedConfidence,
  onSelectConfidence,
  disabled = false,
}) => {
  return (
    <div
      style={{
        marginTop: "var(--space-6)",
        paddingTop: "var(--space-6)",
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      <label
        id="confidence-selector-label"
        style={{
          display: "block",
          fontSize: "var(--text-sm)",
          fontWeight: 600,
          marginBottom: "var(--space-3)",
          color: "var(--text-primary)",
        }}
      >
        How confident do you feel answering this question?
      </label>

      <div
        role="group"
        aria-labelledby="confidence-selector-label"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "var(--space-3)",
        }}
      >
        {CONFIDENCE_OPTIONS.map((opt) => {
          const isSelected = selectedConfidence === opt.level;

          return (
            <button
              key={opt.level}
              type="button"
              disabled={disabled}
              onClick={() => onSelectConfidence(opt.level)}
              aria-pressed={isSelected}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                padding: "var(--space-3) var(--space-4)",
                borderRadius: "var(--radius-md)",
                border: isSelected
                  ? "2px solid var(--color-primary-light)"
                  : "1px solid var(--border-subtle)",
                backgroundColor: isSelected
                  ? "var(--color-primary-subtle)"
                  : "var(--color-surface)",
                color: "var(--text-primary)",
                cursor: disabled ? "not-allowed" : "pointer",
                textAlign: "left",
                transition: "all 0.15s ease",
                opacity: disabled ? 0.6 : 1,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  marginBottom: "var(--space-1)",
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: "var(--text-sm)",
                    color: isSelected
                      ? "var(--color-primary-light)"
                      : "var(--text-primary)",
                  }}
                >
                  {opt.icon} {opt.label}
                </span>
                {isSelected && (
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      fontWeight: 700,
                      color: "var(--color-primary-light)",
                    }}
                    aria-hidden="true"
                  >
                    ✓ Selected
                  </span>
                )}
              </div>

              <span
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--text-secondary)",
                  lineHeight: 1.4,
                }}
              >
                {opt.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
