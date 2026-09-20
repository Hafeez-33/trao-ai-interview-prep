import React from "react";
import { Link } from "react-router-dom";

export interface PracticeCompleteProps {
  totalQuestions: number;
  completedQuestions: number;
  onResetPractice: () => void;
  kitId: string;
  isResetting?: boolean;
}

export const PracticeComplete: React.FC<PracticeCompleteProps> = ({
  totalQuestions,
  completedQuestions,
  onResetPractice,
  kitId,
  isResetting = false,
}) => {
  return (
    <div
      className="card"
      style={{
        padding: "var(--space-10) var(--space-6)",
        textAlign: "center",
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-md)",
        maxWidth: "640px",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "64px",
          height: "64px",
          borderRadius: "var(--radius-full)",
          backgroundColor: "var(--color-success-bg, rgba(34, 197, 94, 0.1))",
          color: "var(--color-success, #22c55e)",
          fontSize: "32px",
          marginBottom: "var(--space-4)",
        }}
      >
        ✓
      </div>

      <h2
        style={{
          fontSize: "var(--text-2xl)",
          fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: "var(--space-2)",
        }}
      >
        Practice Session Complete!
      </h2>

      <p
        style={{
          fontSize: "var(--text-base)",
          color: "var(--text-secondary)",
          marginBottom: "var(--space-6)",
          lineHeight: 1.5,
        }}
      >
        You have practiced and recorded confidence for all{" "}
        <strong style={{ color: "var(--text-primary)" }}>
          {completedQuestions} of {totalQuestions}
        </strong>{" "}
        questions in this kit.
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "var(--space-4)",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="btn btn-primary"
          onClick={onResetPractice}
          disabled={isResetting}
          style={{
            minWidth: "160px",
            fontSize: "var(--text-sm)",
          }}
        >
          {isResetting ? "Resetting..." : "↺ Practice Again"}
        </button>

        <Link
          to={`/kits/${kitId}`}
          className="btn btn-secondary"
          style={{
            minWidth: "160px",
            fontSize: "var(--text-sm)",
          }}
        >
          ← Return to Kit
        </Link>
      </div>
    </div>
  );
};
