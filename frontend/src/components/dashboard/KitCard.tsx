import React from "react";
import { Link } from "react-router-dom";
import { SafeKitSummary, GenerationStatus } from "@/types/kit.js";

export interface KitCardProps {
  kit: SafeKitSummary;
  onDelete: (kit: SafeKitSummary) => void;
}

interface StatusConfig {
  label: string;
  icon: React.ReactNode;
  bg: string;
  color: string;
  border: string;
}

function getStatusConfig(status: GenerationStatus): StatusConfig {
  switch (status) {
    case "completed":
      return {
        label: "Completed",
        icon: (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ),
        bg: "var(--color-success-bg)",
        color: "var(--color-success)",
        border: "rgba(16, 185, 129, 0.3)",
      };
    case "generating":
      return {
        label: "Generating",
        icon: (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        ),
        bg: "var(--color-primary-subtle)",
        color: "var(--color-primary-light)",
        border: "rgba(99, 102, 241, 0.3)",
      };
    case "crawling":
      return {
        label: "Crawling",
        icon: (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        ),
        bg: "var(--color-info-bg)",
        color: "var(--color-info)",
        border: "rgba(59, 130, 246, 0.3)",
      };
    case "failed":
      return {
        label: "Generation failed",
        icon: (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        ),
        bg: "var(--color-error-bg)",
        color: "var(--color-error)",
        border: "rgba(239, 68, 68, 0.3)",
      };
    case "pending":
    default:
      return {
        label: "Pending",
        icon: (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        ),
        bg: "var(--color-warning-bg)",
        color: "var(--color-warning)",
        border: "rgba(245, 158, 11, 0.3)",
      };
  }
}

export const KitCard: React.FC<KitCardProps> = ({ kit, onDelete }) => {
  const roleTitle = kit.role || "Untitled Role";
  const company = kit.company || "Target Company";
  const statusConfig = getStatusConfig(kit.status);
  const isCompleted = kit.status === "completed";
  const isFailed = kit.status === "failed";

  const formattedDate = kit.createdAt
    ? new Date(kit.createdAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Recently created";

  return (
    <article
      className="card kit-card"
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        transition: "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
        position: "relative",
      }}
    >
      <div>
        {/* Card Header: Company & Status Badge */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "var(--space-2)",
            marginBottom: "var(--space-3)",
          }}
        >
          <span
            style={{
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {company}
          </span>

          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "3px 8px",
              borderRadius: "var(--radius-full)",
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              backgroundColor: statusConfig.bg,
              color: statusConfig.color,
              border: `1px solid ${statusConfig.border}`,
            }}
          >
            {statusConfig.icon}
            <span>{statusConfig.label}</span>
          </span>
        </div>

        {/* Role Title */}
        <h3
          style={{
            fontSize: "var(--text-lg)",
            marginBottom: "var(--space-2)",
            color: "var(--text-primary)",
            lineHeight: "var(--leading-tight)",
          }}
        >
          {roleTitle}
        </h3>

        {/* Meta / Date */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            fontSize: "var(--text-xs)",
            color: "var(--text-muted)",
            marginBottom: "var(--space-6)",
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span>Created {formattedDate}</span>
        </div>
      </div>

      {/* Card Actions */}
      <div
        style={{
          borderTop: "1px solid var(--border-subtle)",
          paddingTop: "var(--space-4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-2)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
          {isCompleted ? (
            <>
              <Link
                to={`/kits/${kit._id}`}
                className="btn btn-primary"
                style={{
                  fontSize: "var(--text-xs)",
                  padding: "var(--space-2) var(--space-3)",
                }}
              >
                Open Kit
              </Link>
              <Link
                to={`/kits/${kit._id}/practice`}
                className="btn btn-secondary"
                style={{
                  fontSize: "var(--text-xs)",
                  padding: "var(--space-2) var(--space-3)",
                }}
              >
                Practice
              </Link>
              <Link
                to={`/kits/${kit._id}/builder`}
                className="btn btn-secondary"
                style={{
                  fontSize: "var(--text-xs)",
                  padding: "var(--space-2) var(--space-3)",
                }}
              >
                Edit
              </Link>
            </>
          ) : isFailed ? (
            <Link
              to={`/kits/${kit._id}/generate`}
              className="btn btn-primary"
              style={{
                fontSize: "var(--text-xs)",
                padding: "var(--space-2) var(--space-3)",
                backgroundColor: "var(--color-error)",
              }}
            >
              Retry / Continue
            </Link>
          ) : (
            <Link
              to={`/kits/${kit._id}/generate`}
              className="btn btn-primary"
              style={{
                fontSize: "var(--text-xs)",
                padding: "var(--space-2) var(--space-3)",
              }}
            >
              Continue Preparation
            </Link>
          )}
        </div>

        {/* Delete Action */}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onDelete(kit)}
          aria-label={`Delete ${roleTitle} kit`}
          style={{
            fontSize: "var(--text-xs)",
            padding: "var(--space-2) var(--space-3)",
            color: "var(--text-muted)",
            borderColor: "transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--color-error)";
            e.currentTarget.style.borderColor = "var(--color-error-bg)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-muted)";
            e.currentTarget.style.borderColor = "transparent";
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          <span>Delete</span>
        </button>
      </div>
    </article>
  );
};
