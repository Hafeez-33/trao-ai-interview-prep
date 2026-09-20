import React from "react";
import { GenerationStep, StepStatus } from "./GenerationStep.js";

export interface PipelineStepConfig {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
}

export interface GenerationProgressProps {
  steps: PipelineStepConfig[];
}

export const GenerationProgress: React.FC<GenerationProgressProps> = ({ steps }) => {
  return (
    <div
      role="status"
      aria-label="Generation Pipeline Progress"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
      }}
    >
      {steps.map((step, idx) => (
        <GenerationStep
          key={step.id}
          stepNumber={idx + 1}
          title={step.title}
          description={step.description}
          status={step.status}
        />
      ))}
    </div>
  );
};
