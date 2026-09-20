import React from "react";
import { Link } from "react-router-dom";

export interface DashboardHeaderProps {
  totalKits?: number;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ totalKits }) => {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "var(--space-4)",
        marginBottom: "var(--space-8)",
        paddingBottom: "var(--space-6)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <h1 style={{ fontSize: "var(--text-3xl)", margin: 0 }}>
            Interview Prep Dashboard
          </h1>
          {totalKits !== undefined && totalKits > 0 && (
            <span
              style={{
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: "var(--radius-full)",
                backgroundColor: "var(--color-primary-subtle)",
                color: "var(--color-primary-light)",
              }}
            >
              {totalKits} {totalKits === 1 ? "Kit" : "Kits"}
            </span>
          )}
        </div>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "var(--text-sm)",
            marginTop: "var(--space-2)",
            marginBottom: 0,
          }}
        >
          Manage your personalized interview preparation kits, monitor pipeline status, and launch practice sessions.
        </p>
      </div>

      <div>
        <Link
          to="/kits/new"
          id="dashboard-create-kit-cta"
          className="btn btn-primary"
          style={{
            padding: "var(--space-2) var(--space-4)",
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-2)",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Create New Kit</span>
        </Link>
      </div>
    </header>
  );
};
