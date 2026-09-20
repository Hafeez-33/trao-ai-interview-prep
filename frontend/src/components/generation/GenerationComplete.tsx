import React from "react";
import { Link } from "react-router-dom";
import { SafeKit } from "@/types/kit.js";

export interface GenerationCompleteProps {
  kit: SafeKit;
}

export const GenerationComplete: React.FC<GenerationCompleteProps> = ({ kit }) => {
  const requirementsCount = kit.role?.requirements?.length || 0;
  const questionsCount = kit.questions?.length || 0;
  const flashcardsCount = kit.flashcards?.length || 0;
  const daysCount = kit.schedule?.days_available || kit.schedule?.days?.length || 5;
  const companyName = kit.source?.company || kit.company_brief?.summary ? (kit.source?.company || "Target Company") : "Company";
  const roleTitle = kit.role?.title || kit.source?.role || "Target Role";

  return (
    <div className="card" style={{ marginTop: "var(--space-6)", textAlign: "center", padding: "var(--space-8)" }}>
      <div
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "var(--radius-full)",
          backgroundColor: "var(--color-success)",
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "var(--text-2xl)",
          margin: "0 auto var(--space-4) auto",
          fontWeight: 700,
        }}
      >
        ✓
      </div>

      <h2 style={{ fontSize: "var(--text-2xl)", marginBottom: "var(--space-2)" }}>
        Your Prep Kit is Ready!
      </h2>
      <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-base)", marginBottom: "var(--space-6)" }}>
        Successfully generated and verified for <strong style={{ color: "var(--text-primary)" }}>{roleTitle}</strong> at{" "}
        <strong style={{ color: "var(--text-primary)" }}>{companyName}</strong>.
      </p>

      {/* Metrics Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "var(--space-3)",
          marginBottom: "var(--space-8)",
        }}
      >
        <div style={{ padding: "var(--space-3)", backgroundColor: "var(--bg-surface-raised)", borderRadius: "var(--radius-md)" }}>
          <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--color-primary-light)" }}>
            {requirementsCount}
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Requirements</div>
        </div>

        <div style={{ padding: "var(--space-3)", backgroundColor: "var(--bg-surface-raised)", borderRadius: "var(--radius-md)" }}>
          <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--color-accent)" }}>
            {questionsCount}
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Questions</div>
        </div>

        <div style={{ padding: "var(--space-3)", backgroundColor: "var(--bg-surface-raised)", borderRadius: "var(--radius-md)" }}>
          <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--color-warning)" }}>
            {flashcardsCount}
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Flashcards</div>
        </div>

        <div style={{ padding: "var(--space-3)", backgroundColor: "var(--bg-surface-raised)", borderRadius: "var(--radius-md)" }}>
          <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--color-success)" }}>
            {daysCount} Days
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Schedule</div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <Link
          to={`/kits/${kit._id}`}
          className="btn btn-primary"
          style={{ padding: "var(--space-3) var(--space-8)", fontSize: "var(--text-base)" }}
        >
          Open Prep Kit →
        </Link>
      </div>
    </div>
  );
};
