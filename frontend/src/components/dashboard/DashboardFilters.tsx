import React from "react";

export type StatusFilterOption = "all" | "in-progress" | "completed" | "failed";

export interface DashboardFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: StatusFilterOption;
  onStatusFilterChange: (filter: StatusFilterOption) => void;
  totalKits: number;
  filteredCount: number;
  onResetFilters: () => void;
}

export const DashboardFilters: React.FC<DashboardFiltersProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  totalKits,
  filteredCount,
  onResetFilters,
}) => {
  const isFiltered = searchQuery.trim() !== "" || statusFilter !== "all";

  const filterButtons: Array<{ id: StatusFilterOption; label: string }> = [
    { id: "all", label: "All Kits" },
    { id: "completed", label: "Completed" },
    { id: "in-progress", label: "In Progress" },
    { id: "failed", label: "Failed" },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
        marginBottom: "var(--space-6)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "var(--space-4)",
        }}
      >
        {/* Search Input */}
        <div style={{ position: "relative", flex: "1 1 280px", maxWidth: "420px" }}>
          <div
            style={{
              position: "absolute",
              left: "var(--space-3)",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              pointerEvents: "none",
              display: "flex",
              alignItems: "center",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            id="dashboard-search-input"
            type="search"
            className="form-input"
            placeholder="Search by role or company..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              paddingLeft: "var(--space-10)",
              fontSize: "var(--text-sm)",
            }}
            aria-label="Search kits by role or company"
          />
        </div>

        {/* Status Filter Buttons */}
        <div
          role="group"
          aria-label="Filter by kit status"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            flexWrap: "wrap",
          }}
        >
          {filterButtons.map((btn) => {
            const isSelected = statusFilter === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                onClick={() => onStatusFilterChange(btn.id)}
                className={`btn ${isSelected ? "btn-primary" : "btn-secondary"}`}
                style={{
                  fontSize: "var(--text-xs)",
                  padding: "var(--space-2) var(--space-3)",
                  borderRadius: "var(--radius-full)",
                }}
              >
                {btn.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Summary & Reset */}
      {isFiltered && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "var(--text-xs)",
            color: "var(--text-secondary)",
            padding: "var(--space-2) var(--space-3)",
            backgroundColor: "var(--bg-surface)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <span>
            Showing {filteredCount} of {totalKits} kits
          </span>
          <button
            type="button"
            onClick={onResetFilters}
            style={{
              color: "var(--color-primary-light)",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              padding: 0,
            }}
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
};
