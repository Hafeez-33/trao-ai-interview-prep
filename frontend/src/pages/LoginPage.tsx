import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "@/services/api/auth.api.js";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner.js";
import { ErrorMessage } from "@/components/ui/ErrorMessage.js";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await authApi.login({ email, password });
      // Redirect to dashboard upon successful authentication
      navigate("/dashboard");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to sign in. Please verify your credentials.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "420px", margin: "var(--space-8) auto" }}>
      <div className="card">
        <h2 style={{ marginBottom: "var(--space-2)", textAlign: "center" }}>Sign In</h2>
        <p style={{ textAlign: "center", marginBottom: "var(--space-6)", fontSize: "var(--text-sm)" }}>
          Access your personalized interview prep kits
        </p>

        {error && (
          <div style={{ marginBottom: "var(--space-4)" }}>
            <ErrorMessage message={error} title="Sign In Error" />
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="login-email" className="form-label">
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="candidate@example.com"
              required
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password" className="form-label">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "var(--space-2)" }}
            disabled={loading}
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" label="Signing in..." />
                <span>Signing in...</span>
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div
          style={{
            marginTop: "var(--space-6)",
            textAlign: "center",
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
          }}
        >
          Don't have an account?{" "}
          <Link to="/register" style={{ fontWeight: 600 }}>
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
};
