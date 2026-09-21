import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { kitsApi } from "@/services/api/kits.api.js";
import { SafeKit } from "@/types/kit.js";
import { WeakSpotsReport as WeakSpotsReportType } from "@/types/weak-spots.js";
import { ApiClientError } from "@/services/api/client.js";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner.js";
import { ErrorMessage } from "@/components/ui/ErrorMessage.js";
import { WeakSpotsReport } from "@/components/weak-spots/WeakSpotsReport.js";

export const WeakSpotsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kit, setKit] = useState<SafeKit | null>(null);
  const [report, setReport] = useState<WeakSpotsReportType | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchReport = async () => {
      setLoading(true);
      setError(null);
      try {
        const [kitRes, reportRes] = await Promise.all([
          kitsApi.getKit(id),
          kitsApi.getWeakSpots(id),
        ]);
        setKit(kitRes.kit);
        setReport(reportRes.report);
      } catch (err: unknown) {
        if (err instanceof ApiClientError && err.status === 401) {
          navigate("/login");
          return;
        }
        const msg =
          err instanceof Error ? err.message : "Failed to load weak spots diagnostic report.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [id, navigate]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-16) 0" }}>
        <LoadingSpinner size="lg" label="Analyzing preparation weak spots..." />
        <p style={{ marginTop: "var(--space-4)", color: "var(--text-secondary)" }}>
          Analyzing requirement coverage and practice confidence...
        </p>
      </div>
    );
  }

  if (error || !report || !id) {
    return (
      <div style={{ maxWidth: "600px", margin: "var(--space-8) auto" }}>
        <ErrorMessage
          title="Weak Spots Report Unavailable"
          message={error || "The diagnostic report could not be generated for this kit."}
        />
        <div style={{ marginTop: "var(--space-4)", textAlign: "center", display: "flex", gap: "var(--space-3)", justifyContent: "center" }}>
          <Link to={id ? `/kits/${id}` : "/dashboard"} className="btn btn-primary">
            ← Return to Kit
          </Link>
          <Link to="/dashboard" className="btn btn-secondary">
            Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <WeakSpotsReport
      report={report}
      kitId={id}
      roleTitle={kit?.role?.title || kit?.source?.role}
      companyName={kit?.source?.company}
    />
  );
};
