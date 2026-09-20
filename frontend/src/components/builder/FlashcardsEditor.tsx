import React, { useState } from "react";
import { InternalKitFlashcard, KitRequirement } from "@/types/kit.js";

export interface FlashcardsEditorProps {
  flashcards: InternalKitFlashcard[];
  requirements: KitRequirement[];
  onChange: (updatedFlashcards: InternalKitFlashcard[]) => void;
}

export const FlashcardsEditor: React.FC<FlashcardsEditorProps> = ({
  flashcards,
  requirements,
  onChange,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Edit state
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");
  const [editReqIds, setEditReqIds] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // New flashcard state
  const [newFront, setNewFront] = useState("");
  const [newBack, setNewBack] = useState("");
  const [newReqIds, setNewReqIds] = useState<string[]>([]);
  const [newValidationError, setNewValidationError] = useState<string | null>(null);

  const startEditing = (f: InternalKitFlashcard) => {
    setEditingId(f.id);
    setEditFront(f.front);
    setEditBack(f.back);
    setEditReqIds([...f.requirement_ids]);
    setValidationError(null);
    setIsAddingNew(false);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setValidationError(null);
  };

  const toggleReqId = (reqId: string, currentList: string[], setter: (v: string[]) => void) => {
    if (currentList.includes(reqId)) {
      setter(currentList.filter((id) => id !== reqId));
    } else {
      setter([...currentList, reqId]);
    }
  };

  const saveEditing = (id: string) => {
    if (!editFront.trim()) {
      setValidationError("Flashcard front/prompt cannot be empty.");
      return;
    }
    if (!editBack.trim()) {
      setValidationError("Flashcard back/answer cannot be empty.");
      return;
    }
    if (editReqIds.length === 0) {
      setValidationError("Flashcard must reference at least one requirement.");
      return;
    }

    const updated = flashcards.map((f) => {
      if (f.id === id) {
        return {
          ...f,
          front: editFront.trim(),
          back: editBack.trim(),
          requirement_ids: editReqIds,
          is_edited: true,
        };
      }
      return f;
    });

    onChange(updated);
    setEditingId(null);
    setValidationError(null);
  };

  const moveFlashcard = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= flashcards.length) return;

    const list = [...flashcards];
    const [moved] = list.splice(index, 1);
    list.splice(targetIndex, 0, moved);

    const reordered = list.map((item, idx) => ({
      ...item,
      order: idx + 1,
    }));

    onChange(reordered);
  };

  const deleteFlashcard = (id: string) => {
    if (window.confirm("Are you sure you want to remove this flashcard?")) {
      const filtered = flashcards.filter((f) => f.id !== id);
      onChange(filtered);
    }
  };

  const handleAddCustomFlashcard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFront.trim()) {
      setNewValidationError("Flashcard front/prompt cannot be empty.");
      return;
    }
    if (!newBack.trim()) {
      setNewValidationError("Flashcard back/answer cannot be empty.");
      return;
    }
    if (newReqIds.length === 0) {
      setNewValidationError("Flashcard must reference at least one requirement.");
      return;
    }

    // Determine next sequential ID
    let maxIdNum = flashcards.reduce((max, f) => {
      const num = parseInt(f.id.replace(/^f/, ""), 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    const nextId = `f${maxIdNum + 1}`;

    const newCard: InternalKitFlashcard = {
      id: nextId,
      front: newFront.trim(),
      back: newBack.trim(),
      requirement_ids: newReqIds,
      is_custom: true,
      is_edited: false,
      order: flashcards.length + 1,
    };

    onChange([...flashcards, newCard]);

    // Reset form
    setNewFront("");
    setNewBack("");
    setNewReqIds([]);
    setIsAddingNew(false);
    setNewValidationError(null);
  };

  return (
    <section aria-labelledby="flashcards-editor-heading" className="card" style={{ marginBottom: "var(--space-6)" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--space-4)",
          flexWrap: "wrap",
          gap: "var(--space-2)",
        }}
      >
        <div>
          <h2 id="flashcards-editor-heading" style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-1)" }}>
            Study Flashcards ({flashcards.length})
          </h2>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", margin: 0 }}>
            Front/back review cards for quick conceptual recall and technical definitions.
          </p>
        </div>

        {!isAddingNew && (
          <button
            type="button"
            onClick={() => {
              setIsAddingNew(true);
              setEditingId(null);
            }}
            className="btn btn-primary"
            style={{ fontSize: "var(--text-xs)", padding: "var(--space-2) var(--space-3)" }}
          >
            + Add Custom Flashcard
          </button>
        )}
      </div>

      {/* Add Custom Flashcard Form */}
      {isAddingNew && (
        <form
          onSubmit={handleAddCustomFlashcard}
          style={{
            padding: "var(--space-4)",
            backgroundColor: "var(--bg-canvas)",
            border: "1px solid var(--color-primary-light)",
            borderRadius: "var(--radius-md)",
            marginBottom: "var(--space-4)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
            <h3 style={{ fontSize: "var(--text-sm)", margin: 0, color: "var(--color-primary-light)" }}>
              Create Custom Flashcard
            </h3>
            <span
              style={{
                fontSize: "var(--text-xs)",
                padding: "2px 6px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--color-primary-subtle)",
                color: "var(--color-primary-light)",
                fontWeight: 600,
              }}
            >
              Custom Item
            </span>
          </div>

          {newValidationError && (
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
              {newValidationError}
            </div>
          )}

          <div className="form-group" style={{ marginBottom: "var(--space-3)" }}>
            <label htmlFor="new-f-front" className="form-label" style={{ fontSize: "var(--text-xs)" }}>
              Front (Prompt / Term) <span style={{ color: "var(--color-error)" }}>*</span>
            </label>
            <input
              id="new-f-front"
              type="text"
              className="form-input"
              value={newFront}
              onChange={(e) => setNewFront(e.target.value)}
              placeholder="e.g. What is the CAP Theorem?"
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: "var(--space-3)" }}>
            <label htmlFor="new-f-back" className="form-label" style={{ fontSize: "var(--text-xs)" }}>
              Back (Answer / Explanation) <span style={{ color: "var(--color-error)" }}>*</span>
            </label>
            <textarea
              id="new-f-back"
              className="form-input"
              rows={3}
              value={newBack}
              onChange={(e) => setNewBack(e.target.value)}
              placeholder="Consistency, Availability, Partition tolerance: a distributed system can guarantee at most two..."
              required
            />
          </div>

          {/* Requirement Selection Checklist */}
          <div className="form-group" style={{ marginBottom: "var(--space-4)" }}>
            <label className="form-label" style={{ fontSize: "var(--text-xs)" }}>
              Mapped Role Requirements <span style={{ color: "var(--color-error)" }}>*</span>
            </label>
            <div
              style={{
                maxHeight: "120px",
                overflowY: "auto",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                padding: "var(--space-2)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-1)",
              }}
            >
              {requirements.map((r) => (
                <label
                  key={r.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    fontSize: "var(--text-xs)",
                    cursor: "pointer",
                    padding: "2px 4px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={newReqIds.includes(r.id)}
                    onChange={() => toggleReqId(r.id, newReqIds, setNewReqIds)}
                  />
                  <strong style={{ color: "var(--color-primary-light)" }}>{r.id}</strong>: {r.text}
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)" }}>
            <button
              type="button"
              onClick={() => {
                setIsAddingNew(false);
                setNewValidationError(null);
              }}
              className="btn btn-secondary"
              style={{ fontSize: "var(--text-xs)", padding: "var(--space-1) var(--space-3)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ fontSize: "var(--text-xs)", padding: "var(--space-1) var(--space-3)" }}
            >
              Add Flashcard
            </button>
          </div>
        </form>
      )}

      {/* Flashcards List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {flashcards.map((f, idx) => {
          const isEditing = editingId === f.id;

          if (isEditing) {
            return (
              <div
                key={f.id}
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
                    ID: {f.id} (Read-only)
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
                  <label htmlFor={`edit-f-front-${f.id}`} className="form-label" style={{ fontSize: "var(--text-xs)" }}>
                    Front (Prompt / Term)
                  </label>
                  <input
                    id={`edit-f-front-${f.id}`}
                    type="text"
                    className="form-input"
                    value={editFront}
                    onChange={(e) => setEditFront(e.target.value)}
                    style={{ fontSize: "var(--text-sm)" }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: "var(--space-3)" }}>
                  <label htmlFor={`edit-f-back-${f.id}`} className="form-label" style={{ fontSize: "var(--text-xs)" }}>
                    Back (Answer / Explanation)
                  </label>
                  <textarea
                    id={`edit-f-back-${f.id}`}
                    className="form-input"
                    rows={3}
                    value={editBack}
                    onChange={(e) => setEditBack(e.target.value)}
                    style={{ fontSize: "var(--text-sm)" }}
                  />
                </div>

                {/* Requirement Selection Checklist */}
                <div className="form-group" style={{ marginBottom: "var(--space-4)" }}>
                  <label className="form-label" style={{ fontSize: "var(--text-xs)" }}>
                    Mapped Role Requirements
                  </label>
                  <div
                    style={{
                      maxHeight: "120px",
                      overflowY: "auto",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-sm)",
                      padding: "var(--space-2)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--space-1)",
                    }}
                  >
                    {requirements.map((r) => (
                      <label
                        key={r.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-2)",
                          fontSize: "var(--text-xs)",
                          cursor: "pointer",
                          padding: "2px 4px",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={editReqIds.includes(r.id)}
                          onChange={() => toggleReqId(r.id, editReqIds, setEditReqIds)}
                        />
                        <strong style={{ color: "var(--color-primary-light)" }}>{r.id}</strong>: {r.text}
                      </label>
                    ))}
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
                    onClick={() => saveEditing(f.id)}
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
              key={f.id}
              style={{
                padding: "var(--space-3) var(--space-4)",
                backgroundColor: "var(--bg-canvas)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-2)" }}>
                <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--text-xs)",
                      fontWeight: 700,
                      color: "var(--text-muted)",
                    }}
                  >
                    {f.id}
                  </span>
                  {f.is_custom && (
                    <span
                      style={{
                        fontSize: "var(--text-xs)",
                        padding: "1px 6px",
                        borderRadius: "var(--radius-sm)",
                        backgroundColor: "var(--color-primary-subtle)",
                        color: "var(--color-primary-light)",
                        fontWeight: 600,
                      }}
                    >
                      Custom
                    </span>
                  )}
                  {f.is_edited && (
                    <span
                      style={{
                        fontSize: "var(--text-xs)",
                        padding: "1px 6px",
                        borderRadius: "var(--radius-sm)",
                        backgroundColor: "var(--bg-surface-raised)",
                        color: "var(--text-muted)",
                        fontWeight: 600,
                      }}
                    >
                      Edited
                    </span>
                  )}
                </div>

                {/* Controls */}
                <div style={{ display: "flex", gap: "var(--space-1)", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => moveFlashcard(idx, "up")}
                    disabled={idx === 0}
                    className="btn btn-secondary"
                    style={{ fontSize: "var(--text-xs)", padding: "2px 6px" }}
                    aria-label={`Move flashcard ${f.id} up`}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => moveFlashcard(idx, "down")}
                    disabled={idx === flashcards.length - 1}
                    className="btn btn-secondary"
                    style={{ fontSize: "var(--text-xs)", padding: "2px 6px" }}
                    aria-label={`Move flashcard ${f.id} down`}
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    onClick={() => startEditing(f)}
                    className="btn btn-secondary"
                    style={{ fontSize: "var(--text-xs)", padding: "2px 8px" }}
                    aria-label={`Edit flashcard ${f.id}`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteFlashcard(f.id)}
                    className="btn btn-secondary"
                    style={{ fontSize: "var(--text-xs)", padding: "2px 8px", color: "var(--color-error)" }}
                    aria-label={`Delete flashcard ${f.id}`}
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: "var(--space-2)" }}>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 700, marginBottom: "2px" }}>
                  FRONT / PROMPT:
                </div>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", margin: 0 }}>
                  {f.front}
                </p>
              </div>

              <div style={{ marginBottom: "var(--space-2)" }}>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 700, marginBottom: "2px" }}>
                  BACK / ANSWER:
                </div>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", margin: 0 }}>
                  {f.back}
                </p>
              </div>

              <div style={{ display: "flex", gap: "var(--space-1)", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Requirements:</span>
                {f.requirement_ids.map((rid) => (
                  <span
                    key={rid}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--text-xs)",
                      padding: "1px 4px",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: "var(--bg-surface-raised)",
                      color: "var(--color-primary-light)",
                    }}
                  >
                    {rid}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
