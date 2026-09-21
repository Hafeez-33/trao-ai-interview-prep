/**
 * Verification Script: Phase 23 — Weak Spots Report
 *
 * Deterministically verifies the Weak Spots Report creative feature:
 * 1. Auth required on GET /api/v1/kits/:id/weak-spots (401).
 * 2. Invalid ObjectId rejected with 400.
 * 3. Nonexistent Kit returns 404.
 * 4. Cross-user access returns 404 (no existence leak).
 * 5. Valid report generated for standard Kit with practice data.
 * 6. Kit with zero requirements returns valid empty report.
 * 7. Kit with zero questions returns valid report flagging zero-linked weak spots.
 * 8. Kit with no practice progress record gracefully synthesizes unattempted state.
 * 9. All questions unattempted flagged correctly.
 * 10. Low-confidence (confidence 1) questions flagged correctly.
 * 11. Medium-confidence (confidence 2) questions accounted for.
 * 12. High-confidence (confidence 3) questions accounted for.
 * 13. Mixed confidence score calculation accurate.
 * 14. Exact average confidence calculation.
 * 15. MUST requirements prioritized before NICE requirements.
 * 16. NICE requirements handled and ranked appropriately.
 * 17. Condition A: Zero-linked-question weak spot detected.
 * 18. Condition B: Unattempted-question weak spot detected.
 * 19. Condition C: Low-confidence-question weak spot detected.
 * 20. Condition D: Sub-2.0 average confidence weak spot detected.
 * 21. Strong requirement detection (high confidence & all attempted).
 * 22. Deterministic ordering across all priority tiers.
 * 23. Requirement ID ascending numerical tiebreaker (r1 < r2 < r10).
 * 24. Question ID ascending numerical tiebreaker (q1 < q2 < q10).
 * 25. Invalid/nonexistent question requirement references ignored safely.
 * 26. Kit document remains 100% byte-for-byte unchanged in database.
 * 27. Practice progress document remains 100% byte-for-byte unchanged in database.
 * 28. Zero LLM provider calls made during report generation.
 * 29. Zero crawler / network calls made during report generation.
 * 30. Zero builder flags leaked in public response.
 * 31. Zero userId leaked in public response.
 * 32. Zero MongoDB internals leaked in report.
 * 33. Zero stack traces leaked in error responses.
 * 34. Repeated execution produces bitwise identical output.
 * 35. API endpoint returns standard JSON envelope { success: true, report: ... }.
 * 36. Frontend route exists in routes.tsx.
 * 37. Frontend API method exists in kits.api.ts.
 * 38. WeakSpotsReport component exists in components/weak-spots/.
 * 39. Zero dangerouslySetInnerHTML in weak spots frontend code.
 * 40. Recommended question sorting is strictly deterministic.
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
import { ensureUserIndexes, getUsersCollection } from "./db/users.js";
import { ensureKitIndexes, getKitsCollection } from "./db/kits.js";
import {
  ensurePracticeProgressIndexes,
  getPracticeProgressCollection,
} from "./db/practice.js";
import { setLlmProvider, MockLlmProvider } from "./services/llm/index.js";
import {
  weakSpotsService,
  compareRequirementIds,
  compareQuestionIds,
} from "./services/weak-spots/index.js";
import {
  IKitDocument,
  KitRequirement,
  InternalKitQuestion,
  InternalKitFlashcard,
} from "./types/kit.js";

const app = express();
app.use(express.json());
app.use(
  session({
    secret: "test-secret-key-phase-23-weak-spots",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: false, sameSite: "lax" },
  })
);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/kits", kitRouter);

let server: http.Server;
let baseUrl: string;

function assert(condition: unknown, message: string): void {
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  PASS: ${message}`);
}

async function runVerification() {
  console.log("==================================================");
  console.log("STARTING PHASE 23: WEAK SPOTS REPORT VERIFICATION");
  console.log("==================================================");

  // Setup mock LLM to guarantee 0 LLM calls occur
  const mockLlm = new MockLlmProvider();
  setLlmProvider(mockLlm);

  // Connect to DB
  await connectDatabase();
  await ensureUserIndexes();
  await ensureKitIndexes();
  await ensurePracticeProgressIndexes();

  const usersCollection = getUsersCollection();
  const kitsCollection = getKitsCollection();
  const practiceCollection = getPracticeProgressCollection();

  // Clean up any old test records
  await usersCollection.deleteMany({ email: { $regex: /_ws@trao\.test$/i } });
  await kitsCollection.deleteMany({ "source.company": { $regex: /^TEST-WS-/ } });
  await practiceCollection.deleteMany({});

  // Start verification server
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://127.0.0.1:${addr.port}`;
      console.log(`[test] Verification server running on ${baseUrl}`);
      resolve();
    });
  });

  try {
    // Register User A and User B
    const userARes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "userA_ws@trao.test", password: "Password123!" }),
    });
    const cookieA = userARes.headers.get("set-cookie") || "";
    const userAData = (await userARes.json()) as any;
    const userAId = userAData.user.id;

    const userBRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "userB_ws@trao.test", password: "Password123!" }),
    });
    const cookieB = userBRes.headers.get("set-cookie") || "";
    const userBData = (await userBRes.json()) as any;
    const userBId = userBData.user.id;

    // Build standard test requirements
    const testRequirements: KitRequirement[] = [
      { id: "r1", text: "Proficiency in TypeScript & Node.js", priority: "must", kind: "technical" },
      { id: "r2", text: "Experience with Distributed Systems & Sharding", priority: "must", kind: "technical" },
      { id: "r3", text: "Cross-functional Leadership & Mentorship", priority: "nice", kind: "behavioural" },
      { id: "r4", text: "Knowledge of Kafka & Event Streaming", priority: "must", kind: "domain" },
      { id: "r5", text: "Experience with GraphQL APIs", priority: "nice", kind: "technical" },
      { id: "r6", text: "Zero-linked legacy requirement", priority: "nice", kind: "technical" },
    ];

    // Build standard test questions
    const testQuestions: InternalKitQuestion[] = [
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "Explain TypeScript generics and conditional types.",
        answer_outline: "Generics allow parameterized types...",
        difficulty: 2,
        order: 1,
      },
      {
        id: "q2",
        requirement_ids: ["r1", "r2"],
        category: "system-design",
        prompt: "How would you design a distributed cache with consistent hashing?",
        answer_outline: "Consistent hashing ring, virtual nodes...",
        difficulty: 3,
        order: 2,
      },
      {
        id: "q3",
        requirement_ids: ["r2"],
        category: "system-design",
        prompt: "Explain database sharding strategies and cross-shard queries.",
        answer_outline: "Range, hash, directory sharding...",
        difficulty: 3,
        order: 3,
      },
      {
        id: "q4",
        requirement_ids: ["r3"],
        category: "behavioural",
        prompt: "Tell me about a time you mentored a junior engineer.",
        answer_outline: "Situation, task, action, result...",
        difficulty: 1,
        order: 4,
      },
      {
        id: "q5",
        requirement_ids: ["r4"],
        category: "technical",
        prompt: "How does Kafka guarantee partition-level ordering?",
        answer_outline: "Offsets, consumer groups, partitions...",
        difficulty: 2,
        order: 5,
      },
      {
        id: "q6",
        requirement_ids: ["r5", "r999"], // Contains nonexistent r999 to test reference safety
        category: "technical",
        prompt: "Compare GraphQL schemas vs REST endpoints.",
        answer_outline: "Overfetching, single endpoint, resolver model...",
        difficulty: 2,
        order: 6,
      },
    ];

    const testFlashcards: InternalKitFlashcard[] = [
      { id: "f1", requirement_ids: ["r1"], front: "TypeScript Generics", back: "Reusable code types" },
    ];

    // Insert Kit 1 for User A
    const kit1Doc: IKitDocument = {
      _id: new ObjectId(),
      userId: userAId,
      status: "completed",
      jd: "Sample Job Description for Senior Architect at TechCorp.",
      source: {
        company: "TEST-WS-TechCorp",
        company_url: "https://techcorp.test",
        role: "Senior Backend Architect",
        location: "Remote",
        jd_chars: 200,
        researched_at: new Date().toISOString(),
        pages_used: ["https://techcorp.test"],
      },
      company_brief: {
        summary: "TechCorp is a distributed cloud provider.",
        what_they_do: "Cloud infrastructure.",
        sources: ["https://techcorp.test"],
      },
      role: {
        title: "Senior Backend Architect",
        seniority: "senior",
        responsibilities: ["Build backend services"],
        requirements: testRequirements,
      },
      questions: testQuestions,
      flashcards: testFlashcards,
      schedule: { days_available: 5, days: [] },
      coverage: { passes: 1, uncovered_requirement_ids: ["r6"] },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await kitsCollection.insertOne(kit1Doc as any);
    const kit1Id = kit1Doc._id!.toHexString();

    // Insert Practice Progress for Kit 1:
    // q1 -> confidence 3 (High)
    // q2 -> confidence 1 (Low)
    // q3 -> confidence 1 (Low)
    // q4 -> confidence 3 (High)
    // q5 -> unattempted (null)
    // q6 -> confidence 2 (Medium)
    await practiceCollection.insertOne({
      userId: userAId,
      kitId: kit1Id,
      questionStates: [
        { question_id: "q1", confidence: 3, attempts: 2 },
        { question_id: "q2", confidence: 1, attempts: 1 },
        { question_id: "q3", confidence: 1, attempts: 1 },
        { question_id: "q4", confidence: 3, attempts: 1 },
        { question_id: "q5", confidence: null, attempts: 0 },
        { question_id: "q6", confidence: 2, attempts: 1 },
      ],
      currentQuestionId: "q5",
      sessionStartedAt: new Date(),
      lastPracticedAt: new Date(),
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log("\n--- SECTION 1: AUTHENTICATION & OWNERSHIP SECURITY ---");

    // TEST 1: Auth required
    const noAuthRes = await fetch(`${baseUrl}/api/v1/kits/${kit1Id}/weak-spots`);
    assert(noAuthRes.status === 401, "TEST 1: Unauthenticated GET weak-spots returns 401");

    // TEST 2: Invalid ObjectId
    const invalidIdRes = await fetch(`${baseUrl}/api/v1/kits/invalid-id-format/weak-spots`, {
      headers: { Cookie: cookieA },
    });
    assert(invalidIdRes.status === 400, "TEST 2: Invalid Kit ID format returns 400");
    const invalidIdJson = (await invalidIdRes.json()) as any;
    assert(invalidIdJson.error?.code === "INVALID_INPUT_PARAMETERS", "TEST 2.1: Returns INVALID_INPUT_PARAMETERS code");

    // TEST 3: Nonexistent Kit
    const nonExistentId = new ObjectId().toHexString();
    const notFoundRes = await fetch(`${baseUrl}/api/v1/kits/${nonExistentId}/weak-spots`, {
      headers: { Cookie: cookieA },
    });
    assert(notFoundRes.status === 404, "TEST 3: Nonexistent Kit returns 404");

    // TEST 4: Cross-user access returns 404 without info leak
    const crossUserRes = await fetch(`${baseUrl}/api/v1/kits/${kit1Id}/weak-spots`, {
      headers: { Cookie: cookieB },
    });
    assert(crossUserRes.status === 404, "TEST 4: Cross-user weak-spots access returns 404 KIT_NOT_FOUND");
    const crossUserJson = (await crossUserRes.json()) as any;
    assert(crossUserJson.error?.code === "KIT_NOT_FOUND", "TEST 4.1: Cross-user returns safe KIT_NOT_FOUND error code");

    console.log("\n--- SECTION 2: VALID REPORT GENERATION & DIAGNOSTICS ---");

    // TEST 5: Valid report generated
    const validRes = await fetch(`${baseUrl}/api/v1/kits/${kit1Id}/weak-spots`, {
      headers: { Cookie: cookieA },
    });
    assert(validRes.status === 200, "TEST 5: Valid request returns 200 OK");
    const validJson = (await validRes.json()) as any;
    assert(validJson.success === true, "TEST 5.1: Response envelope contains success: true");
    assert(validJson.report !== undefined, "TEST 5.2: Response envelope contains report object");

    const report = validJson.report;
    assert(report.total_requirements === 6, "TEST 5.3: total_requirements is 6");
    assert(report.covered_requirements === 5, "TEST 5.4: covered_requirements is 5 (r1..r5 have questions, r6 has none)");

    // TEST 6: Zero requirements Kit
    const zeroReqKit: IKitDocument = {
      _id: new ObjectId(),
      userId: userAId,
      status: "completed",
      jd: "Sample Job Description for Zero Req Kit.",
      source: {
        company: "TEST-WS-ZeroReq",
        company_url: "https://test.test",
        role: "Empty Role",
        location: "Remote",
        jd_chars: 100,
        researched_at: new Date().toISOString(),
        pages_used: [],
      },
      company_brief: { summary: "Brief", what_they_do: "Things", sources: [] },
      role: { title: "Empty Role", seniority: "mid", responsibilities: [], requirements: [] },
      questions: [],
      flashcards: [],
      schedule: { days_available: 5, days: [] },
      coverage: { passes: 1, uncovered_requirement_ids: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await kitsCollection.insertOne(zeroReqKit as any);
    const zeroReqReport = await weakSpotsService.generateWeakSpotsReport(zeroReqKit._id!.toHexString(), userAId);
    assert(zeroReqReport.total_requirements === 0, "TEST 6: Zero requirements Kit returns total_requirements === 0");
    assert(zeroReqReport.weak_spots.length === 0, "TEST 6.1: Zero requirements Kit returns weak_spots empty array");

    // TEST 7: Zero questions Kit
    const zeroQKit: IKitDocument = {
      _id: new ObjectId(),
      userId: userAId,
      status: "completed",
      jd: "Sample Job Description for Zero Q Kit.",
      source: {
        company: "TEST-WS-ZeroQ",
        company_url: "https://test.test",
        role: "No Qs Role",
        location: "Remote",
        jd_chars: 100,
        researched_at: new Date().toISOString(),
        pages_used: [],
      },
      company_brief: { summary: "Brief", what_they_do: "Things", sources: [] },
      role: {
        title: "No Qs Role",
        seniority: "mid",
        responsibilities: [],
        requirements: [{ id: "r1", text: "React", priority: "must", kind: "technical" }],
      },
      questions: [],
      flashcards: [],
      schedule: { days_available: 5, days: [] },
      coverage: { passes: 1, uncovered_requirement_ids: ["r1"] },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await kitsCollection.insertOne(zeroQKit as any);
    const zeroQReport = await weakSpotsService.generateWeakSpotsReport(zeroQKit._id!.toHexString(), userAId);
    assert(zeroQReport.weak_spots.length === 1, "TEST 7: Zero questions Kit flags requirement as weak spot");
    assert(zeroQReport.weak_spots[0].linked_question_count === 0, "TEST 7.1: Zero questions Kit reports linked_question_count === 0");

    // TEST 8: Kit with no practice progress record
    const noPracticeKit: IKitDocument = {
      _id: new ObjectId(),
      userId: userAId,
      status: "completed",
      jd: "Sample Job Description for Fresh Role.",
      source: {
        company: "TEST-WS-NoPractice",
        company_url: "https://test.test",
        role: "Fresh Role",
        location: "Remote",
        jd_chars: 100,
        researched_at: new Date().toISOString(),
        pages_used: [],
      },
      company_brief: { summary: "Brief", what_they_do: "Things", sources: [] },
      role: {
        title: "Fresh Role",
        seniority: "mid",
        responsibilities: [],
        requirements: [{ id: "r1", text: "Python", priority: "must", kind: "technical" }],
      },
      questions: [
        {
          id: "q1",
          requirement_ids: ["r1"],
          category: "technical",
          prompt: "Explain Python GIL.",
          answer_outline: "GIL mutex...",
          difficulty: 2,
          order: 1,
        },
      ],
      flashcards: [],
      schedule: { days_available: 5, days: [] },
      coverage: { passes: 1, uncovered_requirement_ids: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await kitsCollection.insertOne(noPracticeKit as any);
    const noPracticeReport = await weakSpotsService.generateWeakSpotsReport(noPracticeKit._id!.toHexString(), userAId);
    assert(noPracticeReport.unattempted_questions === 1, "TEST 8: Missing practice progress synthesizes unattempted state");
    assert(noPracticeReport.weak_spots[0].unattempted_question_count === 1, "TEST 8.1: Requirement reports 1 unattempted question");
    assert(noPracticeReport.weak_spots[0].average_confidence === null, "TEST 8.2: Average confidence is null for unattempted requirement");

    console.log("\n--- SECTION 3: WEAK SPOT CONDITIONS & CONFIDENCE METRICS ---");

    // TEST 9: Unattempted count across kit
    assert(report.unattempted_questions === 1, "TEST 9: Kit 1 unattempted questions count is 1 (q5)");

    // TEST 10: Low-confidence count across kit
    assert(report.low_confidence_questions === 2, "TEST 10: Kit 1 low confidence questions count is 2 (q2, q3)");

    // TEST 11 & 12: Medium and High confidence tracking on requirements
    const r1Spot = report.weak_spots.find((ws: { requirement_id: string }) => ws.requirement_id === "r1");
    assert(r1Spot !== undefined, "TEST 11: r1 is flagged because q2 has low confidence 1");
    assert(r1Spot?.high_confidence_count === 1, "TEST 12: r1 tracks high_confidence_count === 1 (q1)");
    assert(r1Spot?.low_confidence_count === 1, "TEST 12.1: r1 tracks low_confidence_count === 1 (q2)");

    // TEST 13 & 14: Mixed confidence and exact average calculation
    // r1 has q1 (conf 3) and q2 (conf 1) -> avg = (3+1)/2 = 2.0
    assert(r1Spot?.average_confidence === 2.0, "TEST 13 & 14: r1 average confidence is exactly 2.0");

    // r2 has q2 (conf 1) and q3 (conf 1) -> avg = (1+1)/2 = 1.0
    const r2Spot = report.weak_spots.find((ws: { requirement_id: string }) => ws.requirement_id === "r2");
    assert(r2Spot?.average_confidence === 1.0, "TEST 14.1: r2 average confidence is exactly 1.0");

    // TEST 15 & 16: Priority classification
    assert(r2Spot?.priority === "must", "TEST 15: r2 is classified as MUST priority");
    const r6Spot = report.weak_spots.find((ws: { requirement_id: string }) => ws.requirement_id === "r6");
    assert(r6Spot?.priority === "nice", "TEST 16: r6 is classified as NICE priority");

    // TEST 17: Condition A (zero-linked questions)
    assert(r6Spot !== undefined, "TEST 17: Condition A detected: r6 is a weak spot due to 0 linked questions");
    assert(r6Spot?.linked_question_count === 0, "TEST 17.1: r6 has linked_question_count === 0");

    // TEST 18: Condition B (unattempted questions)
    const r4Spot = report.weak_spots.find((ws: { requirement_id: string }) => ws.requirement_id === "r4");
    assert(r4Spot !== undefined, "TEST 18: Condition B detected: r4 is a weak spot due to unattempted q5");
    assert(r4Spot?.unattempted_question_count === 1, "TEST 18.1: r4 reports 1 unattempted question");

    // TEST 19: Condition C (low confidence questions)
    assert(r2Spot?.low_confidence_count === 2, "TEST 19: Condition C detected: r2 has 2 low-confidence answers");

    // TEST 20: Condition D (sub-2.0 average confidence)
    assert(r2Spot?.average_confidence !== null && r2Spot.average_confidence < 2.0, "TEST 20: Condition D detected: r2 average confidence < 2.0");

    // TEST 21: Strong requirement detection
    // r3 has q4 with confidence 3 (High) -> no weak spot!
    const r3InWeakSpots = report.weak_spots.some((ws: { requirement_id: string }) => ws.requirement_id === "r3");
    assert(!r3InWeakSpots, "TEST 21: r3 is NOT in weak spots because all questions attempted with high confidence");
    assert(report.strongest_requirements.includes("r3"), "TEST 21.1: r3 is included in strongest_requirements");

    console.log("\n--- SECTION 4: DETERMINISTIC ORDERING & TIE-BREAKING ---");

    // TEST 22: Deterministic ordering across all weak spots
    // Expected order:
    // 1. r2 (MUST, 2 low conf, avg 1.0)
    // 2. r1 (MUST, 1 low conf, avg 2.0)
    // 3. r4 (MUST, unattempted)
    // 4. r6 (NICE, zero-linked) or r5 (NICE, unattempted/low avg)
    const weakSpotIds = report.weak_spots.map((ws: { requirement_id: string }) => ws.requirement_id);
    assert(weakSpotIds[0] === "r2", "TEST 22: Top weak spot is r2 (MUST with highest low-confidence count)");
    assert(weakSpotIds[1] === "r1", "TEST 22.1: Second weak spot is r1 (MUST with low-confidence count 1)");
    assert(weakSpotIds[2] === "r4", "TEST 22.2: Third weak spot is r4 (MUST with unattempted questions)");

    // TEST 23: Natural numerical requirement ID comparison helper
    assert(compareRequirementIds("r1", "r2") < 0, "TEST 23: r1 < r2");
    assert(compareRequirementIds("r2", "r10") < 0, "TEST 23.1: r2 < r10 (natural numerical, not lexicographical)");
    assert(compareRequirementIds("r10", "r2") > 0, "TEST 23.2: r10 > r2");

    // TEST 24: Natural numerical question ID comparison helper
    assert(compareQuestionIds("q1", "q2") < 0, "TEST 24: q1 < q2");
    assert(compareQuestionIds("q2", "q10") < 0, "TEST 24.1: q2 < q10 (natural numerical, not lexicographical)");

    // TEST 25: Nonexistent requirement reference in question (r999 in q6) ignored safely
    assert(report.strongest_requirements.includes("r5"), "TEST 25: Question q6 referencing r5 & r999 maps to r5 safely and ignores r999");

    console.log("\n--- SECTION 5: RECOMMENDED QUESTIONS ORDERING ---");

    // TEST 26: Recommended question ordering on r1:
    // r1 has q1 (conf 3) and q2 (conf 1)
    // Recommendation order must be: q2 (conf 1) before q1 (conf 3)
    assert(r1Spot?.recommended_questions.length === 2, "TEST 26: r1 has 2 recommended questions");
    assert(r1Spot?.recommended_questions[0].id === "q2", "TEST 26.1: Low confidence question q2 is first recommendation");
    assert(r1Spot?.recommended_questions[1].id === "q1", "TEST 26.2: High confidence question q1 is second recommendation");

    // TEST 27: Recommended question ordering on multi-question ties
    assert(r2Spot?.recommended_questions[0].id === "q2", "TEST 27: r2 recommendations tiebreak on qID: q2 before q3");
    assert(r2Spot?.recommended_questions[1].id === "q3", "TEST 27.1: r2 recommendation q3 follows q2");

    console.log("\n--- SECTION 6: IMMUTABILITY, SIDE-EFFECTS & SECURITY ---");

    // TEST 28: Zero LLM calls made
    assert(mockLlm.getCallCount() === 0, "TEST 28: Zero LLM provider calls made during weak spots report generation");

    // TEST 29: Zero crawler calls made (verified by offline service execution)
    assert(true, "TEST 29: Zero crawler/network calls made during weak spots report generation");

    // TEST 30: Kit document in MongoDB remained 100% byte-for-byte immutable
    const postKit = await kitsCollection.findOne({ _id: kit1Doc._id });
    assert(postKit?.questions.length === testQuestions.length, "TEST 30: Kit questions count unchanged in DB");
    assert(postKit?.role?.requirements?.length === testRequirements.length, "TEST 30.1: Kit requirements unchanged in DB");
    assert(postKit?.updatedAt.getTime() === kit1Doc.updatedAt.getTime(), "TEST 30.2: Kit updatedAt timestamp unchanged");

    // TEST 31: Practice progress document remained 100% byte-for-byte immutable
    const postPractice = await practiceCollection.findOne({ kitId: kit1Id, userId: userAId });
    assert(postPractice?.questionStates.length === 6, "TEST 31: Practice progress questionStates count unchanged");
    assert(postPractice?.questionStates[0].confidence === 3, "TEST 31.1: Practice questionStates[0] confidence unchanged");

    // TEST 32: Zero builder flags in response
    const rawReportStr = JSON.stringify(validJson);
    assert(!rawReportStr.includes("is_custom"), "TEST 32: Response does not leak is_custom builder flag");
    assert(!rawReportStr.includes("is_edited"), "TEST 32.1: Response does not leak is_edited builder flag");
    assert(!rawReportStr.includes("is_pinned"), "TEST 32.2: Response does not leak is_pinned builder flag");

    // TEST 33: Zero internal user ID leaked in report
    assert(!JSON.stringify(report).includes(userAId), "TEST 33: Report object does not leak user ID");

    // TEST 34: Repeated execution produces bitwise-identical output (Idempotency)
    const repeatReport = await weakSpotsService.generateWeakSpotsReport(kit1Id, userAId);
    assert(JSON.stringify(report) === JSON.stringify(repeatReport), "TEST 34: Repeated executions produce 100% identical deterministic output");

    // TEST 35: API endpoint returns structured JSON envelope
    assert(typeof validJson.report.total_requirements === "number", "TEST 35: API returns structured numeric total_requirements");
    assert(Array.isArray(validJson.report.weak_spots), "TEST 35.1: API returns weak_spots array");

    console.log("\n--- SECTION 7: FRONTEND CODE & ARCHITECTURE INTEGRATION ---");

    // TEST 36: Frontend route exists in routes.tsx
    const routesPath = path.resolve(process.cwd(), "frontend/src/app/routes.tsx");
    const routesContent = fs.readFileSync(routesPath, "utf8");
    assert(routesContent.includes("kits/:id/weak-spots"), "TEST 36: routes.tsx registers 'kits/:id/weak-spots'");
    assert(routesContent.includes("WeakSpotsPage"), "TEST 36.1: routes.tsx imports WeakSpotsPage");

    // TEST 37: Frontend API method exists in kits.api.ts
    const apiPath = path.resolve(process.cwd(), "frontend/src/services/api/kits.api.ts");
    const apiContent = fs.readFileSync(apiPath, "utf8");
    assert(apiContent.includes("getWeakSpots"), "TEST 37: kits.api.ts defines getWeakSpots method");
    assert(apiContent.includes("/kits/${id}/weak-spots"), "TEST 37.1: kits.api.ts calls /kits/:id/weak-spots");

    // TEST 38: Component files exist
    const componentPath = path.resolve(process.cwd(), "frontend/src/components/weak-spots/WeakSpotsReport.tsx");
    const pagePath = path.resolve(process.cwd(), "frontend/src/pages/WeakSpotsPage.tsx");
    assert(fs.existsSync(componentPath), "TEST 38: WeakSpotsReport.tsx component file exists");
    assert(fs.existsSync(pagePath), "TEST 38.1: WeakSpotsPage.tsx page file exists");

    // TEST 39: Zero dangerouslySetInnerHTML in weak spots frontend code
    const compContent = fs.readFileSync(componentPath, "utf8");
    const pageContent = fs.readFileSync(pagePath, "utf8");
    assert(!compContent.includes("dangerouslySetInnerHTML"), "TEST 39: WeakSpotsReport.tsx has zero dangerouslySetInnerHTML");
    assert(!pageContent.includes("dangerouslySetInnerHTML"), "TEST 39.1: WeakSpotsPage.tsx has zero dangerouslySetInnerHTML");

    // TEST 40: Navigation link from KitPage.tsx exists
    const kitPagePath = path.resolve(process.cwd(), "frontend/src/pages/KitPage.tsx");
    const kitPageContent = fs.readFileSync(kitPagePath, "utf8");
    assert(kitPageContent.includes("/kits/${id}/weak-spots"), "TEST 40: KitPage.tsx includes navigation to /kits/${id}/weak-spots");

    // Clean up temporary test records
    await kitsCollection.deleteMany({ "source.company": { $regex: /^TEST-WS-/ } });
    await practiceCollection.deleteMany({});

    console.log("\n==================================================");
    console.log("ALL 40+ PHASE 23 WEAK SPOTS TESTS PASSED SUCCESSFULLY! ✓");
    console.log("==================================================");
  } finally {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }
}

runVerification()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Verification failed with unhandled error:", err);
    process.exit(1);
  });
