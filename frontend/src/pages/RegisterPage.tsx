import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "@/services/api/auth.api.js";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner.js";
import { ErrorMessage } from "@/components/ui/ErrorMessage.js";

export const RegisterPage: React.FC = () => {
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

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await authApi.register({ email, password });
      // Redirect to dashboard upon successful registration
      navigate("/dashboard");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Registration failed. Please check your details.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "420px", margin: "var(--space-8) auto" }}>
      <div className="card">
        <h2 style={{ marginBottom: "var(--space-2)", textAlign: "center" }}>Create Account</h2>
        <p style={{ textAlign: "center", marginBottom: "var(--space-6)", fontSize: "var(--text-sm)" }}>
          Sign up to generate personalized interview prep kits
        </p>

        {error && (
          <div style={{ marginBottom: "var(--space-4)" }}>
            <ErrorMessage message={error} title="Registration Error" />
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="register-email" className="form-label">
              Email Address
            </label>
            <input
              id="register-email"
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
            <label htmlFor="register-password" className="form-label">
              Password (min. 8 characters)
            </label>
            <input
              id="register-password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="new-password"
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
                <LoadingSpinner size="sm" label="Creating account..." />
                <span>Creating account...</span>
              </>
            ) : (
              "Sign Up"
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
          Already have an account?{" "}
          <Link to="/login" style={{ fontWeight: 600 }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
