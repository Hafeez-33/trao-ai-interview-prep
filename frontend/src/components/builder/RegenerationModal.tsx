import React, { useState } from "react";
import { kitsApi, RegenerateScope } from "@/services/api/kits.api.js";
import { SafeKit, QuestionCategory } from "@/types/kit.js";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner.js";
import { ApiClientError } from "@/services/api/client.js";

export interface RegenerationModalProps {
  kitId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedKit: SafeKit) => void;
}

type RegenerationStep = "idle" | "preparing" | "generating" | "coverage" | "schedule" | "validation" | "complete";

export const RegenerationModal: React.FC<RegenerationModalProps> = ({
  kitId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [target, setTarget] = useState<"all" | "questions" | "flashcards" | "company_brief">("all");
  const [category, setCategory] = useState<QuestionCategory | "">("");
  const [currentStep, setCurrentStep] = useState<RegenerationStep>("idle");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isRunning = currentStep !== "idle" && currentStep !== "complete";

  const handleStartRegeneration = async () => {
    setError(null);
    setCurrentStep("preparing");

    try {
      const scope: RegenerateScope = {
        target,
        category: target === "questions" && category ? (category as QuestionCategory) : undefined,
      };

      // Progress progression feedback
      const timer1 = setTimeout(() => setCurrentStep("generating"), 600);
      const timer2 = setTimeout(() => setCurrentStep("coverage"), 3500);
      const timer3 = setTimeout(() => setCurrentStep("schedule"), 5500);
      const timer4 = setTimeout(() => setCurrentStep("validation"), 7000);

      const res = await kitsApi.regenerateKit(kitId, scope);

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);

      setCurrentStep("complete");
      setTimeout(() => {
        onSuccess(res.kit);
        onClose();
      }, 1000);
    } catch (err: unknown) {
      setCurrentStep("idle");
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred during regeneration.");
      }
    }
  };

  const getStepIndicator = (stepKey: RegenerationStep, label: string) => {
    const stepOrder: RegenerationStep[] = ["preparing", "generating", "coverage", "schedule", "validation", "complete"];
    const currentIdx = stepOrder.indexOf(currentStep);
    const thisIdx = stepOrder.indexOf(stepKey);

    const isDone = currentIdx > thisIdx || currentStep === "complete";
    const isActive = currentStep === stepKey;

    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          fontSize: "var(--text-xs)",
          color: isDone ? "var(--color-success)" : isActive ? "var(--color-primary-light)" : "var(--text-muted)",
          fontWeight: isActive ? 700 : 500,
        }}
      >
        <span
          style={{
            width: "18px",
            height: "18px",
            borderRadius: "var(--radius-full)",
            backgroundColor: isDone
              ? "var(--color-success)"
              : isActive
              ? "var(--color-primary-subtle)"
              : "var(--bg-surface-raised)",
            color: isDone ? "#ffffff" : isActive ? "var(--color-primary-light)" : "var(--text-muted)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "10px",
          }}
        >
          {isDone ? "✓" : isActive ? "⟳" : "○"}
        </span>
        <span>{label}</span>
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="regen-modal-title"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: "var(--space-4)",
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: "540px",
          width: "100%",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        }}
      >
        <div style={{ marginBottom: "var(--space-4)" }}>
          <h2 id="regen-modal-title" style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-1)" }}>
            Regenerate Kit Content
          </h2>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", margin: 0 }}>
            Safely synthesize fresh AI content while preserving your custom, edited, and pinned items.
          </p>
        </div>

        {/* State Preservation Guarantee Notice */}
        <div
          style={{
            padding: "var(--space-3) var(--space-4)",
            backgroundColor: "var(--color-primary-subtle)",
            borderLeft: "3px solid var(--color-primary)",
            borderRadius: "var(--radius-sm)",
            marginBottom: "var(--space-4)",
            fontSize: "var(--text-xs)",
            color: "var(--text-primary)",
          }}
        >
          <strong style={{ color: "var(--color-primary-light)" }}>State Preservation Guarantee:</strong>
          <ul style={{ margin: "4px 0 0 0", paddingLeft: "var(--space-4)", lineHeight: 1.5 }}>
            <li>Unedited AI content in the chosen scope will be refreshed.</li>
            <li><strong>📌 Pinned</strong>, custom, and edited questions are strictly preserved.</li>
            <li>Custom and edited flashcards are strictly preserved.</li>
            <li>Requirement coverage and the study schedule will be automatically recalculated.</li>
          </ul>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              padding: "var(--space-3)",
              backgroundColor: "var(--color-error-bg)",
              color: "var(--color-error)",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--text-xs)",
              marginBottom: "var(--space-4)",
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Configuration Controls (Disabled during execution) */}
        {!isRunning && currentStep !== "complete" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", marginBottom: "var(--space-6)" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="regen-target" className="form-label" style={{ fontSize: "var(--text-xs)" }}>
                Select Scope to Regenerate
              </label>
              <select
                id="regen-target"
                className="form-input"
                value={target}
                onChange={(e) => {
                  setTarget(e.target.value as any);
                  if (e.target.value !== "questions") setCategory("");
                }}
                style={{ fontSize: "var(--text-xs)" }}
              >
                <option value="all">Full Kit (Questions, Flashcards, Company Brief)</option>
                <option value="questions">Questions Only</option>
                <option value="flashcards">Flashcards Only</option>
                <option value="company_brief">Company Brief Only</option>
              </select>
            </div>

            {target === "questions" && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="regen-category" className="form-label" style={{ fontSize: "var(--text-xs)" }}>
                  Filter by Question Category (Optional)
                </label>
                <select
                  id="regen-category"
                  className="form-input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as QuestionCategory | "")}
                  style={{ fontSize: "var(--text-xs)" }}
                >
                  <option value="">All Categories (Technical, Behavioural, System Design, Company Fit)</option>
                  <option value="technical">Technical Questions Only</option>
                  <option value="behavioural">Behavioural Questions Only</option>
                  <option value="system-design">System Design Questions Only</option>
                  <option value="company-fit">Company Fit Questions Only</option>
                </select>
              </div>
            )}
          </div>
        )}

        {/* Progress Stepper Display */}
        {isRunning && (
          <div
            style={{
              padding: "var(--space-4)",
              backgroundColor: "var(--bg-canvas)",
              borderRadius: "var(--radius-md)",
              marginBottom: "var(--space-6)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
            }}
          >
            {getStepIndicator("preparing", "1. Preparing & locking kit state")}
            {getStepIndicator("generating", "2. Synthesizing candidate AI content")}
            {getStepIndicator("coverage", "3. Recalculating deterministic coverage")}
            {getStepIndicator("schedule", "4. Reallocating preparation schedule")}
            {getStepIndicator("validation", "5. Validating Appendix A contract")}
            {getStepIndicator("complete", "6. Complete")}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isRunning}
            className="btn btn-secondary"
            style={{ fontSize: "var(--text-xs)", padding: "var(--space-2) var(--space-4)" }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleStartRegeneration}
            disabled={isRunning}
            className="btn btn-primary"
            style={{ fontSize: "var(--text-xs)", padding: "var(--space-2) var(--space-5)" }}
          >
            {isRunning ? (
              <>
                <LoadingSpinner size="sm" label="Regenerating..." />
                <span>Regenerating...</span>
              </>
            ) : (
              "Confirm & Regenerate"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
