import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { kitsApi } from "@/services/api/kits.api.js";
import { SafeKit, KitQuestion, KitFlashcard } from "@/types/kit.js";
import { ApiClientError } from "@/services/api/client.js";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner.js";
import { ErrorMessage } from "@/components/ui/ErrorMessage.js";

export const KitPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [kit, setKit] = useState<SafeKit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"questions" | "schedule" | "flashcards" | "requirements" | "company">("questions");
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!id) return;

    const fetchKit = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await kitsApi.getKit(id);
        setKit(res.kit);
      } catch (err: unknown) {
        if (err instanceof ApiClientError && err.status === 401) {
          navigate("/login");
          return;
        }
        const msg = err instanceof Error ? err.message : "Failed to load prep kit.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchKit();
  }, [id, navigate]);

  const toggleFlip = (cardId: string) => {
    setFlippedCards((prev) => ({ ...prev, [cardId]: !prev[cardId] }));
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-16) 0" }}>
        <LoadingSpinner size="lg" label="Loading Interview Prep Kit..." />
        <p style={{ marginTop: "var(--space-4)", color: "var(--text-secondary)" }}>
          Loading Interview Prep Kit...
        </p>
      </div>
    );
  }

  if (error || !kit) {
    return (
      <div style={{ maxWidth: "600px", margin: "var(--space-8) auto" }}>
        <ErrorMessage
          title="Kit Unavailable"
          message={error || "The requested interview kit could not be loaded."}
        />
        <div style={{ marginTop: "var(--space-4)", textAlign: "center" }}>
          <Link to="/" className="btn btn-secondary">
            ← Return to Home
          </Link>
        </div>
      </div>
    );
  }

  const roleTitle = kit.role?.title || kit.source?.role || "Interview Prep Kit";
  const seniority = kit.role?.seniority;
  const company = kit.source?.company || "Target Company";
  const location = kit.source?.location;
  const daysAvailable = kit.schedule?.days_available || kit.schedule?.days?.length || 5;

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", paddingBottom: "var(--space-12)" }}>
      {/* Kit Header Banner */}
      <div className="card" style={{ marginBottom: "var(--space-6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-4)" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
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
                {seniority ? `${seniority} Level` : "Interview Prep"}
              </span>
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  padding: "2px 8px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--color-success-bg)",
                  color: "var(--color-success)",
                  fontWeight: 600,
                }}
              >
                ✓ Verified
              </span>
            </div>
            <h1 style={{ fontSize: "var(--text-2xl)", marginBottom: "var(--space-1)" }}>
              {roleTitle}
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-base)", margin: 0 }}>
              {company} {location ? `• ${location}` : ""} &bull; {daysAvailable} Days Study Plan
            </p>
          </div>

          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <Link
              to={`/kits/${id}/practice`}
              className="btn btn-primary"
              style={{
                fontSize: "var(--text-xs)",
                backgroundColor: "var(--color-primary-light)",
                fontWeight: 600,
              }}
            >
              🎯 Practice Questions
            </Link>
            <Link to={`/kits/${id}/builder`} className="btn btn-secondary" style={{ fontSize: "var(--text-xs)" }}>
              ✏ Edit Kit
            </Link>
            <Link to="/kits/new" className="btn btn-secondary" style={{ fontSize: "var(--text-xs)" }}>
              + New Kit
            </Link>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border-subtle)",
          marginBottom: "var(--space-6)",
          gap: "var(--space-2)",
          overflowX: "auto",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("questions")}
          style={{
            padding: "var(--space-3) var(--space-4)",
            borderBottom: activeTab === "questions" ? "2px solid var(--color-primary-light)" : "2px solid transparent",
            color: activeTab === "questions" ? "var(--color-primary-light)" : "var(--text-secondary)",
            fontWeight: 600,
            fontSize: "var(--text-sm)",
            whiteSpace: "nowrap",
          }}
        >
          Questions ({kit.questions?.length || 0})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("schedule")}
          style={{
            padding: "var(--space-3) var(--space-4)",
            borderBottom: activeTab === "schedule" ? "2px solid var(--color-primary-light)" : "2px solid transparent",
            color: activeTab === "schedule" ? "var(--color-primary-light)" : "var(--text-secondary)",
            fontWeight: 600,
            fontSize: "var(--text-sm)",
            whiteSpace: "nowrap",
          }}
        >
          Schedule ({kit.schedule?.days?.length || 0} Days)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("flashcards")}
          style={{
            padding: "var(--space-3) var(--space-4)",
            borderBottom: activeTab === "flashcards" ? "2px solid var(--color-primary-light)" : "2px solid transparent",
            color: activeTab === "flashcards" ? "var(--color-primary-light)" : "var(--text-secondary)",
            fontWeight: 600,
            fontSize: "var(--text-sm)",
            whiteSpace: "nowrap",
          }}
        >
          Flashcards ({kit.flashcards?.length || 0})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("requirements")}
          style={{
            padding: "var(--space-3) var(--space-4)",
            borderBottom: activeTab === "requirements" ? "2px solid var(--color-primary-light)" : "2px solid transparent",
            color: activeTab === "requirements" ? "var(--color-primary-light)" : "var(--text-secondary)",
            fontWeight: 600,
            fontSize: "var(--text-sm)",
            whiteSpace: "nowrap",
          }}
        >
          Requirements ({kit.role?.requirements?.length || 0})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("company")}
          style={{
            padding: "var(--space-3) var(--space-4)",
            borderBottom: activeTab === "company" ? "2px solid var(--color-primary-light)" : "2px solid transparent",
            color: activeTab === "company" ? "var(--color-primary-light)" : "var(--text-secondary)",
            fontWeight: 600,
            fontSize: "var(--text-sm)",
            whiteSpace: "nowrap",
          }}
        >
          Company Brief
        </button>
      </div>

      {/* Tab: Questions */}
      {activeTab === "questions" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {(kit.questions || []).map((q: KitQuestion, idx: number) => {
            const diffLabel = q.difficulty === 3 ? "Advanced" : q.difficulty === 2 ? "Intermediate" : "Beginner";
            const diffColor =
              q.difficulty === 3 ? "var(--color-error)" : q.difficulty === 2 ? "var(--color-warning)" : "var(--color-success)";

            return (
              <div key={q.id || idx} className="card" style={{ padding: "var(--space-5)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
                  <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
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
                        color: diffColor,
                        fontWeight: 600,
                      }}
                    >
                      {diffLabel}
                    </span>
                  </div>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {q.id}
                  </span>
                </div>

                <h3 style={{ fontSize: "var(--text-base)", marginBottom: "var(--space-3)", color: "var(--text-primary)" }}>
                  {q.prompt}
                </h3>

                <div
                  style={{
                    backgroundColor: "var(--bg-canvas)",
                    padding: "var(--space-3) var(--space-4)",
                    borderRadius: "var(--radius-md)",
                    borderLeft: "3px solid var(--color-primary)",
                  }}
                >
                  <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-muted)", marginBottom: "4px" }}>
                    ANSWER OUTLINE / KEY POINTS
                  </div>
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: 0 }}>
                    {q.answer_outline}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: Schedule */}
      {activeTab === "schedule" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {(kit.schedule?.days || []).map((dayItem) => (
            <div key={dayItem.day} className="card" style={{ padding: "var(--space-5)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    padding: "2px 8px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "var(--color-accent-subtle)",
                    color: "var(--color-accent)",
                    fontWeight: 700,
                  }}
                >
                  Day {dayItem.day}
                </span>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 600 }}>
                  ⏱ ~{dayItem.minutes} Minutes
                </span>
              </div>

              <h3 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-2)" }}>
                {dayItem.focus}
              </h3>

              <div style={{ marginTop: "var(--space-3)" }}>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "var(--space-2)", fontWeight: 600 }}>
                  SCHEDULED QUESTIONS:
                </div>
                {dayItem.question_ids && dayItem.question_ids.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                    {dayItem.question_ids.map((qid) => {
                      const matchedQ = kit.questions?.find((q) => q.id === qid);
                      return (
                        <div
                          key={qid}
                          style={{
                            padding: "var(--space-2) var(--space-3)",
                            backgroundColor: "var(--bg-canvas)",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: "var(--radius-md)",
                            fontSize: "var(--text-xs)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          <strong style={{ color: "var(--color-primary-light)" }}>{qid}</strong>:{" "}
                          {matchedQ?.prompt ? matchedQ.prompt.slice(0, 60) + "..." : qid}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", margin: 0 }}>
                    Consolidation, Mock Practice & Review Day
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Flashcards */}
      {activeTab === "flashcards" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-4)" }}>
          {(kit.flashcards || []).map((f: KitFlashcard, idx: number) => {
            const isFlipped = flippedCards[f.id || idx];
            return (
              <div
                key={f.id || idx}
                className="card"
                onClick={() => toggleFlip(f.id || String(idx))}
                style={{
                  cursor: "pointer",
                  minHeight: "180px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  backgroundColor: isFlipped ? "var(--bg-surface-raised)" : "var(--bg-surface)",
                  border: isFlipped ? "1px solid var(--color-primary-light)" : "1px solid var(--border-subtle)",
                  transition: "all 0.2s ease-in-out",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 700 }}>
                      {isFlipped ? "ANSWER / BACK" : "PROMPT / FRONT"}
                    </span>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                      {f.id}
                    </span>
                  </div>
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", margin: 0 }}>
                    {isFlipped ? f.back : f.front}
                  </p>
                </div>
                <div style={{ textAlign: "right", marginTop: "var(--space-4)", fontSize: "var(--text-xs)", color: "var(--color-primary-light)" }}>
                  {isFlipped ? "Click to show question ↺" : "Click to reveal answer ↻"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: Requirements */}
      {activeTab === "requirements" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {(kit.role?.requirements || []).map((r, idx) => (
            <div key={r.id || idx} className="card" style={{ padding: "var(--space-4)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", marginBottom: "4px" }}>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                    {r.id}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      padding: "1px 6px",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: r.priority === "must" ? "var(--color-error-bg)" : "var(--bg-surface-raised)",
                      color: r.priority === "must" ? "var(--color-error)" : "var(--text-muted)",
                      fontWeight: 600,
                    }}
                  >
                    {r.priority === "must" ? "Must-Have" : "Nice-to-Have"}
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
                    {r.kind}
                  </span>
                </div>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", margin: 0 }}>
                  {r.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Company Brief */}
      {activeTab === "company" && (
        <div className="card" style={{ padding: "var(--space-6)" }}>
          <h2 style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-4)" }}>
            About {kit.source?.company || "Company"}
          </h2>

          <div style={{ marginBottom: "var(--space-6)" }}>
            <h4 style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginBottom: "var(--space-1)" }}>
              COMPANY SUMMARY
            </h4>
            <p style={{ fontSize: "var(--text-base)", color: "var(--text-primary)" }}>
              {kit.company_brief?.summary || "No company summary recorded."}
            </p>
          </div>

          <div style={{ marginBottom: "var(--space-6)" }}>
            <h4 style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginBottom: "var(--space-1)" }}>
              WHAT THEY DO
            </h4>
            <p style={{ fontSize: "var(--text-base)", color: "var(--text-primary)" }}>
              {kit.company_brief?.what_they_do || "No product description recorded."}
            </p>
          </div>

          {kit.company_brief?.sources && kit.company_brief.sources.length > 0 && (
            <div>
              <h4 style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginBottom: "var(--space-2)" }}>
                VERIFIED SOURCES CITED
              </h4>
              <ul style={{ paddingLeft: "var(--space-4)", fontSize: "var(--text-xs)", color: "var(--color-primary-light)" }}>
                {kit.company_brief.sources.map((src, sIdx) => (
                  <li key={sIdx} style={{ marginBottom: "4px" }}>
                    <a href={src} target="_blank" rel="noopener noreferrer">
                      {src}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
