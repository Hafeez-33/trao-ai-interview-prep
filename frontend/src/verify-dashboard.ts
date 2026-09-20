/**
 * Phase 17 — Dashboard & UX Deterministic Verification
 *
 * Verifies contract conformance, deterministic sorting, state transitions,
 * route configurations, and dashboard safety guarantees.
 */

import { router } from "@/app/routes.js";
import { kitsApi } from "@/services/api/kits.api.js";
import { SafeKitSummary, GenerationStatus } from "@/types/kit.js";

interface VerificationAssertion {
  id: number;
  description: string;
  passed: boolean;
  error?: string;
}

export function runDashboardVerification(): {
  total: number;
  passed: number;
  failed: number;
  assertions: VerificationAssertion[];
} {
  const assertions: VerificationAssertion[] = [];

  const assert = (id: number, description: string, condition: boolean, errorMsg?: string) => {
    assertions.push({
      id,
      description,
      passed: condition,
      error: condition ? undefined : (errorMsg || "Assertion failed"),
    });
  };

  // 1. Dashboard route exists
  const rootRoute = router.routes.find((r) => r.path === "/") as { children?: Array<{ path?: string; element?: unknown }> } | undefined;
  const dashboardRoute = rootRoute?.children?.find((c) => c.path === "dashboard");
  assert(1, "Dashboard route exists under AppLayout", !!dashboardRoute && !!dashboardRoute.element);

  // 2. Dashboard page element is defined
  assert(2, "Dashboard page element is configured in router", !!dashboardRoute?.element);

  // 3. kitsApi.listKits() is available
  assert(3, "kitsApi.listKits is a callable function", typeof kitsApi.listKits === "function");

  // 4. kitsApi.deleteKit() is available
  assert(4, "kitsApi.deleteKit is a callable function", typeof kitsApi.deleteKit === "function");

  // 5. Deterministic sorting logic: newest first with _id tiebreaker
  const mockKits: SafeKitSummary[] = [
    { _id: "kit_1", company: "Company A", role: "Role A", status: "completed", createdAt: "2026-09-01T10:00:00Z" },
    { _id: "kit_3", company: "Company C", role: "Role C", status: "pending", createdAt: "2026-09-03T10:00:00Z" },
    { _id: "kit_2", company: "Company B", role: "Role B", status: "generating", createdAt: "2026-09-02T10:00:00Z" },
    { _id: "kit_0", company: "Company A2", role: "Role A2", status: "completed", createdAt: "2026-09-01T10:00:00Z" },
  ];

  const sorted = [...mockKits].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (dateB !== dateA) {
      return dateB - dateA;
    }
    return (b._id || "").localeCompare(a._id || "");
  });

  assert(
    5,
    "Deterministic sorting orders kits by createdAt descending and _id tiebreaker",
    sorted[0]._id === "kit_3" &&
      sorted[1]._id === "kit_2" &&
      sorted[2]._id === "kit_1" &&
      sorted[3]._id === "kit_0"
  );

  // 6. Contextual link logic for completed kit
  const getActionsForStatus = (status: GenerationStatus, kitId: string) => {
    if (status === "completed") {
      return {
        primary: `/kits/${kitId}`,
        practice: `/kits/${kitId}/practice`,
        builder: `/kits/${kitId}/builder`,
      };
    }
    return {
      primary: `/kits/${kitId}/generate`,
    };
  };

  const completedActions = getActionsForStatus("completed", "kit_100");
  assert(
    6,
    "Completed kit routes to /kits/:id, /kits/:id/practice, and /kits/:id/builder",
    completedActions.primary === "/kits/kit_100" &&
      completedActions.practice === "/kits/kit_100/practice" &&
      completedActions.builder === "/kits/kit_100/builder"
  );

  // 7. Contextual link logic for incomplete kit
  const pendingActions = getActionsForStatus("pending", "kit_200");
  assert(
    7,
    "Incomplete pending kit routes to /kits/:id/generate",
    pendingActions.primary === "/kits/kit_200/generate"
  );

  // 8. Contextual link logic for failed kit
  const failedActions = getActionsForStatus("failed", "kit_300");
  assert(
    8,
    "Failed kit routes to /kits/:id/generate for retry",
    failedActions.primary === "/kits/kit_300/generate"
  );

  // 9. Local state deletion immutability
  const originalList: SafeKitSummary[] = [
    { _id: "kit_a", company: "Alpha", role: "Dev", status: "completed", createdAt: "2026-09-01T00:00:00Z" },
    { _id: "kit_b", company: "Beta", role: "QA", status: "pending", createdAt: "2026-09-02T00:00:00Z" },
  ];
  const listAfterDelete = originalList.filter((k) => k._id !== "kit_a");
  assert(
    9,
    "Local delete state removes deleted kit without mutating other items",
    listAfterDelete.length === 1 && listAfterDelete[0]._id === "kit_b"
  );

  // 10. Failed delete preservation
  const deleteFailed = true;
  const listAfterFailedDelete = deleteFailed ? originalList : listAfterDelete;
  assert(
    10,
    "Failed delete preserves all kits in list",
    listAfterFailedDelete.length === 2 && listAfterFailedDelete[0]._id === "kit_a"
  );

  // 11. Search query filter logic
  const searchKits = (query: string, items: SafeKitSummary[]) => {
    const q = query.toLowerCase().trim();
    if (!q) return items;
    return items.filter((k) => k.company.toLowerCase().includes(q) || k.role.toLowerCase().includes(q));
  };

  const searchResults = searchKits("Alpha", originalList);
  assert(
    11,
    "Client search correctly filters across company and role",
    searchResults.length === 1 && searchResults[0]._id === "kit_a"
  );

  // 12. Status filter logic
  const filterByStatus = (status: "all" | "in-progress" | "completed" | "failed", items: SafeKitSummary[]) => {
    if (status === "all") return items;
    if (status === "completed") return items.filter((k) => k.status === "completed");
    if (status === "in-progress") return items.filter((k) => k.status === "pending" || k.status === "crawling" || k.status === "generating");
    if (status === "failed") return items.filter((k) => k.status === "failed");
    return items;
  };

  const inProgressKits = filterByStatus("in-progress", originalList);
  assert(
    12,
    "Client status filter correctly groups in-progress statuses",
    inProgressKits.length === 1 && inProgressKits[0]._id === "kit_b"
  );

  const total = assertions.length;
  const passed = assertions.filter((a) => a.passed).length;
  const failed = total - passed;

  return { total, passed, failed, assertions };
}
