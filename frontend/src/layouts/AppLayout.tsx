import React, { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { authApi } from "@/services/api/auth.api.js";
import { AuthUser } from "@/types/api.js";

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    let isMounted = true;
    authApi
      .getMe()
      .then((res) => {
        if (isMounted) setUser(res.user);
      })
      .catch(() => {
        if (isMounted) setUser(null);
      });
    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // continue navigation
    } finally {
      setUser(null);
      navigate("/login");
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header & Navigation */}
      <header
        style={{
          borderBottom: "1px solid var(--border-subtle)",
          backgroundColor: "rgba(17, 24, 39, 0.8)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div
          className="container"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: "64px",
          }}
        >
          <Link
            to="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              textDecoration: "none",
              color: "var(--text-primary)",
              fontWeight: 700,
              fontSize: "var(--text-lg)",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "var(--radius-md)",
                background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontWeight: 800,
                fontSize: "var(--text-base)",
              }}
            >
              T
            </div>
            <span>Trao</span>
            <span
              style={{
                fontSize: "var(--text-xs)",
                padding: "2px 6px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--color-primary-subtle)",
                color: "var(--color-primary-light)",
                fontWeight: 600,
              }}
            >
              AI Prep
            </span>
          </Link>

          <nav
            aria-label="Main Navigation"
            style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}
          >
            <Link
              to="/"
              className="nav-link"
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: 500,
                color: isActive("/") ? "var(--color-primary-light)" : "var(--text-secondary)",
                textDecoration: "none",
              }}
            >
              Home
            </Link>

            {user ? (
              <>
                <Link
                  to="/dashboard"
                  id="nav-dashboard-link"
                  className="nav-link"
                  style={{
                    fontSize: "var(--text-sm)",
                    fontWeight: 500,
                    color: isActive("/dashboard") ? "var(--color-primary-light)" : "var(--text-secondary)",
                    textDecoration: "none",
                  }}
                >
                  Dashboard
                </Link>
                <Link
                  to="/kits/new"
                  className="nav-link"
                  style={{
                    fontSize: "var(--text-sm)",
                    fontWeight: 500,
                    color: isActive("/kits/new") ? "var(--color-primary-light)" : "var(--text-secondary)",
                    textDecoration: "none",
                  }}
                >
                  Create Kit
                </Link>
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--text-muted)",
                    padding: "2px 8px",
                    borderRadius: "var(--radius-full)",
                    backgroundColor: "var(--bg-surface-raised)",
                  }}
                  title={user.email}
                >
                  {user.email}
                </span>
                <button
                  type="button"
                  id="nav-logout-btn"
                  onClick={handleLogout}
                  className="btn btn-secondary"
                  style={{
                    fontSize: "var(--text-xs)",
                    padding: "var(--space-1) var(--space-3)",
                  }}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/kits/new"
                  className="nav-link"
                  style={{
                    fontSize: "var(--text-sm)",
                    fontWeight: 500,
                    color: isActive("/kits/new") ? "var(--color-primary-light)" : "var(--text-secondary)",
                    textDecoration: "none",
                  }}
                >
                  Create Kit
                </Link>
                <Link
                  to="/login"
                  className="nav-link"
                  style={{
                    fontSize: "var(--text-sm)",
                    fontWeight: 500,
                    color: isActive("/login") ? "var(--color-primary-light)" : "var(--text-secondary)",
                    textDecoration: "none",
                  }}
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="btn btn-primary"
                  style={{
                    fontSize: "var(--text-xs)",
                    padding: "var(--space-2) var(--space-3)",
                  }}
                >
                  Get Started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: "var(--space-8) 0" }}>
        <div className="container">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--border-subtle)",
          padding: "var(--space-6) 0",
          backgroundColor: "var(--bg-canvas)",
          color: "var(--text-muted)",
          fontSize: "var(--text-xs)",
          textAlign: "center",
        }}
      >
        <div className="container">
          <p style={{ margin: 0, color: "var(--text-muted)" }}>
            Trao AI Interview Prep Kit &copy; {new Date().getFullYear()} &mdash; Grounded, Deterministic Interview Preparation.
          </p>
        </div>
      </footer>
    </div>
  );
};
