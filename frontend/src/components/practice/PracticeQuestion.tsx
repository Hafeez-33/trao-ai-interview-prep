import React from "react";
import { PracticeQuestionView, PracticeConfidenceLevel } from "@/types/practice.js";
import { ConfidenceSelector } from "./ConfidenceSelector.js";

export interface PracticeQuestionProps {
  question: PracticeQuestionView;
  isRevealed: boolean;
  onRevealAnswer: () => void;
  selectedConfidence: PracticeConfidenceLevel | null;
  onSelectConfidence: (confidence: PracticeConfidenceLevel) => void;
  isSubmitting?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  technical: "Technical",
  behavioural: "Behavioural",
  "system-design": "System Design",
  "company-fit": "Company Fit",
};

const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Foundational (1)",
  2: "Intermediate (2)",
  3: "Advanced (3)",
};

export const PracticeQuestion: React.FC<PracticeQuestionProps> = ({
  question,
  isRevealed,
  onRevealAnswer,
  selectedConfidence,
  onSelectConfidence,
  isSubmitting = false,
}) => {
  return (
    <div
      className="card"
      style={{
        padding: "var(--space-6)",
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      {/* Question Metadata Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-2)",
          marginBottom: "var(--space-4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: "var(--text-xs)",
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--bg-secondary)",
              color: "var(--text-primary)",
              fontWeight: 700,
              fontFamily: "var(--font-mono, monospace)",
            }}
          >
            {question.id}
          </span>

          <span
            style={{
              fontSize: "var(--text-xs)",
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--color-primary-subtle)",
              color: "var(--color-primary-light)",
              fontWeight: 600,
            }}
          >
            {CATEGORY_LABELS[question.category] || question.category}
          </span>

          <span
            style={{
              fontSize: "var(--text-xs)",
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--bg-secondary)",
              color: "var(--text-secondary)",
              fontWeight: 500,
            }}
          >
            {DIFFICULTY_LABELS[question.difficulty] || `Difficulty ${question.difficulty}`}
          </span>
        </div>

        {question.requirement_ids && question.requirement_ids.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
              Targets:
            </span>
            {question.requirement_ids.map((reqId) => (
              <span
                key={reqId}
                style={{
                  fontSize: "var(--text-xs)",
                  padding: "1px 6px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--bg-secondary)",
                  color: "var(--text-secondary)",
                  fontFamily: "var(--font-mono, monospace)",
                }}
              >
                {reqId}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Question Prompt */}
      <div style={{ marginBottom: "var(--space-6)" }}>
        <h2
          style={{
            fontSize: "var(--text-xl)",
            fontWeight: 600,
            color: "var(--text-primary)",
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          {question.prompt}
        </h2>
      </div>

      {/* Reveal Answer Section */}
      {!isRevealed ? (
        <div style={{ textAlign: "center", padding: "var(--space-4) 0" }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onRevealAnswer}
            aria-expanded={false}
            aria-controls="answer-outline-container"
            style={{
              padding: "var(--space-3) var(--space-6)",
              fontSize: "var(--text-base)",
              fontWeight: 600,
            }}
          >
            👁 Reveal Answer Outline
          </button>
        </div>
      ) : (
        <div
          id="answer-outline-container"
          style={{
            marginTop: "var(--space-4)",
            padding: "var(--space-5)",
            backgroundColor: "var(--bg-secondary)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              marginBottom: "var(--space-3)",
            }}
          >
            <span
              style={{
                fontSize: "var(--text-xs)",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--color-primary-light)",
              }}
            >
              Suggested Answer Outline
            </span>
          </div>

          <p
            style={{
              fontSize: "var(--text-base)",
              color: "var(--text-primary)",
              lineHeight: 1.6,
              margin: 0,
              whiteSpace: "pre-wrap",
            }}
          >
            {question.answer_outline}
          </p>

          <ConfidenceSelector
            selectedConfidence={selectedConfidence}
            onSelectConfidence={onSelectConfidence}
            disabled={isSubmitting}
          />
        </div>
      )}
    </div>
  );
};
