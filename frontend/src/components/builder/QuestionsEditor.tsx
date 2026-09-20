import React, { useState } from "react";
import {
  InternalKitQuestion,
  KitRequirement,
  QuestionCategory,
  QuestionDifficulty,
} from "@/types/kit.js";

export interface QuestionsEditorProps {
  questions: InternalKitQuestion[];
  requirements: KitRequirement[];
  onChange: (updatedQuestions: InternalKitQuestion[]) => void;
}

export const QuestionsEditor: React.FC<QuestionsEditorProps> = ({
  questions,
  requirements,
  onChange,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Edit form state
  const [editPrompt, setEditPrompt] = useState("");
  const [editAnswerOutline, setEditAnswerOutline] = useState("");
  const [editCategory, setEditCategory] = useState<QuestionCategory>("technical");
  const [editDifficulty, setEditDifficulty] = useState<QuestionDifficulty>(2);
  const [editReqIds, setEditReqIds] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // New question form state
  const [newPrompt, setNewPrompt] = useState("");
  const [newAnswerOutline, setNewAnswerOutline] = useState("");
  const [newCategory, setNewCategory] = useState<QuestionCategory>("technical");
  const [newDifficulty, setNewDifficulty] = useState<QuestionDifficulty>(2);
  const [newReqIds, setNewReqIds] = useState<string[]>([]);
  const [newValidationError, setNewValidationError] = useState<string | null>(null);

  const startEditing = (q: InternalKitQuestion) => {
    setEditingId(q.id);
    setEditPrompt(q.prompt);
    setEditAnswerOutline(q.answer_outline);
    setEditCategory(q.category);
    setEditDifficulty(q.difficulty);
    setEditReqIds([...q.requirement_ids]);
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
    if (!editPrompt.trim()) {
      setValidationError("Question prompt cannot be empty.");
      return;
    }
    if (!editAnswerOutline.trim()) {
      setValidationError("Answer outline cannot be empty.");
      return;
    }
    if (editReqIds.length === 0) {
      setValidationError("Question must reference at least one requirement.");
      return;
    }

    const updated = questions.map((q) => {
      if (q.id === id) {
        return {
          ...q,
          prompt: editPrompt.trim(),
          answer_outline: editAnswerOutline.trim(),
          category: editCategory,
          difficulty: editDifficulty,
          requirement_ids: editReqIds,
          is_edited: true,
        };
      }
      return q;
    });

    onChange(updated);
    setEditingId(null);
    setValidationError(null);
  };

  const togglePin = (id: string) => {
    const updated = questions.map((q) => {
      if (q.id === id) {
        return {
          ...q,
          is_pinned: !q.is_pinned,
        };
      }
      return q;
    });
    onChange(updated);
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;

    const list = [...questions];
    const [moved] = list.splice(index, 1);
    list.splice(targetIndex, 0, moved);

    // Update order index
    const reordered = list.map((item, idx) => ({
      ...item,
      order: idx + 1,
    }));

    onChange(reordered);
  };

  const deleteQuestion = (id: string) => {
    if (window.confirm("Are you sure you want to remove this question?")) {
      const filtered = questions.filter((q) => q.id !== id);
      onChange(filtered);
    }
  };

  const handleAddCustomQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrompt.trim()) {
      setNewValidationError("Question prompt cannot be empty.");
      return;
    }
    if (!newAnswerOutline.trim()) {
      setNewValidationError("Answer outline cannot be empty.");
      return;
    }
    if (newReqIds.length === 0) {
      setNewValidationError("Question must reference at least one requirement.");
      return;
    }

    // Determine next sequential ID
    let maxIdNum = questions.reduce((max, q) => {
      const num = parseInt(q.id.replace(/^q/, ""), 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    const nextId = `q${maxIdNum + 1}`;

    const newQuestion: InternalKitQuestion = {
      id: nextId,
      prompt: newPrompt.trim(),
      answer_outline: newAnswerOutline.trim(),
      category: newCategory,
      difficulty: newDifficulty,
      requirement_ids: newReqIds,
      is_custom: true,
      is_edited: false,
      is_pinned: false,
      order: questions.length + 1,
    };

    onChange([...questions, newQuestion]);

    // Reset form
    setNewPrompt("");
    setNewAnswerOutline("");
    setNewReqIds([]);
    setNewCategory("technical");
    setNewDifficulty(2);
    setIsAddingNew(false);
    setNewValidationError(null);
  };

  return (
    <section aria-labelledby="questions-editor-heading" className="card" style={{ marginBottom: "var(--space-6)" }}>
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
          <h2 id="questions-editor-heading" style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-1)" }}>
            Interview Questions ({questions.length})
          </h2>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", margin: 0 }}>
            Edit question prompts, answer outlines, requirement mappings, or pin high-priority items.
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
            + Add Custom Question
          </button>
        )}
      </div>

      {/* Add Custom Question Form */}
      {isAddingNew && (
        <form
          onSubmit={handleAddCustomQuestion}
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
              Create Custom Question
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
            <label htmlFor="new-q-prompt" className="form-label" style={{ fontSize: "var(--text-xs)" }}>
              Question Prompt <span style={{ color: "var(--color-error)" }}>*</span>
            </label>
            <textarea
              id="new-q-prompt"
              className="form-input"
              rows={2}
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              placeholder="e.g. Explain how you design scalable distributed caches in high-traffic microservices."
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: "var(--space-3)" }}>
            <label htmlFor="new-q-outline" className="form-label" style={{ fontSize: "var(--text-xs)" }}>
              Answer Outline / Key Evaluation Points <span style={{ color: "var(--color-error)" }}>*</span>
            </label>
            <textarea
              id="new-q-outline"
              className="form-input"
              rows={3}
              value={newAnswerOutline}
              onChange={(e) => setNewAnswerOutline(e.target.value)}
              placeholder="Key concepts to mention: Redis vs Memcached, cache invalidation strategies, TTL, write-through vs write-back..."
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="new-q-category" className="form-label" style={{ fontSize: "var(--text-xs)" }}>
                Category
              </label>
              <select
                id="new-q-category"
                className="form-input"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as QuestionCategory)}
                style={{ fontSize: "var(--text-xs)" }}
              >
                <option value="technical">Technical</option>
                <option value="behavioural">Behavioural</option>
                <option value="system-design">System Design</option>
                <option value="company-fit">Company Fit</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="new-q-diff" className="form-label" style={{ fontSize: "var(--text-xs)" }}>
                Difficulty
              </label>
              <select
                id="new-q-diff"
                className="form-input"
                value={newDifficulty}
                onChange={(e) => setNewDifficulty(parseInt(e.target.value, 10) as QuestionDifficulty)}
                style={{ fontSize: "var(--text-xs)" }}
              >
                <option value={1}>Beginner (Level 1)</option>
                <option value={2}>Intermediate (Level 2)</option>
                <option value={3}>Advanced (Level 3)</option>
              </select>
            </div>
          </div>

          {/* Requirement Selection Checklist */}
          <div className="form-group" style={{ marginBottom: "var(--space-4)" }}>
            <label className="form-label" style={{ fontSize: "var(--text-xs)" }}>
              Mapped Role Requirements <span style={{ color: "var(--color-error)" }}>*</span>
            </label>
            <div
              style={{
                maxHeight: "140px",
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
              Add Question
            </button>
          </div>
        </form>
      )}

      {/* Questions List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {questions.map((q, idx) => {
          const isEditing = editingId === q.id;

          if (isEditing) {
            return (
              <div
                key={q.id}
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
                    ID: {q.id} (Read-only)
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
                  <label htmlFor={`edit-q-prompt-${q.id}`} className="form-label" style={{ fontSize: "var(--text-xs)" }}>
                    Question Prompt
                  </label>
                  <textarea
                    id={`edit-q-prompt-${q.id}`}
                    className="form-input"
                    rows={2}
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    style={{ fontSize: "var(--text-sm)" }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: "var(--space-3)" }}>
                  <label htmlFor={`edit-q-outline-${q.id}`} className="form-label" style={{ fontSize: "var(--text-xs)" }}>
                    Answer Outline / Key Evaluation Points
                  </label>
                  <textarea
                    id={`edit-q-outline-${q.id}`}
                    className="form-input"
                    rows={3}
                    value={editAnswerOutline}
                    onChange={(e) => setEditAnswerOutline(e.target.value)}
                    style={{ fontSize: "var(--text-sm)" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor={`edit-q-category-${q.id}`} className="form-label" style={{ fontSize: "var(--text-xs)" }}>
                      Category
                    </label>
                    <select
                      id={`edit-q-category-${q.id}`}
                      className="form-input"
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value as QuestionCategory)}
                      style={{ fontSize: "var(--text-xs)" }}
                    >
                      <option value="technical">Technical</option>
                      <option value="behavioural">Behavioural</option>
                      <option value="system-design">System Design</option>
                      <option value="company-fit">Company Fit</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor={`edit-q-diff-${q.id}`} className="form-label" style={{ fontSize: "var(--text-xs)" }}>
                      Difficulty
                    </label>
                    <select
                      id={`edit-q-diff-${q.id}`}
                      className="form-input"
                      value={editDifficulty}
                      onChange={(e) => setEditDifficulty(parseInt(e.target.value, 10) as QuestionDifficulty)}
                      style={{ fontSize: "var(--text-xs)" }}
                    >
                      <option value={1}>Beginner (Level 1)</option>
                      <option value={2}>Intermediate (Level 2)</option>
                      <option value={3}>Advanced (Level 3)</option>
                    </select>
                  </div>
                </div>

                {/* Requirement Selection Checklist */}
                <div className="form-group" style={{ marginBottom: "var(--space-4)" }}>
                  <label className="form-label" style={{ fontSize: "var(--text-xs)" }}>
                    Mapped Role Requirements
                  </label>
                  <div
                    style={{
                      maxHeight: "140px",
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
                    onClick={() => saveEditing(q.id)}
                    className="btn btn-primary"
                    style={{ fontSize: "var(--text-xs)", padding: "var(--space-1) var(--space-3)" }}
                  >
                    Apply Edit
                  </button>
                </div>
              </div>
            );
          }

          const diffLabel = q.difficulty === 3 ? "Advanced" : q.difficulty === 2 ? "Intermediate" : "Beginner";

          return (
            <div
              key={q.id}
              style={{
                padding: "var(--space-4)",
                backgroundColor: "var(--bg-canvas)",
                borderRadius: "var(--radius-md)",
                border: q.is_pinned ? "1px solid var(--color-accent)" : "1px solid var(--border-subtle)",
              }}
            >
              {/* Card Meta & Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-2)" }}>
                <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--text-xs)",
                      fontWeight: 700,
                      color: "var(--text-muted)",
                    }}
                  >
                    {q.id}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      padding: "2px 6px",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: "var(--color-primary-subtle)",
                      color: "var(--color-primary-light)",
                      fontWeight: 600,
                      textTransform: "capitalize",
                    }}
                  >
                    {q.category}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      padding: "2px 6px",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: "var(--bg-surface-raised)",
                      color: "var(--text-secondary)",
                      fontWeight: 600,
                    }}
                  >
                    {diffLabel}
                  </span>

                  {/* Builder Status Badges */}
                  {q.is_pinned && (
                    <span
                      style={{
                        fontSize: "var(--text-xs)",
                        padding: "2px 6px",
                        borderRadius: "var(--radius-sm)",
                        backgroundColor: "var(--color-accent-subtle)",
                        color: "var(--color-accent)",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "2px",
                      }}
                    >
                      📌 Pinned
                    </span>
                  )}
                  {q.is_custom && (
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
                      Custom
                    </span>
                  )}
                  {q.is_edited && (
                    <span
                      style={{
                        fontSize: "var(--text-xs)",
                        padding: "2px 6px",
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

                {/* Card Action Controls: Reorder, Pin, Edit, Delete */}
                <div style={{ display: "flex", gap: "var(--space-1)", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => moveQuestion(idx, "up")}
                    disabled={idx === 0}
                    className="btn btn-secondary"
                    style={{ fontSize: "var(--text-xs)", padding: "2px 6px" }}
                    aria-label={`Move question ${q.id} up`}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => moveQuestion(idx, "down")}
                    disabled={idx === questions.length - 1}
                    className="btn btn-secondary"
                    style={{ fontSize: "var(--text-xs)", padding: "2px 6px" }}
                    aria-label={`Move question ${q.id} down`}
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePin(q.id)}
                    className="btn btn-secondary"
                    style={{
                      fontSize: "var(--text-xs)",
                      padding: "2px 8px",
                      backgroundColor: q.is_pinned ? "var(--color-accent-subtle)" : undefined,
                      color: q.is_pinned ? "var(--color-accent)" : undefined,
                    }}
                    aria-label={q.is_pinned ? `Unpin question ${q.id}` : `Pin question ${q.id}`}
                  >
                    {q.is_pinned ? "Unpin" : "Pin"}
                  </button>
                  <button
                    type="button"
                    onClick={() => startEditing(q)}
                    className="btn btn-secondary"
                    style={{ fontSize: "var(--text-xs)", padding: "2px 8px" }}
                    aria-label={`Edit question ${q.id}`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteQuestion(q.id)}
                    className="btn btn-secondary"
                    style={{ fontSize: "var(--text-xs)", padding: "2px 8px", color: "var(--color-error)" }}
                    aria-label={`Delete question ${q.id}`}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Prompt */}
              <h3 style={{ fontSize: "var(--text-base)", marginBottom: "var(--space-2)", color: "var(--text-primary)" }}>
                {q.prompt}
              </h3>

              {/* Answer Outline */}
              <div
                style={{
                  backgroundColor: "var(--bg-surface)",
                  padding: "var(--space-2) var(--space-3)",
                  borderRadius: "var(--radius-sm)",
                  borderLeft: "3px solid var(--color-primary)",
                  marginBottom: "var(--space-2)",
                }}
              >
                <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-muted)", marginBottom: "2px" }}>
                  ANSWER OUTLINE:
                </div>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", margin: 0 }}>
                  {q.answer_outline}
                </p>
              </div>

              {/* Requirement references */}
              <div style={{ display: "flex", gap: "var(--space-1)", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Requirements:</span>
                {q.requirement_ids.map((rid) => (
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
