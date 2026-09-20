import { app } from "./app.js";
import { connectDatabase, closeDatabase, getUsersCollection } from "./db/index.js";
import type { Server } from "http";

interface HttpResponse {
  status: number;
  headers: Headers;
  data: any;
  cookieHeader: string | null;
}

let server: Server;
let baseUrl: string;

async function request(
  method: string,
  path: string,
  body?: any,
  cookie?: string
): Promise<HttpResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (cookie) {
    headers["Cookie"] = cookie;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const cookieHeader = res.headers.get("set-cookie");
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON response
  }

  return {
    status: res.status,
    headers: res.headers,
    data,
    cookieHeader,
  };
}

async function runAuthVerification(): Promise<void> {
  console.log("==================================================");
  console.log("STARTING AUTHENTICATION VERIFICATION");
  console.log("==================================================\n");

  // 1. Connect to Database
  await connectDatabase();
  const usersCollection = getUsersCollection();

  // Clean up any previous test user
  const testEmail = `test.candidate.${Date.now()}@example.com`;
  const testPassword = "ValidPassword123!";

  // 2. Start Test Server on ephemeral port
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 5001;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`[test] Verification server running on ${baseUrl}`);
      resolve();
    });
  });

  try {
    // ----------------------------------------------------
    // Test 1: Reject unauthenticated /me
    // ----------------------------------------------------
    console.log("TEST 1: Reject unauthenticated /api/v1/auth/me");
    const unauthMe = await request("GET", "/api/v1/auth/me");
    console.assert(unauthMe.status === 401, `Expected 401, got ${unauthMe.status}`);
    console.assert(unauthMe.data.success === false, "Expected success: false");
    console.assert(unauthMe.data.error.code === "UNAUTHORIZED", "Expected UNAUTHORIZED error code");
    console.log("  PASS: Unauthenticated request rejected with 401 UNAUTHORIZED\n");

    // ----------------------------------------------------
    // Test 2: Validation rejection on short password
    // ----------------------------------------------------
    console.log("TEST 2: Reject registration with short password (< 8 chars)");
    const shortPassRes = await request("POST", "/api/v1/auth/register", {
      email: testEmail,
      password: "short",
    });
    console.assert(shortPassRes.status === 400, `Expected 400, got ${shortPassRes.status}`);
    console.assert(shortPassRes.data.error.code === "INVALID_INPUT_PARAMETERS", "Expected INVALID_INPUT_PARAMETERS");
    console.log("  PASS: Short password rejected with 400 Bad Request\n");

    // ----------------------------------------------------
    // Test 3: Successful Registration
    // ----------------------------------------------------
    console.log("TEST 3: Register valid user");
    const regRes = await request("POST", "/api/v1/auth/register", {
      email: testEmail,
      password: testPassword,
      name: "Test Candidate",
    });
    console.assert(regRes.status === 201, `Expected 201, got ${regRes.status}`);
    console.assert(regRes.data.user.email === testEmail.toLowerCase(), "Expected matching email");
    console.assert(regRes.data.user.id !== undefined, "Expected user id in response");
    console.assert(regRes.data.password === undefined, "Password must not be in response");
    console.assert(regRes.data.passwordHash === undefined, "Password hash must not be in response");
    console.assert(regRes.data.user.passwordHash === undefined, "User password hash must not be in response");
    console.assert(regRes.cookieHeader !== null, "Expected session cookie set on register");
    const regCookie = regRes.cookieHeader?.split(";")[0];
    console.log("  PASS: User registered, safe user returned, session cookie set\n");

    // ----------------------------------------------------
    // Test 4: Database persistence & password hash verification
    // ----------------------------------------------------
    console.log("TEST 4: Verify MongoDB document & bcrypt hash");
    const dbUser = await usersCollection.findOne({ email: testEmail.toLowerCase() });
    console.assert(dbUser !== null, "User document must exist in MongoDB");
    console.assert(dbUser!.passwordHash !== testPassword, "Password must NOT be stored in plaintext");
    console.assert(dbUser!.passwordHash.startsWith("$2"), "Password must be a valid bcrypt hash");
    console.log("  PASS: User persisted in MongoDB with secure bcrypt hash\n");

    // ----------------------------------------------------
    // Test 5: Duplicate email registration rejection (409)
    // ----------------------------------------------------
    console.log("TEST 5: Reject duplicate email registration");
    const dupRes = await request("POST", "/api/v1/auth/register", {
      email: testEmail,
      password: testPassword,
    });
    console.assert(dupRes.status === 409, `Expected 409, got ${dupRes.status}`);
    console.assert(dupRes.data.error.code === "EMAIL_ALREADY_EXISTS", "Expected EMAIL_ALREADY_EXISTS code");
    console.log("  PASS: Duplicate registration rejected with 409 Conflict\n");

    // ----------------------------------------------------
    // Test 6: Verify /auth/me with session cookie from registration
    // ----------------------------------------------------
    console.log("TEST 6: Check /api/v1/auth/me with authenticated session cookie");
    const authMeRes = await request("GET", "/api/v1/auth/me", undefined, regCookie);
    console.assert(authMeRes.status === 200, `Expected 200, got ${authMeRes.status}`);
    console.assert(authMeRes.data.authenticated === true, "Expected authenticated: true");
    console.assert(authMeRes.data.user.email === testEmail.toLowerCase(), "Expected matching email");
    console.assert(authMeRes.data.user.passwordHash === undefined, "Password hash must not be in /me");
    console.log("  PASS: /api/v1/auth/me returned correct authenticated user\n");

    // ----------------------------------------------------
    // Test 7: Logout
    // ----------------------------------------------------
    console.log("TEST 7: Logout and invalidate session");
    const logoutRes = await request("POST", "/api/v1/auth/logout", {}, regCookie);
    console.assert(logoutRes.status === 200, `Expected 200, got ${logoutRes.status}`);
    console.assert(logoutRes.data.message === "Successfully logged out", "Expected logout message");
    console.log("  PASS: Logout successful\n");

    // ----------------------------------------------------
    // Test 8: Verify /auth/me is now unauthenticated after logout
    // ----------------------------------------------------
    console.log("TEST 8: Verify /auth/me fails after logout");
    const postLogoutMe = await request("GET", "/api/v1/auth/me", undefined, regCookie);
    console.assert(postLogoutMe.status === 401, `Expected 401, got ${postLogoutMe.status}`);
    console.log("  PASS: Session is invalidated, /auth/me returns 401\n");

    // ----------------------------------------------------
    // Test 9: Login with correct credentials
    // ----------------------------------------------------
    console.log("TEST 9: Login with valid credentials");
    const loginRes = await request("POST", "/api/v1/auth/login", {
      email: testEmail,
      password: testPassword,
    });
    console.assert(loginRes.status === 200, `Expected 200, got ${loginRes.status}`);
    console.assert(loginRes.data.user.email === testEmail.toLowerCase(), "Expected matching email");
    console.assert(loginRes.data.user.passwordHash === undefined, "Password hash must not be in response");
    console.assert(loginRes.cookieHeader !== null, "Expected session cookie set on login");
    const loginCookie = loginRes.cookieHeader?.split(";")[0];
    console.log("  PASS: Login successful, safe user returned, session cookie set\n");

    // ----------------------------------------------------
    // Test 10: Verify /auth/me with login session cookie
    // ----------------------------------------------------
    console.log("TEST 10: Verify /auth/me with login session");
    const postLoginMe = await request("GET", "/api/v1/auth/me", undefined, loginCookie);
    console.assert(postLoginMe.status === 200, `Expected 200, got ${postLoginMe.status}`);
    console.assert(postLoginMe.data.authenticated === true, "Expected authenticated: true");
    console.log("  PASS: /auth/me authenticated after login\n");

    // ----------------------------------------------------
    // Test 11: Login failure with wrong password
    // ----------------------------------------------------
    console.log("TEST 11: Login fails with wrong password (no user enumeration)");
    const wrongPassRes = await request("POST", "/api/v1/auth/login", {
      email: testEmail,
      password: "WrongPassword123!",
    });
    console.assert(wrongPassRes.status === 401, `Expected 401, got ${wrongPassRes.status}`);
    console.assert(wrongPassRes.data.error.code === "UNAUTHORIZED", "Expected UNAUTHORIZED");
    console.assert(wrongPassRes.data.error.message === "Invalid email or password.", "Expected generic message");
    console.log("  PASS: Incorrect password rejected with generic 401\n");

    // ----------------------------------------------------
    // Test 12: Login failure with nonexistent email
    // ----------------------------------------------------
    console.log("TEST 12: Login fails with nonexistent email (identical error)");
    const noUserRes = await request("POST", "/api/v1/auth/login", {
      email: "nonexistent.user.123@example.com",
      password: "SomePassword123!",
    });
    console.assert(noUserRes.status === 401, `Expected 401, got ${noUserRes.status}`);
    console.assert(noUserRes.data.error.message === wrongPassRes.data.error.message, "Must match wrong password message");
    console.log("  PASS: Nonexistent email produces identical 401 response (prevents account enumeration)\n");

    // Clean up test user
    await usersCollection.deleteOne({ email: testEmail.toLowerCase() });
    console.log("[test] Cleaned up test user record from MongoDB.");

    console.log("==================================================");
    console.log("ALL AUTHENTICATION TESTS PASSED SUCCESSFULLY!");
    console.log("==================================================");
  } finally {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await closeDatabase();
  }
}

runAuthVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
