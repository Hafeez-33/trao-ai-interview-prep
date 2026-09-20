import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { kitsApi } from "@/services/api/kits.api.js";
import { PracticeState, PracticeConfidenceLevel } from "@/types/practice.js";
import { ApiClientError } from "@/services/api/client.js";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner.js";
import { ErrorMessage } from "@/components/ui/ErrorMessage.js";
import { PracticeProgress } from "@/components/practice/PracticeProgress.js";
import { PracticeQuestion } from "@/components/practice/PracticeQuestion.js";
import { PracticeComplete } from "@/components/practice/PracticeComplete.js";

export const PracticePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [practiceState, setPracticeState] = useState<PracticeState | null>(null);

  const [isRevealed, setIsRevealed] = useState(false);
  const [selectedConfidence, setSelectedConfidence] = useState<PracticeConfidenceLevel | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const fetchPracticeState = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await kitsApi.getPracticeState(id);
      setPracticeState(res.practice);
      setIsRevealed(false);
      setSelectedConfidence(null);
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.status === 401) {
        navigate("/login");
        return;
      }
      const msg = err instanceof Error ? err.message : "Failed to load practice session.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchPracticeState();
  }, [fetchPracticeState]);

  const handleRevealAnswer = () => {
    setIsRevealed(true);
  };

  const handleSelectConfidence = async (confidence: PracticeConfidenceLevel) => {
    if (!id || !practiceState?.next_question || isSubmitting) return;

    setSelectedConfidence(confidence);
    setIsSubmitting(true);
    setError(null);

    try {
      const questionId = practiceState.next_question.id;
      const res = await kitsApi.recordPracticeConfidence(id, questionId, confidence);
      setPracticeState(res.practice);
      setIsRevealed(false);
      setSelectedConfidence(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record confidence rating.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPractice = async () => {
    if (!id || isResetting) return;

    setIsResetting(true);
    setError(null);

    try {
      const res = await kitsApi.resetPractice(id);
      setPracticeState(res.practice);
      setIsRevealed(false);
      setSelectedConfidence(null);
      setIsResetModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reset practice session.";
      setError(msg);
    } finally {
      setIsResetting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-16) 0" }}>
        <LoadingSpinner size="lg" label="Loading practice session..." />
        <p style={{ marginTop: "var(--space-4)", color: "var(--text-secondary)" }}>
          Loading your practice session...
        </p>
      </div>
    );
  }

  if (error && !practiceState) {
    return (
      <div style={{ maxWidth: "600px", margin: "var(--space-8) auto" }}>
        <ErrorMessage
          title="Practice Unavailable"
          message={error || "The requested practice session could not be loaded."}
        />
        <div style={{ marginTop: "var(--space-4)", textAlign: "center" }}>
          <Link to={id ? `/kits/${id}` : "/"} className="btn btn-secondary">
            ← Return to Kit
          </Link>
        </div>
      </div>
    );
  }

  const isCompleted =
    practiceState?.completed === true ||
    practiceState?.next_question === null ||
    (practiceState?.total_questions ?? 0) === 0;

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", paddingBottom: "var(--space-12)" }}>
      {/* Header Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-4)",
          marginBottom: "var(--space-6)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <Link
              to={`/kits/${id}`}
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--text-secondary)",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              ← Back to Kit
            </Link>
          </div>
          <h1 style={{ fontSize: "var(--text-2xl)", margin: "var(--space-1) 0 0 0" }}>
            Practice Mode
          </h1>
        </div>

        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsResetModalOpen(true)}
            style={{ fontSize: "var(--text-xs)" }}
            title="Reset practice progress back to start"
          >
            ↺ Reset Session
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <ErrorMessage title="Action Failed" message={error} />
        </div>
      )}

      {/* Progress Bar */}
      {practiceState && (
        <PracticeProgress
          total={practiceState.total_questions}
          completed={practiceState.completed_questions}
          currentQuestionId={practiceState.next_question?.id || null}
        />
      )}

      {/* Main Content: Question or Completion Screen */}
      {isCompleted ? (
        <PracticeComplete
          totalQuestions={practiceState?.total_questions || 0}
          completedQuestions={practiceState?.completed_questions || 0}
          onResetPractice={handleResetPractice}
          kitId={id || ""}
          isResetting={isResetting}
        />
      ) : practiceState?.next_question ? (
        <PracticeQuestion
          question={practiceState.next_question}
          isRevealed={isRevealed}
          onRevealAnswer={handleRevealAnswer}
          selectedConfidence={selectedConfidence}
          onSelectConfidence={handleSelectConfidence}
          isSubmitting={isSubmitting}
        />
      ) : null}

      {/* Reset Confirmation Dialog */}
      {isResetModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-modal-title"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "var(--space-4)",
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: "480px",
              width: "100%",
              padding: "var(--space-6)",
              backgroundColor: "var(--color-surface)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-xl)",
            }}
          >
            <h3
              id="reset-modal-title"
              style={{
                fontSize: "var(--text-lg)",
                fontWeight: 600,
                marginTop: 0,
                marginBottom: "var(--space-2)",
                color: "var(--text-primary)",
              }}
            >
              Reset Practice Progress?
            </h3>

            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--text-secondary)",
                lineHeight: 1.5,
                marginBottom: "var(--space-6)",
              }}
            >
              This will clear all recorded confidence ratings and attempt counts for this kit.
              Your interview questions, flashcards, schedule, and company brief will remain completely unchanged.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsResetModalOpen(false)}
                disabled={isResetting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleResetPractice}
                disabled={isResetting}
                style={{
                  backgroundColor: "var(--color-error, #ef4444)",
                  borderColor: "var(--color-error, #ef4444)",
                }}
              >
                {isResetting ? "Resetting..." : "Yes, Reset Progress"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
