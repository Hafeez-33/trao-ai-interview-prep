import React, { useEffect, useRef } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner.js";
import { ErrorMessage } from "@/components/ui/ErrorMessage.js";

export interface DeleteKitDialogProps {
  isOpen: boolean;
  kitRole: string;
  kitCompany: string;
  isDeleting: boolean;
  deleteError: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteKitDialog: React.FC<DeleteKitDialogProps> = ({
  isOpen,
  kitRole,
  kitCompany,
  isDeleting,
  deleteError,
  onConfirm,
  onCancel,
}) => {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Focus cancel button for safety
      cancelButtonRef.current?.focus();

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" && !isDeleting) {
          onCancel();
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, isDeleting, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: "var(--space-4)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) {
          onCancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-desc"
        className="card"
        style={{
          maxWidth: "480px",
          width: "100%",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          boxShadow: "var(--shadow-lg)",
          padding: "var(--space-6)",
          borderRadius: "var(--radius-lg)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            marginBottom: "var(--space-4)",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "var(--radius-full)",
              backgroundColor: "var(--color-error-bg)",
              color: "var(--color-error)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg
              width="20"
              height="20"
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
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </div>
          <div>
            <h2
              id="delete-dialog-title"
              style={{
                fontSize: "var(--text-lg)",
                margin: 0,
                color: "var(--text-primary)",
              }}
            >
              Delete this interview prep Kit?
            </h2>
            <p
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--text-muted)",
                margin: "var(--space-1) 0 0 0",
              }}
            >
              {kitRole} at {kitCompany}
            </p>
          </div>
        </div>

        <p
          id="delete-dialog-desc"
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
            lineHeight: "var(--leading-relaxed)",
            marginBottom: "var(--space-6)",
          }}
        >
          This action cannot be undone. Deleting this preparation Kit permanently removes all extracted requirements, questions, flashcards, and schedule progress.
        </p>

        {deleteError && (
          <div style={{ marginBottom: "var(--space-4)" }}>
            <ErrorMessage
              title="Failed to Delete Kit"
              message={deleteError}
            />
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "var(--space-3)",
          }}
        >
          <button
            ref={cancelButtonRef}
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            style={{
              backgroundColor: "var(--color-error)",
              color: "#ffffff",
              fontWeight: 600,
            }}
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <LoadingSpinner size="sm" label="Deleting kit..." />
                <span>Deleting...</span>
              </>
            ) : (
              "Delete Kit"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
