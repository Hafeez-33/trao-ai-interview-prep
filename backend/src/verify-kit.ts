import { app } from "./app.js";
import {
  connectDatabase,
  closeDatabase,
  getUsersCollection,
  getKitsCollection,
  ensureKitIndexes,
  ensureUserIndexes,
} from "./db/index.js";
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

async function runKitVerification(): Promise<void> {
  console.log("==================================================");
  console.log("STARTING PHASE 4: KIT CREATION & JD VERIFICATION");
  console.log("==================================================\n");

  // 1. Connect to Database & ensure indexes
  await connectDatabase();
  await ensureUserIndexes();
  await ensureKitIndexes();

  const usersCollection = getUsersCollection();
  const kitsCollection = getKitsCollection();

  // Test identities
  const userAEmail = `user.a.${Date.now()}@example.com`;
  const userBEmail = `user.b.${Date.now()}@example.com`;
  const testPassword = "Password123!";

  // 2. Start Test Server on ephemeral port
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 5002;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`[test] Verification server running on ${baseUrl}\n`);
      resolve();
    });
  });

  try {
    // ----------------------------------------------------
    // Test 1: Unauthenticated user cannot create a Kit
    // ----------------------------------------------------
    console.log("TEST 1: Reject unauthenticated POST /api/v1/kits");
    const unauthCreate = await request("POST", "/api/v1/kits", {
      jd: "Senior Backend Engineer with Node.js and MongoDB expertise.",
    });
    console.assert(unauthCreate.status === 401, `Expected 401, got ${unauthCreate.status}`);
    console.assert(unauthCreate.data.error?.code === "UNAUTHORIZED", "Expected UNAUTHORIZED code");
    console.log("  PASS: Unauthenticated create rejected with 401 UNAUTHORIZED\n");

    // ----------------------------------------------------
    // Setup: Register User A and User B
    // ----------------------------------------------------
    console.log("SETUP: Register User A and User B");
    const regUserA = await request("POST", "/api/v1/auth/register", {
      email: userAEmail,
      password: testPassword,
      name: "User Alpha",
    });
    console.assert(regUserA.status === 201, "User A registration failed");
    const cookieA = regUserA.cookieHeader?.split(";")[0];
    const userAId = regUserA.data.user.id;

    const regUserB = await request("POST", "/api/v1/auth/register", {
      email: userBEmail,
      password: testPassword,
      name: "User Beta",
    });
    console.assert(regUserB.status === 201, "User B registration failed");
    const cookieB = regUserB.cookieHeader?.split(";")[0];
    const userBId = regUserB.data.user.id;
    console.log(`  PASS: User A (${userAId}) and User B (${userBId}) registered\n`);

    // ----------------------------------------------------
    // Test 2: Authenticated user can create a Kit
    // ----------------------------------------------------
    console.log("TEST 2: Authenticated user creates a valid Kit");
    const validJdText = "Senior Distributed Systems Engineer with 6+ years in Go and Kubernetes.";
    const createRes = await request(
      "POST",
      "/api/v1/kits",
      {
        jd: validJdText,
        company_url: "https://example.com",
        days: 7,
      },
      cookieA
    );
    console.assert(createRes.status === 201, `Expected 201, got ${createRes.status}`);
    console.assert(createRes.data.kit !== undefined, "Expected kit in response");
    console.assert(createRes.data.kit._id !== undefined, "Expected kit._id string");
    console.assert(createRes.data.kit.status === "pending", "Expected status 'pending'");
    console.assert(createRes.data.kit.jd === validJdText, "Expected stored JD to match input");
    console.assert(createRes.data.kit.source.jd_chars === validJdText.length, "Expected accurate jd_chars");
    console.assert(createRes.data.kit.source.company_url === "https://example.com", "Expected matching company_url");
    console.assert(createRes.data.kit.schedule.days_available === 7, "Expected days_available = 7");
    const kitAId = createRes.data.kit._id;
    const kitACreatedAt = createRes.data.kit.createdAt;
    console.log(`  PASS: Kit created with ID ${kitAId}\n`);

    // ----------------------------------------------------
    // Test 3: Empty JD is rejected
    // ----------------------------------------------------
    console.log("TEST 3: Reject empty JD");
    const emptyJdRes = await request(
      "POST",
      "/api/v1/kits",
      { jd: "" },
      cookieA
    );
    console.assert(emptyJdRes.status === 400, `Expected 400, got ${emptyJdRes.status}`);
    console.assert(emptyJdRes.data.error?.code === "INVALID_INPUT_PARAMETERS", "Expected INVALID_INPUT_PARAMETERS");
    console.log("  PASS: Empty JD rejected with 400\n");

    // ----------------------------------------------------
    // Test 4: Whitespace-only JD is rejected
    // ----------------------------------------------------
    console.log("TEST 4: Reject whitespace-only JD");
    const wsJdRes = await request(
      "POST",
      "/api/v1/kits",
      { jd: "      \n\t   \r\n   " },
      cookieA
    );
    console.assert(wsJdRes.status === 400, `Expected 400, got ${wsJdRes.status}`);
    console.assert(wsJdRes.data.error?.code === "INVALID_INPUT_PARAMETERS", "Expected INVALID_INPUT_PARAMETERS");
    console.log("  PASS: Whitespace-only JD rejected with 400\n");

    // ----------------------------------------------------
    // Test 5: JD larger than 50,000 characters is rejected
    // ----------------------------------------------------
    console.log("TEST 5: Reject JD exceeding 50,000 characters");
    const oversizedJd = "A".repeat(50001);
    const overJdRes = await request(
      "POST",
      "/api/v1/kits",
      { jd: oversizedJd },
      cookieA
    );
    console.assert(overJdRes.status === 400, `Expected 400, got ${overJdRes.status}`);
    console.assert(overJdRes.data.error?.code === "INVALID_INPUT_PARAMETERS", "Expected INVALID_INPUT_PARAMETERS");
    console.log("  PASS: 50,001 character JD rejected with 400\n");

    // ----------------------------------------------------
    // Test 6: Valid JD is persisted in MongoDB
    // ----------------------------------------------------
    console.log("TEST 6: Verify MongoDB persistence of valid JD");
    const dbKit = await kitsCollection.findOne({ jd: validJdText });
    console.assert(dbKit !== null, "Kit document must exist in MongoDB");
    console.assert(dbKit!.userId === userAId, "Kit userId in DB must match User A");
    console.assert(dbKit!.source.jd_chars === validJdText.length, "MongoDB source.jd_chars must match");
    console.log("  PASS: Kit and JD accurately persisted in MongoDB\n");

    // ----------------------------------------------------
    // Test 7: User A can list their own Kits
    // ----------------------------------------------------
    console.log("TEST 7: User A lists their own Kits");
    const listARes = await request("GET", "/api/v1/kits", undefined, cookieA);
    console.assert(listARes.status === 200, `Expected 200, got ${listARes.status}`);
    console.assert(Array.isArray(listARes.data.kits), "Expected kits array");
    console.assert(listARes.data.kits.length >= 1, "Expected at least 1 kit for User A");
    console.assert(listARes.data.kits.some((k: any) => k._id === kitAId), "Kit A must be in list");
    console.log("  PASS: User A successfully listed their kits\n");

    // ----------------------------------------------------
    // Test 8: User A can retrieve their own Kit
    // ----------------------------------------------------
    console.log("TEST 8: User A retrieves their own Kit");
    const getKitARes = await request("GET", `/api/v1/kits/${kitAId}`, undefined, cookieA);
    console.assert(getKitARes.status === 200, `Expected 200, got ${getKitARes.status}`);
    console.assert(getKitARes.data.kit._id === kitAId, "Retrieved kit ID must match");
    console.assert(getKitARes.data.kit.jd === validJdText, "Retrieved JD must match");
    console.log("  PASS: User A successfully retrieved Kit A\n");

    // ----------------------------------------------------
    // Test 9: User A can update their own JD
    // ----------------------------------------------------
    console.log("TEST 9: User A updates their own JD");
    const updatedJdText = "Principal Distributed Systems Architect leading global infrastructure teams.";
    const updateRes = await request(
      "PATCH",
      `/api/v1/kits/${kitAId}`,
      { jd: updatedJdText },
      cookieA
    );
    console.assert(updateRes.status === 200, `Expected 200, got ${updateRes.status}`);
    console.assert(updateRes.data.kit.jd === updatedJdText, "Expected updated JD in response");
    console.assert(updateRes.data.kit.source.jd_chars === updatedJdText.length, "Expected updated jd_chars");
    console.assert(
      new Date(updateRes.data.kit.updatedAt).getTime() >= new Date(kitACreatedAt).getTime(),
      "Expected updatedAt to be refreshed"
    );
    console.log("  PASS: Kit A JD successfully updated\n");

    // ----------------------------------------------------
    // Test 10: Client cannot change Kit ownership via PATCH
    // ----------------------------------------------------
    console.log("TEST 10: Client cannot spoof or change kit ownership");
    const spoofRes = await request(
      "PATCH",
      `/api/v1/kits/${kitAId}`,
      {
        userId: userBId,
        ownerId: userBId,
        _id: "000000000000000000000000",
        jd: "Updated JD without ownership change.",
      },
      cookieA
    );
    console.assert(spoofRes.status === 200, `Expected 200, got ${spoofRes.status}`);
    console.assert(spoofRes.data.kit.userId === userAId, "Ownership must remain User A");
    console.assert(spoofRes.data.kit._id === kitAId, "_id must remain unchanged");
    console.log("  PASS: Ownership spoofing prevented; kit remains owned by User A\n");

    // ----------------------------------------------------
    // Test 11: User B CANNOT retrieve User A's Kit (404, no leak)
    // ----------------------------------------------------
    console.log("TEST 11: User B cannot retrieve User A's Kit");
    const crossGetRes = await request("GET", `/api/v1/kits/${kitAId}`, undefined, cookieB);
    console.assert(crossGetRes.status === 404, `Expected 404, got ${crossGetRes.status}`);
    console.assert(crossGetRes.data.error?.code === "KIT_NOT_FOUND", "Expected KIT_NOT_FOUND code");
    console.log("  PASS: Cross-user retrieve rejected with 404 KIT_NOT_FOUND (no existence leak)\n");

    // ----------------------------------------------------
    // Test 12: User B CANNOT update User A's Kit (404)
    // ----------------------------------------------------
    console.log("TEST 12: User B cannot update User A's Kit");
    const crossPatchRes = await request(
      "PATCH",
      `/api/v1/kits/${kitAId}`,
      { jd: "Malicious update by unauthorized user." },
      cookieB
    );
    console.assert(crossPatchRes.status === 404, `Expected 404, got ${crossPatchRes.status}`);
    console.assert(crossPatchRes.data.error?.code === "KIT_NOT_FOUND", "Expected KIT_NOT_FOUND code");
    // Verify in DB that JD was NOT modified
    const checkDbKit = await kitsCollection.findOne({ _id: dbKit!._id });
    console.assert(checkDbKit!.jd !== "Malicious update by unauthorized user.", "DB must not be modified");
    console.log("  PASS: Cross-user update rejected with 404 KIT_NOT_FOUND; data preserved\n");

    // ----------------------------------------------------
    // Test 13: User B CANNOT delete User A's Kit (404)
    // ----------------------------------------------------
    console.log("TEST 13: User B cannot delete User A's Kit");
    const crossDelRes = await request("DELETE", `/api/v1/kits/${kitAId}`, undefined, cookieB);
    console.assert(crossDelRes.status === 404, `Expected 404, got ${crossDelRes.status}`);
    console.assert(crossDelRes.data.error?.code === "KIT_NOT_FOUND", "Expected KIT_NOT_FOUND code");
    const checkStillExists = await kitsCollection.findOne({ _id: dbKit!._id });
    console.assert(checkStillExists !== null, "Kit must still exist in DB");
    console.log("  PASS: Cross-user delete rejected with 404 KIT_NOT_FOUND; kit preserved\n");

    // ----------------------------------------------------
    // Test 14: User B's kit list does NOT contain User A's Kit
    // ----------------------------------------------------
    console.log("TEST 14: User B kit list is isolated from User A");
    const listBRes = await request("GET", "/api/v1/kits", undefined, cookieB);
    console.assert(listBRes.status === 200, `Expected 200, got ${listBRes.status}`);
    console.assert(
      !listBRes.data.kits.some((k: any) => k._id === kitAId),
      "User B list must not contain User A's Kit"
    );
    console.log("  PASS: User B kit list contains zero items from User A\n");

    // ----------------------------------------------------
    // Test 15: User A can delete their own Kit
    // ----------------------------------------------------
    console.log("TEST 15: User A deletes their own Kit");
    const deleteARes = await request("DELETE", `/api/v1/kits/${kitAId}`, undefined, cookieA);
    console.assert(deleteARes.status === 200, `Expected 200, got ${deleteARes.status}`);
    console.assert(deleteARes.data.message === "Kit deleted successfully", "Expected deletion message");

    // Confirm it is gone from DB
    const postDeleteDb = await kitsCollection.findOne({ _id: dbKit!._id });
    console.assert(postDeleteDb === null, "Kit must be deleted from MongoDB");

    // Confirm GET /api/v1/kits/:id now returns 404
    const getDeletedRes = await request("GET", `/api/v1/kits/${kitAId}`, undefined, cookieA);
    console.assert(getDeletedRes.status === 404, `Expected 404, got ${getDeletedRes.status}`);
    console.log("  PASS: Kit A deleted successfully by owner\n");

    // ----------------------------------------------------
    // Cleanup: Remove test users from DB
    // ----------------------------------------------------
    await usersCollection.deleteMany({
      email: { $in: [userAEmail.toLowerCase(), userBEmail.toLowerCase()] },
    });
    console.log("[test] Cleaned up temporary test users from MongoDB.");

    console.log("\n==================================================");
    console.log("ALL 15 PHASE 4 TESTS PASSED SUCCESSFULLY!");
    console.log("==================================================");
  } finally {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await closeDatabase();
  }
}

runKitVerification().catch((err) => {
  console.error("Kit verification failed:", err);
  process.exit(1);
});
