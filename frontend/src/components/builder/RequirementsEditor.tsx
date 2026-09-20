import React, { useState } from "react";
import { KitRequirement, RequirementKind, RequirementPriority } from "@/types/kit.js";

export interface RequirementsEditorProps {
  requirements: KitRequirement[];
  onChange: (updatedRequirements: KitRequirement[]) => void;
}

export const RequirementsEditor: React.FC<RequirementsEditorProps> = ({
  requirements,
  onChange,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editKind, setEditKind] = useState<RequirementKind>("technical");
  const [editPriority, setEditPriority] = useState<RequirementPriority>("must");
  const [validationError, setValidationError] = useState<string | null>(null);

  const startEditing = (req: KitRequirement) => {
    setEditingId(req.id);
    setEditText(req.text);
    setEditKind(req.kind);
    setEditPriority(req.priority);
    setValidationError(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setValidationError(null);
  };

  const saveEditing = (id: string) => {
    if (!editText.trim()) {
      setValidationError("Requirement text cannot be empty.");
      return;
    }

    const updated = requirements.map((req) => {
      if (req.id === id) {
        return {
          ...req,
          text: editText.trim(),
          kind: editKind,
          priority: editPriority,
        };
      }
      return req;
    });

    onChange(updated);
    setEditingId(null);
    setValidationError(null);
  };

  return (
    <section aria-labelledby="requirements-editor-heading" className="card" style={{ marginBottom: "var(--space-6)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
        <div>
          <h2 id="requirements-editor-heading" style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-1)" }}>
            Role Requirements ({requirements.length})
          </h2>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", margin: 0 }}>
            Extracted from the job description. Edit text, classification, or priority below.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {requirements.map((req) => {
          const isEditing = editingId === req.id;

          if (isEditing) {
            return (
              <div
                key={req.id}
                style={{
                  padding: "var(--space-4)",
                  backgroundColor: "var(--bg-canvas)",
                  border: "1px solid var(--color-primary)",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--text-xs)",
                      fontWeight: 700,
                      color: "var(--color-primary-light)",
                    }}
                  >
                    ID: {req.id} (Read-only)
                  </span>
                </div>

                {validationError && (
                  <div
                    role="alert"
                    style={{
                      padding: "var(--space-2) var(--space-3)",
                      backgroundColor: "var(--color-error-bg)",
                      color: "var(--color-error)",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "var(--text-xs)",
                      marginBottom: "var(--space-3)",
                    }}
                  >
                    {validationError}
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: "var(--space-3)" }}>
                  <label htmlFor={`edit-req-text-${req.id}`} className="form-label" style={{ fontSize: "var(--text-xs)" }}>
                    Requirement Description
                  </label>
                  <textarea
                    id={`edit-req-text-${req.id}`}
                    className="form-input"
                    rows={2}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    style={{ fontSize: "var(--text-sm)", resize: "vertical" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor={`edit-req-kind-${req.id}`} className="form-label" style={{ fontSize: "var(--text-xs)" }}>
                      Kind
                    </label>
                    <select
                      id={`edit-req-kind-${req.id}`}
                      className="form-input"
                      value={editKind}
                      onChange={(e) => setEditKind(e.target.value as RequirementKind)}
                      style={{ fontSize: "var(--text-xs)" }}
                    >
                      <option value="technical">Technical</option>
                      <option value="behavioural">Behavioural</option>
                      <option value="domain">Domain</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor={`edit-req-priority-${req.id}`} className="form-label" style={{ fontSize: "var(--text-xs)" }}>
                      Priority
                    </label>
                    <select
                      id={`edit-req-priority-${req.id}`}
                      className="form-input"
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value as RequirementPriority)}
                      style={{ fontSize: "var(--text-xs)" }}
                    >
                      <option value="must">Must-Have (Required)</option>
                      <option value="nice">Nice-to-Have (Optional)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)" }}>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="btn btn-secondary"
                    style={{ fontSize: "var(--text-xs)", padding: "var(--space-1) var(--space-3)" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => saveEditing(req.id)}
                    className="btn btn-primary"
                    style={{ fontSize: "var(--text-xs)", padding: "var(--space-1) var(--space-3)" }}
                  >
                    Apply Edit
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={req.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "var(--space-4)",
                padding: "var(--space-3) var(--space-4)",
                backgroundColor: "var(--bg-canvas)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", marginBottom: "4px" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--text-xs)",
                      fontWeight: 700,
                      color: "var(--text-muted)",
                    }}
                  >
                    {req.id}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      padding: "1px 6px",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: req.priority === "must" ? "var(--color-error-bg)" : "var(--bg-surface-raised)",
                      color: req.priority === "must" ? "var(--color-error)" : "var(--text-muted)",
                      fontWeight: 600,
                    }}
                  >
                    {req.priority === "must" ? "Must-Have" : "Nice-to-Have"}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      padding: "1px 6px",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: "var(--color-primary-subtle)",
                      color: "var(--color-primary-light)",
                      fontWeight: 600,
                      textTransform: "capitalize",
                    }}
                  >
                    {req.kind}
                  </span>
                </div>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", margin: 0 }}>
                  {req.text}
                </p>
              </div>

              <button
                type="button"
                onClick={() => startEditing(req)}
                className="btn btn-secondary"
                style={{ fontSize: "var(--text-xs)", padding: "var(--space-1) var(--space-3)", flexShrink: 0 }}
                aria-label={`Edit requirement ${req.id}`}
              >
                Edit
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};
