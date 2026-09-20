import React from "react";

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  className = "",
}) => {
  return (
    <div
      className={`empty-state-box card ${className}`}
      style={{
        textAlign: "center",
        padding: "var(--space-12) var(--space-6)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-4)",
      }}
    >
      {icon && (
        <div
          style={{
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </div>
      )}
      <div style={{ maxWidth: "400px" }}>
        <h3 style={{ marginBottom: "var(--space-2)", fontSize: "var(--text-lg)" }}>
          {title}
        </h3>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          {description}
        </p>
      </div>
      {action && <div style={{ marginTop: "var(--space-2)" }}>{action}</div>}
    </div>
  );
};
