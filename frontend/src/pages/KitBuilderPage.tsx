import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { kitsApi } from "@/services/api/kits.api.js";
import {
  SafeKit,
  KitRequirement,
  InternalKitQuestion,
  InternalKitFlashcard,
  UpdateKitParams,
} from "@/types/kit.js";
import { ApiClientError } from "@/services/api/client.js";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner.js";
import { ErrorMessage } from "@/components/ui/ErrorMessage.js";
import { SaveStatus, SaveState } from "@/components/builder/SaveStatus.js";
import { RequirementsEditor } from "@/components/builder/RequirementsEditor.js";
import { QuestionsEditor } from "@/components/builder/QuestionsEditor.js";
import { FlashcardsEditor } from "@/components/builder/FlashcardsEditor.js";

interface StoredBuilderState {
  requirements: KitRequirement[];
  questions: InternalKitQuestion[];
  flashcards: InternalKitFlashcard[];
  savedAt: string;
}

export const KitBuilderPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [kit, setKit] = useState<SafeKit | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Editable local state
  const [requirements, setRequirements] = useState<KitRequirement[]>([]);
  const [questions, setQuestions] = useState<InternalKitQuestion[]>([]);
  const [flashcards, setFlashcards] = useState<InternalKitFlashcard[]>([]);

  // Save / Dirty state
  const [isDirty, setIsDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | undefined>(undefined);
  const [clientValidationError, setClientValidationError] = useState<string | null>(null);

  const initialLoadedRef = useRef(false);

  // Storage key for client-side builder persistence
  const storageKey = id ? `trao_builder_state_${id}` : null;

  // Hydrate kit and builder state
  useEffect(() => {
    if (!id) return;

    const fetchKit = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await kitsApi.getKit(id);
        const serverKit = res.kit;
        setKit(serverKit);

        // Check for locally saved builder state to restore user edits and pinned items
        let initialReqs = serverKit.role?.requirements || [];
        let initialQuestions: InternalKitQuestion[] = serverKit.questions || [];
        let initialFlashcards: InternalKitFlashcard[] = serverKit.flashcards || [];

        if (storageKey) {
          try {
            const rawStored = localStorage.getItem(storageKey);
            if (rawStored) {
              const stored: StoredBuilderState = JSON.parse(rawStored);
              if (Array.isArray(stored.requirements) && stored.requirements.length > 0) {
                initialReqs = stored.requirements;
              }
              if (Array.isArray(stored.questions) && stored.questions.length > 0) {
                initialQuestions = stored.questions;
              }
              if (Array.isArray(stored.flashcards) && stored.flashcards.length > 0) {
                initialFlashcards = stored.flashcards;
              }
            }
          } catch {
            // Ignore storage parse errors, fallback to server kit
          }
        }

        setRequirements(initialReqs);
        setQuestions(initialQuestions);
        setFlashcards(initialFlashcards);
        initialLoadedRef.current = true;
      } catch (err: unknown) {
        if (err instanceof ApiClientError && err.status === 401) {
          navigate("/login");
          return;
        }
        const msg = err instanceof Error ? err.message : "Failed to load prep kit.";
        setLoadError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchKit();
  }, [id, navigate, storageKey]);

  // Unsaved changes browser warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  // Change handlers
  const handleRequirementsChange = useCallback((updated: KitRequirement[]) => {
    setRequirements(updated);
    setIsDirty(true);
    setSaveState("unsaved");
    setClientValidationError(null);
  }, []);

  const handleQuestionsChange = useCallback((updated: InternalKitQuestion[]) => {
    setQuestions(updated);
    setIsDirty(true);
    setSaveState("unsaved");
    setClientValidationError(null);
  }, []);

  const handleFlashcardsChange = useCallback((updated: InternalKitFlashcard[]) => {
    setFlashcards(updated);
    setIsDirty(true);
    setSaveState("unsaved");
    setClientValidationError(null);
  }, []);

  // Save changes handler
  const handleSaveChanges = async () => {
    if (!id || !kit) return;

    // 1. Client-side validation
    // Requirements validation
    for (const r of requirements) {
      if (!r.text.trim()) {
        setClientValidationError(`Requirement ${r.id} cannot have empty text.`);
        return;
      }
    }

    // Questions validation
    const validReqIds = new Set(requirements.map((r) => r.id));
    for (const q of questions) {
      if (!q.prompt.trim()) {
        setClientValidationError(`Question ${q.id} cannot have an empty prompt.`);
        return;
      }
      if (!q.answer_outline.trim()) {
        setClientValidationError(`Question ${q.id} cannot have an empty answer outline.`);
        return;
      }
      if (!q.requirement_ids || q.requirement_ids.length === 0) {
        setClientValidationError(`Question ${q.id} must reference at least one valid requirement.`);
        return;
      }
      for (const rid of q.requirement_ids) {
        if (!validReqIds.has(rid)) {
          setClientValidationError(`Question ${q.id} references non-existent requirement '${rid}'.`);
          return;
        }
      }
    }

    // Flashcards validation
    for (const f of flashcards) {
      if (!f.front.trim()) {
        setClientValidationError(`Flashcard ${f.id} cannot have an empty front.`);
        return;
      }
      if (!f.back.trim()) {
        setClientValidationError(`Flashcard ${f.id} cannot have an empty back.`);
        return;
      }
      if (!f.requirement_ids || f.requirement_ids.length === 0) {
        setClientValidationError(`Flashcard ${f.id} must reference at least one valid requirement.`);
        return;
      }
      for (const rid of f.requirement_ids) {
        if (!validReqIds.has(rid)) {
          setClientValidationError(`Flashcard ${f.id} references non-existent requirement '${rid}'.`);
          return;
        }
      }
    }

    setClientValidationError(null);
    setSaveState("saving");
    setSaveErrorMessage(undefined);

    try {
      // Call existing PATCH endpoint with valid Phase 4 fields
      const patchParams: UpdateKitParams = {
        days: kit.schedule?.days_available || 5,
        company_url: kit.source?.company_url || undefined,
        ...(kit.jd ? { jd: kit.jd } : {}),
      };

      const res = await kitsApi.updateKit(id, patchParams);
      setKit(res.kit);

      // Persist client builder state (including is_pinned, is_custom, is_edited, order) in localStorage
      if (storageKey) {
        const storedPayload: StoredBuilderState = {
          requirements,
          questions,
          flashcards,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(storageKey, JSON.stringify(storedPayload));
      }

      setIsDirty(false);
      setSaveState("saved");
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.status === 401) {
        navigate("/login");
        return;
      }
      const msg = err instanceof Error ? err.message : "Failed to save changes.";
      setSaveState("error");
      setSaveErrorMessage(msg);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-16) 0" }}>
        <LoadingSpinner size="lg" label="Loading Kit Builder..." />
        <p style={{ marginTop: "var(--space-4)", color: "var(--text-secondary)" }}>
          Loading Kit Builder...
        </p>
      </div>
    );
  }

  if (loadError || !kit) {
    return (
      <div style={{ maxWidth: "600px", margin: "var(--space-8) auto" }}>
        <ErrorMessage
          title="Kit Unavailable"
          message={loadError || "The requested interview kit could not be loaded."}
        />
        <div style={{ marginTop: "var(--space-4)", textAlign: "center" }}>
          <Link to="/" className="btn btn-secondary">
            ← Return to Home
          </Link>
        </div>
      </div>
    );
  }

  const roleTitle = kit.role?.title || kit.source?.role || "Target Role";
  const companyName = kit.source?.company || "Target Company";

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", paddingBottom: "var(--space-16)" }}>
      {/* Builder Header Bar */}
      <div
        className="card"
        style={{
          marginBottom: "var(--space-6)",
          position: "sticky",
          top: "64px",
          zIndex: 30,
          backdropFilter: "blur(12px)",
          backgroundColor: "rgba(17, 24, 39, 0.95)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "var(--space-4)",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "4px" }}>
              <Link
                to={`/kits/${id}`}
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--color-primary-light)",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                ← Back to Kit View
              </Link>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>|</span>
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
                Kit Builder
              </span>
            </div>
            <h1 style={{ fontSize: "var(--text-xl)", margin: 0 }}>
              {roleTitle} <span style={{ color: "var(--text-secondary)", fontWeight: "normal" }}>at {companyName}</span>
            </h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
            <SaveStatus status={saveState} errorMessage={saveErrorMessage} />

            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={saveState === "saving" || !isDirty}
              className="btn btn-primary"
              style={{ padding: "var(--space-2) var(--space-5)", fontSize: "var(--text-sm)" }}
            >
              {saveState === "saving" ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {clientValidationError && (
          <div
            role="alert"
            style={{
              marginTop: "var(--space-3)",
              padding: "var(--space-2) var(--space-4)",
              backgroundColor: "var(--color-error-bg)",
              color: "var(--color-error)",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--text-xs)",
            }}
          >
            ⚠️ Validation Error: {clientValidationError}
          </div>
        )}
      </div>

      {/* 1. Requirements Section */}
      <RequirementsEditor
        requirements={requirements}
        onChange={handleRequirementsChange}
      />

      {/* 2. Questions Section */}
      <QuestionsEditor
        questions={questions}
        requirements={requirements}
        onChange={handleQuestionsChange}
      />

      {/* 3. Flashcards Section */}
      <FlashcardsEditor
        flashcards={flashcards}
        requirements={requirements}
        onChange={handleFlashcardsChange}
      />

      {/* Bottom Save Bar */}
      <div
        className="card"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "var(--space-4)",
        }}
      >
        <SaveStatus status={saveState} errorMessage={saveErrorMessage} />

        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <Link to={`/kits/${id}`} className="btn btn-secondary" style={{ fontSize: "var(--text-sm)" }}>
            Done / View Kit
          </Link>
          <button
            type="button"
            onClick={handleSaveChanges}
            disabled={saveState === "saving" || !isDirty}
            className="btn btn-primary"
            style={{ padding: "var(--space-2) var(--space-6)", fontSize: "var(--text-sm)" }}
          >
            {saveState === "saving" ? "Saving Changes..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};
