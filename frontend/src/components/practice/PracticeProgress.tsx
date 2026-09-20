import React from "react";

export interface PracticeProgressProps {
  total: number;
  completed: number;
  currentQuestionId: string | null;
}

export const PracticeProgress: React.FC<PracticeProgressProps> = ({
  total,
  completed,
  currentQuestionId,
}) => {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div
      className="card"
      style={{
        padding: "var(--space-4) var(--space-6)",
        marginBottom: "var(--space-6)",
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--space-2)",
          flexWrap: "wrap",
          gap: "var(--space-2)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span
            style={{
              fontWeight: 600,
              fontSize: "var(--text-sm)",
              color: "var(--text-primary)",
            }}
          >
            Practice Progress
          </span>
          {currentQuestionId && (
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
              Current: {currentQuestionId}
            </span>
          )}
        </div>

        <span
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
            fontWeight: 500,
          }}
          aria-live="polite"
        >
          {completed} of {total} Completed ({percentage}%)
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Interview questions practice progress"
        style={{
          height: "8px",
          width: "100%",
          backgroundColor: "var(--bg-secondary)",
          borderRadius: "var(--radius-full)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${percentage}%`,
            backgroundColor: "var(--color-primary-light)",
            borderRadius: "var(--radius-full)",
            transition: "width 0.3s ease-in-out",
          }}
        />
      </div>
    </div>
  );
};
