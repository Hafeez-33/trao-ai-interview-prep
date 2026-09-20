import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { kitsApi } from "@/services/api/kits.api.js";
import { ApiClientError } from "@/services/api/client.js";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner.js";
import { ErrorMessage } from "@/components/ui/ErrorMessage.js";

const MAX_JD_CHARS = 50000;
const MIN_JD_CHARS = 10;

export const CreateKitPage: React.FC = () => {
  const navigate = useNavigate();

  const [jd, setJd] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [days, setDays] = useState<number>(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const charCount = jd.length;
  const isOverLimit = charCount > MAX_JD_CHARS;
  const isTooShort = charCount > 0 && charCount < MIN_JD_CHARS;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!jd.trim()) {
      setError("Please provide a Job Description to generate your interview kit.");
      return;
    }

    if (jd.trim().length < MIN_JD_CHARS) {
      setError(`Job Description must contain at least ${MIN_JD_CHARS} characters.`);
      return;
    }

    if (jd.length > MAX_JD_CHARS) {
      setError(`Job Description exceeds maximum limit of ${MAX_JD_CHARS.toLocaleString()} characters.`);
      return;
    }

    if (days < 1 || days > 60 || !Number.isInteger(days)) {
      setError("Preparation days must be an integer between 1 and 60.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await kitsApi.createKit({
        jd: jd.trim(),
        company_url: companyUrl.trim() || undefined,
        days: days || 5,
      });

      const kitId = response.kit._id;
      if (kitId) {
        navigate(`/kits/${kitId}/generate`);
      } else {
        throw new Error("Kit was created but no ID was returned.");
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.status === 401) {
        navigate("/login");
        return;
      }

      const message =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while creating your kit. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "760px", margin: "var(--space-6) auto" }}>
      <div className="card">
        <div style={{ marginBottom: "var(--space-6)" }}>
          <h1 style={{ fontSize: "var(--text-2xl)", marginBottom: "var(--space-2)" }}>
            Create Interview Prep Kit
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
            Enter the job description and optional company details. Our deterministic pipeline
            will research the role and synthesize tailored questions, flashcards, and a day-by-day plan.
          </p>
        </div>

        {error && (
          <div style={{ marginBottom: "var(--space-6)" }}>
            <ErrorMessage message={error} title="Unable to Create Kit" />
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Job Description */}
          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <label htmlFor="kit-jd" className="form-label">
                Job Description <span style={{ color: "var(--color-error)" }}>*</span>
              </label>
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  color: isOverLimit
                    ? "var(--color-error)"
                    : isTooShort
                    ? "var(--color-warning)"
                    : "var(--text-muted)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {charCount.toLocaleString()} / {MAX_JD_CHARS.toLocaleString()} chars
              </span>
            </div>
            <textarea
              id="kit-jd"
              className="form-input"
              rows={12}
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste the complete job description, requirements, and responsibilities here..."
              required
              disabled={loading}
              style={{
                fontFamily: "inherit",
                lineHeight: "var(--leading-relaxed)",
                resize: "vertical",
                borderColor: isOverLimit ? "var(--color-error)" : undefined,
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            {/* Company Website URL */}
            <div className="form-group">
              <label htmlFor="kit-company-url" className="form-label">
                Company Website URL <span style={{ color: "var(--text-muted)", fontWeight: "normal" }}>(Optional)</span>
              </label>
              <input
                id="kit-company-url"
                type="url"
                className="form-input"
                value={companyUrl}
                onChange={(e) => setCompanyUrl(e.target.value)}
                placeholder="https://example.com"
                disabled={loading}
              />
            </div>

            {/* Preparation Days */}
            <div className="form-group">
              <label htmlFor="kit-days" className="form-label">
                Preparation Days (1–60)
              </label>
              <input
                id="kit-days"
                type="number"
                min={1}
                max={60}
                className="form-input"
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value, 10) || 1)}
                disabled={loading}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div style={{ marginTop: "var(--space-6)", display: "flex", justifyContent: "flex-end", gap: "var(--space-4)" }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || isOverLimit}
              style={{ padding: "var(--space-3) var(--space-6)" }}
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" label="Creating Kit..." />
                  <span>Creating Kit...</span>
                </>
              ) : (
                "Generate Prep Kit →"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
