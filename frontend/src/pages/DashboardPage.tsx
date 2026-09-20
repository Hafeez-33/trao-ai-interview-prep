import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "@/services/api/auth.api.js";
import { kitsApi } from "@/services/api/kits.api.js";
import { SafeKitSummary } from "@/types/kit.js";
import { ApiClientError } from "@/services/api/client.js";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner.js";
import { ErrorMessage } from "@/components/ui/ErrorMessage.js";
import { EmptyState } from "@/components/ui/EmptyState.js";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader.js";
import { DashboardFilters, StatusFilterOption } from "@/components/dashboard/DashboardFilters.js";
import { KitGrid } from "@/components/dashboard/KitGrid.js";
import { DeleteKitDialog } from "@/components/dashboard/DeleteKitDialog.js";

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  // State
  const [kits, setKits] = useState<SafeKitSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>("all");

  // Deletion modal state
  const [kitToDelete, setKitToDelete] = useState<SafeKitSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Fetch Kits
  const fetchKits = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Verify authentication session
      await authApi.getMe();

      // 2. Fetch user's kits
      const res = await kitsApi.listKits();
      setKits(res.kits || []);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.status === 401) {
          navigate("/login");
          return;
        }
        if (err.status === 403) {
          setError("Access denied. You do not have permission to view these preparation kits.");
          return;
        }
        if (err.status === 404) {
          setError("The requested preparation kits resource was not found.");
          return;
        }
      }
      setError("We couldn't load your Kits. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchKits();
  }, [fetchKits]);

  // Deterministic sorting (newest first, _id as tiebreaker)
  const sortedKits = useMemo(() => {
    return [...kits].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (dateB !== dateA) {
        return dateB - dateA;
      }
      return (b._id || "").localeCompare(a._id || "");
    });
  }, [kits]);

  // Filtered kits
  const filteredKits = useMemo(() => {
    return sortedKits.filter((kit) => {
      // Search query filter (company or role)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesCompany = (kit.company || "").toLowerCase().includes(query);
        const matchesRole = (kit.role || "").toLowerCase().includes(query);
        if (!matchesCompany && !matchesRole) {
          return false;
        }
      }

      // Status filter
      if (statusFilter === "completed") {
        return kit.status === "completed";
      }
      if (statusFilter === "in-progress") {
        return kit.status === "pending" || kit.status === "crawling" || kit.status === "generating";
      }
      if (statusFilter === "failed") {
        return kit.status === "failed";
      }

      return true;
    });
  }, [sortedKits, searchQuery, statusFilter]);

  // Delete Handlers
  const handleOpenDeleteDialog = (kit: SafeKitSummary) => {
    setKitToDelete(kit);
    setDeleteError(null);
  };

  const handleCloseDeleteDialog = () => {
    if (isDeleting) return;
    setKitToDelete(null);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!kitToDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await kitsApi.deleteKit(kitToDelete._id);
      // Remove kit from local state on success without reloading the page
      setKits((prev) => prev.filter((k) => k._id !== kitToDelete._id));
      setKitToDelete(null);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to delete prep kit. Please try again.";
      setDeleteError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
  };

  // 1. Loading State
  if (loading) {
    return (
      <div
        id="dashboard-loading-state"
        style={{
          textAlign: "center",
          padding: "var(--space-16) 0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--space-4)",
        }}
      >
        <LoadingSpinner size="lg" label="Loading your interview kits..." />
        <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-base)", margin: 0 }}>
          Loading your interview kits...
        </p>
      </div>
    );
  }

  // 2. Error State
  if (error) {
    return (
      <div id="dashboard-error-state" style={{ maxWidth: "600px", margin: "var(--space-8) auto" }}>
        <ErrorMessage
          title="Failed to Load Dashboard"
          message={error}
          onRetry={fetchKits}
        />
      </div>
    );
  }

  // 3. Empty State (User has no kits at all)
  if (kits.length === 0) {
    return (
      <div id="dashboard-empty-state" style={{ maxWidth: "680px", margin: "var(--space-8) auto" }}>
        <DashboardHeader totalKits={0} />
        <EmptyState
          title="No interview kits yet"
          description="Transform any Job Description and company website into a personalized, grounded interview prep kit with tailored questions, flashcards, and a daily study schedule."
          icon={
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          }
          action={
            <Link
              to="/kits/new"
              id="empty-state-create-cta"
              className="btn btn-primary"
              style={{ padding: "var(--space-3) var(--space-6)" }}
            >
              + Create Your First Kit
            </Link>
          }
        />
      </div>
    );
  }

  // 4. Populated Dashboard
  return (
    <div id="dashboard-page" style={{ maxWidth: "1200px", margin: "0 auto", paddingBottom: "var(--space-12)" }}>
      {/* Dashboard Header */}
      <DashboardHeader totalKits={kits.length} />

      {/* Filters & Search */}
      <DashboardFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        totalKits={kits.length}
        filteredCount={filteredKits.length}
        onResetFilters={handleResetFilters}
      />

      {/* Filtered Empty State */}
      {filteredKits.length === 0 ? (
        <EmptyState
          title="No matching interview kits"
          description="No kits match your current search and filter criteria. Try adjusting your query or resetting the filters."
          action={
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleResetFilters}
            >
              Clear filters
            </button>
          }
        />
      ) : (
        /* Kit Grid */
        <KitGrid kits={filteredKits} onDeleteKit={handleOpenDeleteDialog} />
      )}

      {/* Explicit Delete Confirmation Dialog */}
      <DeleteKitDialog
        isOpen={kitToDelete !== null}
        kitRole={kitToDelete?.role || "Untitled Role"}
        kitCompany={kitToDelete?.company || "Target Company"}
        isDeleting={isDeleting}
        deleteError={deleteError}
        onConfirm={handleConfirmDelete}
        onCancel={handleCloseDeleteDialog}
      />
    </div>
  );
};
