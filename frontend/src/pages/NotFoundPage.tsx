import React from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/ui/EmptyState.js";

export const NotFoundPage: React.FC = () => {
  return (
    <div style={{ maxWidth: "600px", margin: "var(--space-12) auto" }}>
      <EmptyState
        title="404 — Page Not Found"
        description="The page you are looking for does not exist or has been moved."
        icon={
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        }
        action={
          <Link to="/" className="btn btn-primary">
            Return to Home
          </Link>
        }
      />
    </div>
  );
};
