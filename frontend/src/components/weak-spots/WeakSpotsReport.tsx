import React from "react";
import { Link } from "react-router-dom";
import { WeakSpotsReport as WeakSpotsReportType, WeakSpotRequirement } from "@/types/weak-spots.js";

interface WeakSpotsReportProps {
  report: WeakSpotsReportType;
  kitId: string;
  roleTitle?: string;
  companyName?: string;
}

export const WeakSpotsReport: React.FC<WeakSpotsReportProps> = ({
  report,
  kitId,
  roleTitle = "Interview Prep Kit",
  companyName = "Target Company",
}) => {
  const {
    total_requirements,
    covered_requirements,
    weak_requirements,
    unattempted_questions,
    low_confidence_questions,
    strongest_requirements,
    weak_spots,
  } = report;

  const isReady = weak_requirements === 0 && total_requirements > 0;

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", paddingBottom: "var(--space-12)" }}>
      {/* Header Overview Card */}
      <div className="card" style={{ marginBottom: "var(--space-6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-4)" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  padding: "2px 8px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: isReady ? "var(--color-success-bg)" : "var(--color-warning-bg)",
                  color: isReady ? "var(--color-success)" : "var(--color-warning)",
                  fontWeight: 700,
                }}
              >
                {isReady ? "✓ High Readiness" : "⚠ Areas Needing Practice"}
              </span>
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  padding: "2px 8px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--color-primary-subtle)",
                  color: "var(--color-primary-light)",
                  fontWeight: 600,
                }}
              >
                Deterministic Diagnostic
              </span>
            </div>
            <h1 style={{ fontSize: "var(--text-2xl)", marginBottom: "var(--space-1)" }}>
              Weak Spots Report: {roleTitle}
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", margin: 0 }}>
              {companyName} &bull; Diagnostic analysis of requirement coverage and practice confidence
            </p>
          </div>

          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "center" }}>
            <Link to={`/kits/${kitId}`} className="btn btn-secondary" style={{ fontSize: "var(--text-xs)" }}>
              ← View Kit
            </Link>
            <Link
              to={`/kits/${kitId}/practice`}
              className="btn btn-primary"
              style={{
                fontSize: "var(--text-xs)",
                backgroundColor: "var(--color-primary-light)",
                fontWeight: 600,
              }}
            >
              🎯 Practice Questions
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Summary Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "var(--space-4)",
          marginBottom: "var(--space-6)",
        }}
      >
        <div className="card" style={{ padding: "var(--space-4)", textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 600, marginBottom: "var(--space-1)" }}>
            TOTAL REQUIREMENTS
          </div>
          <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--text-primary)" }}>
            {total_requirements}
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: "var(--space-1)" }}>
            {covered_requirements} with linked questions
          </div>
        </div>

        <div className="card" style={{ padding: "var(--space-4)", textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 600, marginBottom: "var(--space-1)" }}>
            WEAK REQUIREMENTS
          </div>
          <div
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: 700,
              color: weak_requirements > 0 ? "var(--color-error)" : "var(--color-success)",
            }}
          >
            {weak_requirements}
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: "var(--space-1)" }}>
            {weak_requirements > 0 ? "Require focused review" : "All areas proficient"}
          </div>
        </div>

        <div className="card" style={{ padding: "var(--space-4)", textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 600, marginBottom: "var(--space-1)" }}>
            UNATTEMPTED QUESTIONS
          </div>
          <div
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: 700,
              color: unattempted_questions > 0 ? "var(--color-warning)" : "var(--text-primary)",
            }}
          >
            {unattempted_questions}
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: "var(--space-1)" }}>
            Awaiting first practice
          </div>
        </div>

        <div className="card" style={{ padding: "var(--space-4)", textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 600, marginBottom: "var(--space-1)" }}>
            LOW-CONFIDENCE QUESTIONS
          </div>
          <div
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: 700,
              color: low_confidence_questions > 0 ? "var(--color-error)" : "var(--color-success)",
            }}
          >
            {low_confidence_questions}
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: "var(--space-1)" }}>
            Rated confidence level 1
          </div>
        </div>
      </div>

      {/* Weak Spots Section */}
      <div style={{ marginBottom: "var(--space-8)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
          <h2 style={{ fontSize: "var(--text-xl)", margin: 0, display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span>Identified Weak Spots</span>
            <span
              style={{
                fontSize: "var(--text-xs)",
                padding: "2px 8px",
                borderRadius: "var(--radius-full)",
                backgroundColor: weak_spots.length > 0 ? "var(--color-error-bg)" : "var(--color-success-bg)",
                color: weak_spots.length > 0 ? "var(--color-error)" : "var(--color-success)",
                fontWeight: 700,
              }}
            >
              {weak_spots.length}
            </span>
          </h2>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
            Prioritized by impact (Must-haves &amp; Low confidence first)
          </span>
        </div>

        {weak_spots.length === 0 ? (
          <div
            className="card"
            style={{
              padding: "var(--space-8)",
              textAlign: "center",
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: "var(--space-2)" }}>🎉</div>
            <h3 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-2)", color: "var(--color-success)" }}>
              No Weak Spots Found!
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", maxWidth: "500px", margin: "0 auto" }}>
              All job requirements have linked interview questions, every question has been practiced, and confidence ratings are consistently solid (avg &ge; 2.0).
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {weak_spots.map((ws: WeakSpotRequirement, index: number) => {
              const isMust = ws.priority === "must";
              const hasLowConf = ws.low_confidence_count > 0;
              const hasUnattempted = ws.unattempted_question_count > 0;

              return (
                <div
                  key={ws.requirement_id}
                  className="card"
                  style={{
                    padding: "var(--space-5)",
                    borderLeft: `4px solid ${isMust ? "var(--color-error)" : "var(--color-warning)"}`,
                  }}
                >
                  {/* Top Bar: Badges & ID */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: "var(--text-xs)",
                          padding: "2px 8px",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: isMust ? "var(--color-error-bg)" : "var(--bg-surface-raised)",
                          color: isMust ? "var(--color-error)" : "var(--text-secondary)",
                          fontWeight: 700,
                        }}
                      >
                        {isMust ? "🚨 Must-Have Priority" : "Nice-to-Have"}
                      </span>
                      <span
                        style={{
                          fontSize: "var(--text-xs)",
                          fontFamily: "var(--font-mono)",
                          padding: "2px 6px",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: "var(--bg-surface-raised)",
                          color: "var(--text-muted)",
                          fontWeight: 700,
                        }}
                      >
                        {ws.requirement_id}
                      </span>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                        #{index + 1} Priority
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", fontSize: "var(--text-xs)" }}>
                      {ws.average_confidence !== null ? (
                        <span style={{ color: ws.average_confidence < 2 ? "var(--color-error)" : "var(--color-warning)", fontWeight: 600 }}>
                          Avg Confidence: {ws.average_confidence.toFixed(1)} / 3.0
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>Not attempted yet</span>
                      )}
                    </div>
                  </div>

                  {/* Requirement Text */}
                  <h3 style={{ fontSize: "var(--text-base)", color: "var(--text-primary)", marginBottom: "var(--space-3)" }}>
                    {ws.requirement_text}
                  </h3>

                  {/* Diagnostic Reason Box */}
                  <div
                    style={{
                      padding: "var(--space-3) var(--space-4)",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "var(--bg-canvas)",
                      border: "1px solid var(--border-subtle)",
                      marginBottom: "var(--space-4)",
                    }}
                  >
                    <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-muted)", marginBottom: "2px" }}>
                      DIAGNOSTIC FINDING
                    </div>
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--color-warning)", margin: 0, fontWeight: 500 }}>
                      {ws.reason}
                    </p>
                  </div>

                  {/* Question Metrics Breakdown */}
                  <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", marginBottom: "var(--space-4)", fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                    <span>Linked Questions: <strong>{ws.linked_question_count}</strong></span>
                    <span>Attempted: <strong>{ws.attempted_question_count}</strong></span>
                    <span style={{ color: hasUnattempted ? "var(--color-warning)" : undefined }}>
                      Unattempted: <strong>{ws.unattempted_question_count}</strong>
                    </span>
                    <span style={{ color: hasLowConf ? "var(--color-error)" : undefined }}>
                      Low Confidence (1): <strong>{ws.low_confidence_count}</strong>
                    </span>
                    <span>Medium Confidence (2): <strong>{ws.medium_confidence_count}</strong></span>
                    <span>High Confidence (3): <strong>{ws.high_confidence_count}</strong></span>
                  </div>

                  {/* Recommended Questions to Practice */}
                  {ws.recommended_questions && ws.recommended_questions.length > 0 && (
                    <div>
                      <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-muted)", marginBottom: "var(--space-2)" }}>
                        RECOMMENDED PRACTICE QUESTIONS ({ws.recommended_questions.length}):
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                        {ws.recommended_questions.map((rq) => {
                          const confBadge =
                            rq.confidence === 1
                              ? { label: "Confidence: 1 (Low)", bg: "var(--color-error-bg)", color: "var(--color-error)" }
                              : rq.confidence === 2
                              ? { label: "Confidence: 2 (Medium)", bg: "var(--color-warning-bg)", color: "var(--color-warning)" }
                              : rq.confidence === 3
                              ? { label: "Confidence: 3 (High)", bg: "var(--color-success-bg)", color: "var(--color-success)" }
                              : { label: "Unattempted", bg: "var(--bg-surface-raised)", color: "var(--text-muted)" };

                          return (
                            <div
                              key={rq.id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "var(--space-2) var(--space-3)",
                                backgroundColor: "var(--bg-canvas)",
                                border: "1px solid var(--border-subtle)",
                                borderRadius: "var(--radius-md)",
                                gap: "var(--space-3)",
                                flexWrap: "wrap",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flex: 1, minWidth: "240px" }}>
                                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-primary-light)" }}>
                                  {rq.id}
                                </span>
                                <span
                                  style={{
                                    fontSize: "var(--text-xs)",
                                    padding: "1px 6px",
                                    borderRadius: "var(--radius-sm)",
                                    backgroundColor: confBadge.bg,
                                    color: confBadge.color,
                                    fontWeight: 600,
                                  }}
                                >
                                  {confBadge.label}
                                </span>
                                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {rq.prompt}
                                </span>
                              </div>

                              <Link
                                to={`/kits/${kitId}/practice`}
                                className="btn btn-secondary"
                                style={{
                                  fontSize: "var(--text-xs)",
                                  padding: "2px 8px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Practice →
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Strongest Requirements Section */}
      {strongest_requirements && strongest_requirements.length > 0 && (
        <div>
          <h2 style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-3)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span>Strongest Areas</span>
            <span
              style={{
                fontSize: "var(--text-xs)",
                padding: "2px 8px",
                borderRadius: "var(--radius-full)",
                backgroundColor: "var(--color-success-bg)",
                color: "var(--color-success)",
                fontWeight: 700,
              }}
            >
              {strongest_requirements.length}
            </span>
          </h2>
          <div
            className="card"
            style={{
              padding: "var(--space-4)",
              backgroundColor: "var(--bg-surface)",
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--space-2)",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginRight: "var(--space-2)" }}>
              Proficient Requirements:
            </span>
            {strongest_requirements.map((reqId) => (
              <span
                key={reqId}
                style={{
                  fontSize: "var(--text-xs)",
                  fontFamily: "var(--font-mono)",
                  padding: "4px 8px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--color-success-bg)",
                  color: "var(--color-success)",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                ✓ {reqId}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
