import React from "react";
import { Link } from "react-router-dom";

export const HomePage: React.FC = () => {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "var(--space-8) 0" }}>
      {/* Hero Section */}
      <section style={{ textAlign: "center", marginBottom: "var(--space-12)" }}>
        <div
          style={{
            display: "inline-block",
            padding: "var(--space-1) var(--space-3)",
            borderRadius: "var(--radius-full)",
            backgroundColor: "var(--color-primary-subtle)",
            color: "var(--color-primary-light)",
            fontSize: "var(--text-xs)",
            fontWeight: 600,
            marginBottom: "var(--space-4)",
          }}
        >
          Ground-Truth Interview Preparation
        </div>
        <h1
          style={{
            fontSize: "var(--text-4xl)",
            marginBottom: "var(--space-4)",
            background: "linear-gradient(135deg, #ffffff 30%, var(--text-secondary) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Personalized Interview Prep Kits from Job Descriptions
        </h1>
        <p
          style={{
            fontSize: "var(--text-lg)",
            color: "var(--text-secondary)",
            maxWidth: "640px",
            margin: "0 auto var(--space-8) auto",
          }}
        >
          Transform any Job Description and company website into a deterministic,
          highly tailored interview preparation kit with verified research,
          categorized questions, flashcards, and a day-by-day study schedule.
        </p>
        <div style={{ display: "flex", gap: "var(--space-4)", justifyContent: "center" }}>
          <Link to="/register" className="btn btn-primary" style={{ padding: "var(--space-3) var(--space-6)" }}>
            Create Your First Kit
          </Link>
          <Link to="/login" className="btn btn-secondary" style={{ padding: "var(--space-3) var(--space-6)" }}>
            Sign In to Existing Account
          </Link>
        </div>
      </section>

      {/* Highlights Grid */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "var(--space-6)",
          marginTop: "var(--space-12)",
        }}
      >
        <div className="card">
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--color-primary-subtle)",
              color: "var(--color-primary-light)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "var(--space-4)",
              fontWeight: 700,
            }}
          >
            1
          </div>
          <h3 style={{ marginBottom: "var(--space-2)", fontSize: "var(--text-lg)" }}>
            Factual Company Research
          </h3>
          <p style={{ fontSize: "var(--text-sm)" }}>
            SSRF-safe crawling extracts authentic company mission, product details,
            and hiring stages without hallucinated claims.
          </p>
        </div>

        <div className="card">
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--color-accent-subtle)",
              color: "var(--color-accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "var(--space-4)",
              fontWeight: 700,
            }}
          >
            2
          </div>
          <h3 style={{ marginBottom: "var(--space-2)", fontSize: "var(--text-lg)" }}>
            Deterministic Coverage
          </h3>
          <p style={{ fontSize: "var(--text-sm)" }}>
            Code-level verification ensures 100% of must-have requirements have targeted
            technical and behavioural questions.
          </p>
        </div>

        <div className="card">
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--color-success-bg)",
              color: "var(--color-success)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "var(--space-4)",
              fontWeight: 700,
            }}
          >
            3
          </div>
          <h3 style={{ marginBottom: "var(--space-2)", fontSize: "var(--text-lg)" }}>
            Mathematical Schedule
          </h3>
          <p style={{ fontSize: "var(--text-sm)" }}>
            Questions are balanced across 1 to 60 days, prioritizing foundational concepts
            early and review mock sessions near interview day.
          </p>
        </div>
      </section>
    </div>
  );
};
