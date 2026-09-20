import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { kitsApi } from "@/services/api/kits.api.js";
import { SafeKit } from "@/types/kit.js";
import { ApiClientError } from "@/services/api/client.js";
import { GenerationProgress, PipelineStepConfig } from "@/components/generation/GenerationProgress.js";
import { GenerationError } from "@/components/generation/GenerationError.js";
import { GenerationComplete } from "@/components/generation/GenerationComplete.js";
import { StepStatus } from "@/components/generation/GenerationStep.js";

const INITIAL_STEPS: PipelineStepConfig[] = [
  {
    id: "step-load",
    title: "1. Job Description Ingestion",
    description: "Loading stored Job Description and interview constraints.",
    status: "pending",
  },
  {
    id: "step-extract",
    title: "2. Requirement Extraction",
    description: "Extracting technical, behavioural, and domain requirements.",
    status: "pending",
  },
  {
    id: "step-research",
    title: "3. Company & Interview Research",
    description: "Gathering authentic company context and public hiring stages.",
    status: "pending",
  },
  {
    id: "step-generate",
    title: "4. Questions & Flashcards Generation",
    description: "Synthesizing categorized interview questions and study flashcards.",
    status: "pending",
  },
  {
    id: "step-coverage",
    title: "5. Deterministic Coverage Engine",
    description: "Verifying 100% coverage of must-have requirements.",
    status: "pending",
  },
  {
    id: "step-schedule",
    title: "6. Schedule Day Allocation",
    description: "Mathematically distributing questions across your study days.",
    status: "pending",
  },
  {
    id: "step-validate",
    title: "7. Appendix A Contract Validation",
    description: "Ensuring structural validity and referential integrity.",
    status: "pending",
  },
];

export const GenerationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [steps, setSteps] = useState<PipelineStepConfig[]>(INITIAL_STEPS);
  const [kit, setKit] = useState<SafeKit | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [failedStepIndex, setFailedStepIndex] = useState<number | null>(null);
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [isRetrying, setIsRetrying] = useState(false);

  const isOrchestratingRef = useRef(false);

  const updateStepStatus = (stepId: string, status: StepStatus) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, status } : s))
    );
  };

  const runPipeline = useCallback(async (startFromIndex = 0) => {
    if (!id || isOrchestratingRef.current) return;
    isOrchestratingRef.current = true;
    setIsRetrying(true);
    setFailedStepIndex(null);
    setErrorCode(undefined);
    setErrorMessage(undefined);

    let currentKit: SafeKit | null = kit;

    try {
      // Step 1: Ingest / Load Kit
      if (startFromIndex <= 0) {
        updateStepStatus("step-load", "running");
        const res = await kitsApi.getKit(id);
        currentKit = res.kit;
        setKit(currentKit);
        updateStepStatus("step-load", "completed");

        // Idempotency check: if already completed and populated, finish immediately
        if (
          currentKit.status === "completed" &&
          (currentKit.questions?.length || 0) > 0 &&
          (currentKit.schedule?.days?.length || 0) > 0
        ) {
          setSteps((prev) => prev.map((s) => ({ ...s, status: "completed" })));
          setIsComplete(true);
          isOrchestratingRef.current = false;
          setIsRetrying(false);
          return;
        }
      }

      if (!currentKit) {
        throw new Error("Failed to load kit document.");
      }

      // Step 2: Requirement Extraction
      if (startFromIndex <= 1) {
        const hasReqs = (currentKit.role?.requirements?.length || 0) > 0;
        if (!hasReqs) {
          updateStepStatus("step-extract", "running");
          const extractRes = await kitsApi.extractRequirements(id);
          currentKit = extractRes.kit;
          setKit(currentKit);
        }
        updateStepStatus("step-extract", "completed");
      }

      // Step 3: Company & Interview Research
      if (startFromIndex <= 2) {
        const companyUrl = currentKit.source?.company_url?.trim();
        if (companyUrl) {
          const hasBrief = Boolean(currentKit.company_brief?.summary?.trim());
          if (!hasBrief) {
            updateStepStatus("step-research", "running");
            // 1. Crawl
            await kitsApi.crawlCompany(id);
            // 2. Research
            const resResearch = await kitsApi.researchCompany(id);
            currentKit = resResearch.kit;
            setKit(currentKit);
          }
          updateStepStatus("step-research", "completed");
        } else {
          updateStepStatus("step-research", "skipped");
        }
      }

      // Step 4: Questions & Flashcards Generation
      if (startFromIndex <= 3) {
        const hasQuestions = (currentKit.questions?.length || 0) > 0;
        if (!hasQuestions) {
          updateStepStatus("step-generate", "running");
          const genRes = await kitsApi.generateKit(id);
          currentKit = genRes.kit;
          setKit(currentKit);
        }
        updateStepStatus("step-generate", "completed");
      }

      // Step 5: Deterministic Coverage Engine
      if (startFromIndex <= 4) {
        const hasCoverage = currentKit.coverage && currentKit.coverage.passes > 0;
        if (!hasCoverage) {
          updateStepStatus("step-coverage", "running");
          const covRes = await kitsApi.runCoverage(id);
          currentKit = covRes.kit;
          setKit(currentKit);
        }
        updateStepStatus("step-coverage", "completed");
      }

      // Step 6: Schedule Day Allocation
      if (startFromIndex <= 5) {
        const hasSchedule = (currentKit.schedule?.days?.length || 0) > 0;
        if (!hasSchedule) {
          updateStepStatus("step-schedule", "running");
          const schedRes = await kitsApi.generateSchedule(id);
          currentKit = schedRes.kit;
          setKit(currentKit);
        }
        updateStepStatus("step-schedule", "completed");
      }

      // Step 7: Contract Validation
      if (startFromIndex <= 6) {
        updateStepStatus("step-validate", "running");
        const valRes = await kitsApi.validateKit(id);
        if (!valRes.valid && valRes.errors.length > 0) {
          throw new Error(`Validation issue: ${valRes.errors[0].message}`);
        }
        updateStepStatus("step-validate", "completed");
      }

      // All stages completed successfully!
      setIsComplete(true);
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.status === 401) {
        navigate("/login");
        return;
      }

      const activeIdx = steps.findIndex((s) => s.status === "running");
      const errIdx = activeIdx >= 0 ? activeIdx : startFromIndex;

      setFailedStepIndex(errIdx);
      if (steps[errIdx]) {
        updateStepStatus(steps[errIdx].id, "failed");
      }

      if (err instanceof ApiClientError) {
        setErrorCode(err.code);
        setErrorMessage(err.message);
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("An unexpected error occurred during generation.");
      }
    } finally {
      isOrchestratingRef.current = false;
      setIsRetrying(false);
    }
  }, [id, kit, navigate, steps]);

  useEffect(() => {
    if (!isOrchestratingRef.current && !isComplete && failedStepIndex === null) {
      runPipeline(0);
    }
  }, [runPipeline, isComplete, failedStepIndex]);

  const handleRetry = () => {
    if (failedStepIndex !== null) {
      runPipeline(failedStepIndex);
    } else {
      runPipeline(0);
    }
  };

  const failedStepTitle =
    failedStepIndex !== null && steps[failedStepIndex]
      ? steps[failedStepIndex].title
      : "Generation Stage";

  return (
    <div style={{ maxWidth: "760px", margin: "var(--space-6) auto" }}>
      <div className="card">
        <div style={{ marginBottom: "var(--space-6)" }}>
          <h1 style={{ fontSize: "var(--text-2xl)", marginBottom: "var(--space-2)" }}>
            Generating Interview Prep Kit
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
            Our deterministic multi-stage pipeline is executing. Each step is grounded in your
            job description and verified before moving forward.
          </p>
        </div>

        {/* Stepper Progress */}
        <GenerationProgress steps={steps} />

        {/* Error / Retry Banner */}
        {failedStepIndex !== null && (
          <GenerationError
            failedStepTitle={failedStepTitle}
            errorCode={errorCode}
            errorMessage={errorMessage}
            onRetry={handleRetry}
            isRetrying={isRetrying}
          />
        )}

        {/* Completion Card */}
        {isComplete && kit && <GenerationComplete kit={kit} />}
      </div>
    </div>
  );
};
