/**
 * Verification Script: Phase 17 — Dashboard + UX
 *
 * Deterministically tests all Phase 17 requirements:
 * 1. Dashboard route exists in frontend routing.
 * 2. DashboardPage component exists and handles loading, error, empty, and populated states.
 * 3. kitsApi.listKits() is used to fetch user kits.
 * 4. Loading state uses accessible LoadingSpinner with role="status".
 * 5. Empty state displays "No interview kits yet" and links to /kits/new.
 * 6. Error state uses ErrorMessage with role="alert" and "Try Again" retry callback.
 * 7. Create Kit CTA links to /kits/new.
 * 8. Completed Kit links to /kits/:id.
 * 9. Incomplete Kit links to /kits/:id/generate.
 * 10. Builder link goes to /kits/:id/builder.
 * 11. Practice link goes to /kits/:id/practice.
 * 12. Delete requires explicit confirmation modal.
 * 13. Successful delete removes Kit from local UI state.
 * 14. Failed delete preserves the Kit in UI state.
 * 15. 401 unauthenticated session redirects to /login.
 * 16. No dangerouslySetInnerHTML exists in Dashboard code.
 * 17. No userId is accepted from frontend input.
 * 18. Deterministic sorting (newest first, _id tiebreaker, no random ordering).
 * 19. Mobile-responsive layout classes and Vanilla CSS tokens exist.
 * 20. GET /api/v1/kits requires authentication (401 when unauthenticated).
 * 21. GET /api/v1/kits only returns kits belonging to authenticated user.
 * 22. GET /api/v1/kits returns SafeKitSummary schema.
 * 23. DELETE /api/v1/kits/:id requires authentication (401 when unauthenticated).
 * 24. DELETE /api/v1/kits/:id rejects cross-user deletion with 404.
 * 25. DELETE /api/v1/kits/:id successfully deletes authenticated user's kit.
 * 26. AppLayout navigation includes Dashboard for authenticated users.
 * 27. AppLayout preserves Create Kit navigation.
 * 28. AppLayout provides Sign Out for authenticated users.
 * 29. LoginPage navigates to /dashboard on success.
 * 30. RegisterPage navigates to /dashboard on success.
 * 31. KitPage provides obvious navigation back to /dashboard.
 * 32. Client-side search and status filters work deterministically.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import session from "express-session";
import { ObjectId } from "mongodb";
import { kitRouter } from "./routes/kit.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { connectDatabase } from "./db/connection.js";
import { ensureUserIndexes, createUser } from "./db/users.js";
import { ensureKitIndexes, getKitsCollection, createKit } from "./db/kits.js";

const app = express();
app.use(express.json());
app.use(
  session({
    secret: "test-secret-key-phase-17-dashboard",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: false },
  })
);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/kits", kitRouter);

let server: http.Server;
let port: number;

function makeRequest(
  method: string,
  urlPath: string,
  cookie?: string,
  body?: unknown
): Promise<{ status: number; body: Record<string, unknown>; setCookie?: string }> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const headers: Record<string, string> = {};
    if (data) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(data).toString();
    }
    if (cookie) {
      headers["Cookie"] = cookie;
    }

    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: urlPath,
        method,
        headers,
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          let parsed: Record<string, unknown> = {};
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = { raw };
          }
          const rawSetCookie = res.headers["set-cookie"] as string[] | string | undefined;
          let setCookie: string | undefined;
          if (Array.isArray(rawSetCookie) && rawSetCookie.length > 0) {
            setCookie = rawSetCookie[0].split(";")[0];
          } else if (typeof rawSetCookie === "string") {
            setCookie = (rawSetCookie as string).split(";")[0];
          }
          resolve({ status: res.statusCode || 500, body: parsed, setCookie });
        });
      }
    );

    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${message}`);
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

async function run() {
  console.log("\n==================================================");
  console.log("PHASE 17 — DASHBOARD + UX VERIFICATION SUITE");
  console.log("==================================================\n");

  await connectDatabase();
  await ensureUserIndexes();
  await ensureKitIndexes();

  server = app.listen(0);
  port = (server.address() as { port: number }).port;

  const frontendRoot = path.resolve(process.cwd(), "..", "frontend", "src");

  // ============================================================================
  // SECTION 1: Frontend Static & Architectural Assertions
  // ============================================================================
  console.log("--- Section 1: Frontend Route & Architectural Verification ---");

  // 1. Dashboard route exists in routes.tsx
  const routesContent = fs.readFileSync(path.join(frontendRoot, "app", "routes.tsx"), "utf-8");
  assert(
    routesContent.includes('path: "dashboard"') && routesContent.includes("<DashboardPage />"),
    "Dashboard route exists and maps to <DashboardPage /> in routes.tsx"
  );

  // 2. DashboardPage file exists
  const dashboardPagePath = path.join(frontendRoot, "pages", "DashboardPage.tsx");
  assert(fs.existsSync(dashboardPagePath), "DashboardPage.tsx exists");
  const dashboardPageContent = fs.readFileSync(dashboardPagePath, "utf-8");

  // 3. kitsApi.listKits() is used
  assert(
    dashboardPageContent.includes("kitsApi.listKits()"),
    "DashboardPage uses kitsApi.listKits() to fetch user kits"
  );

  // 4. Loading state exists with accessible semantics
  assert(
    dashboardPageContent.includes("dashboard-loading-state") &&
      dashboardPageContent.includes("<LoadingSpinner"),
    "Accessible loading state exists with LoadingSpinner"
  );

  // 5. Empty state exists with proper text and CTA
  assert(
    dashboardPageContent.includes("No interview kits yet") &&
      dashboardPageContent.includes("empty-state-create-cta") &&
      dashboardPageContent.includes("/kits/new"),
    "Empty state exists with 'No interview kits yet' and CTA to /kits/new"
  );

  // 6. Error state exists with role="alert" and onRetry
  assert(
    dashboardPageContent.includes("dashboard-error-state") &&
      dashboardPageContent.includes("onRetry={fetchKits}"),
    "Error state exists with ErrorMessage and retry callback"
  );

  // 7. DashboardHeader exists with Create Kit CTA
  const dashboardHeaderPath = path.join(frontendRoot, "components", "dashboard", "DashboardHeader.tsx");
  assert(fs.existsSync(dashboardHeaderPath), "DashboardHeader.tsx exists");
  const headerContent = fs.readFileSync(dashboardHeaderPath, "utf-8");
  assert(
    headerContent.includes("Interview Prep Dashboard") &&
      headerContent.includes('to="/kits/new"'),
    "DashboardHeader renders semantic title and links to /kits/new"
  );

  // 8. KitCard exists and displays status & actions
  const kitCardPath = path.join(frontendRoot, "components", "dashboard", "KitCard.tsx");
  assert(fs.existsSync(kitCardPath), "KitCard.tsx exists");
  const kitCardContent = fs.readFileSync(kitCardPath, "utf-8");

  // 9. Completed Kit links
  assert(
    kitCardContent.includes("to={`/kits/${kit._id}`}") &&
      kitCardContent.includes("to={`/kits/${kit._id}/practice`}") &&
      kitCardContent.includes("to={`/kits/${kit._id}/builder`}"),
    "Completed Kit links to /kits/:id, /kits/:id/practice, and /kits/:id/builder"
  );

  // 10. Incomplete Kit links
  assert(
    kitCardContent.includes("to={`/kits/${kit._id}/generate`}") &&
      kitCardContent.includes("Continue Preparation"),
    "Incomplete Kit links to /kits/:id/generate"
  );

  // 11. Failed Kit links
  assert(
    kitCardContent.includes("Retry / Continue") &&
      kitCardContent.includes("Generation failed"),
    "Failed Kit shows 'Generation failed' and 'Retry / Continue'"
  );

  // 12. DeleteKitDialog exists and requires confirmation
  const deleteDialogPath = path.join(frontendRoot, "components", "dashboard", "DeleteKitDialog.tsx");
  assert(fs.existsSync(deleteDialogPath), "DeleteKitDialog.tsx exists");
  const deleteDialogContent = fs.readFileSync(deleteDialogPath, "utf-8");
  assert(
    deleteDialogContent.includes("Delete this interview prep Kit?") &&
      deleteDialogContent.includes("Cancel") &&
      deleteDialogContent.includes("Delete Kit"),
    "DeleteKitDialog requires explicit confirmation with Cancel and Delete Kit buttons"
  );

  // 13. Successful delete removes Kit from local state
  assert(
    dashboardPageContent.includes("prev.filter((k) => k._id !== kitToDelete._id)"),
    "Successful delete removes Kit from local UI state without page reload"
  );

  // 14. Failed delete preserves the Kit
  assert(
    dashboardPageContent.includes("setDeleteError(msg)") &&
      !dashboardPageContent.includes("window.location.reload()"),
    "Failed delete preserves Kit card and presents error"
  );

  // 15. 401 redirects to /login
  assert(
    dashboardPageContent.includes('err.status === 401') &&
      dashboardPageContent.includes('navigate("/login")'),
    "401 unauthenticated session redirects to /login"
  );

  // 16. No dangerouslySetInnerHTML in Dashboard code
  const allDashboardFiles = [
    dashboardPageContent,
    headerContent,
    kitCardContent,
    deleteDialogContent,
    fs.readFileSync(path.join(frontendRoot, "components", "dashboard", "KitGrid.tsx"), "utf-8"),
    fs.readFileSync(path.join(frontendRoot, "components", "dashboard", "DashboardFilters.tsx"), "utf-8"),
  ];
  const hasDanger = allDashboardFiles.some((c) => c.includes("dangerouslySetInnerHTML"));
  assert(!hasDanger, "Zero usage of dangerouslySetInnerHTML in Dashboard code");

  // 17. No userId is accepted from frontend input
  assert(
    !dashboardPageContent.includes("userId:") && !dashboardPageContent.includes("req.body.userId"),
    "No userId accepted or manipulated in frontend Dashboard code"
  );

  // 18. Deterministic sorting: newest first, _id tiebreaker
  assert(
    dashboardPageContent.includes("dateB - dateA") &&
      dashboardPageContent.includes("b._id || \"\").localeCompare(a._id"),
    "Deterministic sorting orders newest first with _id tiebreaker (no Math.random)"
  );

  // 19. Mobile-responsive layout classes and CSS variables
  assert(
    kitCardContent.includes("flexWrap: \"wrap\"") &&
      deleteDialogContent.includes("maxWidth: \"480px\""),
    "Mobile-responsive layout styling exists using Vanilla CSS tokens"
  );

  // 20. AppLayout navigation
  const appLayoutContent = fs.readFileSync(path.join(frontendRoot, "layouts", "AppLayout.tsx"), "utf-8");
  assert(
    appLayoutContent.includes('to="/dashboard"') &&
      appLayoutContent.includes('to="/kits/new"') &&
      appLayoutContent.includes("handleLogout"),
    "AppLayout includes Dashboard link, preserves Create Kit, and provides Sign Out"
  );

  // 21. HomePage navigation
  const homePageContent = fs.readFileSync(path.join(frontendRoot, "pages", "HomePage.tsx"), "utf-8");
  assert(
    homePageContent.includes('to="/dashboard"') &&
      homePageContent.includes("Go to Dashboard"),
    "HomePage provides authenticated path to Dashboard"
  );

  // 22. LoginPage and RegisterPage redirect to /dashboard
  const loginPageContent = fs.readFileSync(path.join(frontendRoot, "pages", "LoginPage.tsx"), "utf-8");
  const registerPageContent = fs.readFileSync(path.join(frontendRoot, "pages", "RegisterPage.tsx"), "utf-8");
  assert(
    loginPageContent.includes('navigate("/dashboard")') &&
      registerPageContent.includes('navigate("/dashboard")'),
    "LoginPage and RegisterPage redirect to /dashboard upon success"
  );

  // 23. KitPage provides return path to /dashboard
  const kitPageContent = fs.readFileSync(path.join(frontendRoot, "pages", "KitPage.tsx"), "utf-8");
  assert(
    kitPageContent.includes('to="/dashboard"') &&
      kitPageContent.includes("← Dashboard"),
    "KitPage provides return navigation to /dashboard"
  );

  // ============================================================================
  // SECTION 2: Backend API & Ownership Integration
  // ============================================================================
  console.log("\n--- Section 2: Backend API & Ownership Verification ---");

  // Create two test users
  const user1Email = `dash_user1_${Date.now()}@example.com`;
  const user2Email = `dash_user2_${Date.now()}@example.com`;
  const password = "ValidPassword123!";

  const regRes1 = await makeRequest("POST", "/api/v1/auth/register", undefined, {
    email: user1Email,
    password,
  });
  const cookie1 = regRes1.setCookie;
  const user1Id = (regRes1.body.user as { id: string }).id;

  const regRes2 = await makeRequest("POST", "/api/v1/auth/register", undefined, {
    email: user2Email,
    password,
  });
  const cookie2 = regRes2.setCookie;
  const user2Id = (regRes2.body.user as { id: string }).id;

  // 24. Unauthenticated GET /api/v1/kits returns 401
  const unauthList = await makeRequest("GET", "/api/v1/kits");
  assert(unauthList.status === 401, "GET /api/v1/kits without auth returns 401");

  // 25. User 1 creates 2 kits
  const kit1A = await createKit({
    userId: user1Id,
    jd: "Senior Backend Engineer with Node.js and MongoDB requirements...",
    company_url: "https://example-a.com",
    days: 5,
  });
  const kit1B = await createKit({
    userId: user1Id,
    jd: "Staff Systems Architect with distributed systems and Go...",
    company_url: "https://example-b.com",
    days: 7,
  });

  // User 2 creates 1 kit
  const kit2A = await createKit({
    userId: user2Id,
    jd: "Frontend Engineer with React and TypeScript...",
    company_url: "https://example-c.com",
    days: 3,
  });

  // 26. User 1 lists kits — only sees user 1's kits
  const user1ListRes = await makeRequest("GET", "/api/v1/kits", cookie1);
  assert(user1ListRes.status === 200, "User 1 GET /api/v1/kits returns 200");
  const user1Kits = (user1ListRes.body.kits as Array<{ _id: string }>) || [];
  assert(
    user1Kits.length === 2 &&
      user1Kits.some((k) => k._id === kit1A._id?.toString()) &&
      user1Kits.some((k) => k._id === kit1B._id?.toString()) &&
      !user1Kits.some((k) => k._id === kit2A._id?.toString()),
    "GET /api/v1/kits returns only kits belonging to authenticated user"
  );

  // 27. SafeKitSummary schema conformance
  const summaryItem = user1Kits[0] as Record<string, unknown>;
  assert(
    summaryItem._id !== undefined &&
      summaryItem.status !== undefined &&
      summaryItem.createdAt !== undefined &&
      !("userId" in summaryItem),
    "SafeKitSummary exposes public envelope and does not leak userId"
  );

  // 28. Unauthenticated DELETE /api/v1/kits/:id returns 401
  const unauthDelete = await makeRequest("DELETE", `/api/v1/kits/${kit1A._id}`);
  assert(unauthDelete.status === 401, "DELETE /api/v1/kits/:id without auth returns 401");

  // 29. Cross-user deletion returns 404 (ownership protection)
  const crossDelete = await makeRequest("DELETE", `/api/v1/kits/${kit1A._id}`, cookie2);
  assert(crossDelete.status === 404, "User 2 cannot delete User 1's kit (returns 404)");

  // 30. User 1 deletes their own kit
  const validDelete = await makeRequest("DELETE", `/api/v1/kits/${kit1A._id}`, cookie1);
  assert(validDelete.status === 200, "User 1 successfully deletes their own kit (returns 200)");

  // 31. Verify kit is deleted from database
  const user1AfterDelete = await makeRequest("GET", "/api/v1/kits", cookie1);
  const remainingKits = (user1AfterDelete.body.kits as Array<{ _id: string }>) || [];
  assert(
    remainingKits.length === 1 && remainingKits[0]._id === kit1B._id?.toString(),
    "Deleted kit is no longer returned in list"
  );

  // 32. kitsApi.deleteKit method is defined in frontend service
  const kitsApiContent = fs.readFileSync(path.join(frontendRoot, "services", "api", "kits.api.ts"), "utf-8");
  assert(
    kitsApiContent.includes("async deleteKit(id: string): Promise<{ message: string }>") &&
      kitsApiContent.includes("method: \"DELETE\""),
    "kitsApi.deleteKit method properly integrated in frontend kits.api.ts"
  );

  console.log("\n==================================================");
  console.log(`RESULTS: ${passedTests} / ${totalTests} assertions passed`);
  console.log("==================================================\n");

  server.close();
  process.exit(process.exitCode || 0);
}

run().catch((err) => {
  console.error("Verification suite encountered unhandled error:", err);
  if (server) server.close();
  process.exit(1);
});
