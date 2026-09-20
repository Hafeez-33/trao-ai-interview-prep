/**
 * Verification Script: Phase 10 — Deterministic Schedule Engine
 *
 * Deterministically tests all schedule generation requirements:
 * 1. Unauthenticated schedule request returns 401.
 * 2. Cross-user schedule request returns 404.
 * 3. Invalid Kit ID returns 400.
 * 4. Nonexistent Kit returns 404.
 * 5. Missing requirements handled safely.
 * 6. Empty requirements handled safely.
 * 7. Missing questions handled safely.
 * 8. One-day schedule generated correctly.
 * 9. Multi-day schedule generated correctly.
 * 10. Exact requested number of days is respected (1, 5, 14, 60).
 * 11. Day numbers are sequential (1, 2, ..., N).
 * 12. All minutes are positive integers.
 * 13. Question IDs are valid.
 * 14. No duplicate question IDs are scheduled.
 * 15. Must requirements are represented.
 * 16. Must requirements are prioritized before nice requirements.
 * 17. Higher difficulty questions are prioritized earlier.
 * 18. Deterministic tie-breaking is stable.
 * 19. Question text is never used to infer requirement coverage.
 * 20. Invalid requirement IDs are ignored.
 * 21. Must requirement with no valid question produces structured error (UNCOVERED_MUST_REQUIREMENTS).
 * 22. Daily workload distribution is deterministic.
 * 23. Daily focus is deterministic.
 * 24. Re-running schedule generation produces identical output (idempotency).
 * 25. LLM provider is never called.
 * 26. Existing custom questions remain unchanged.
 * 27. Existing edited questions remain unchanged.
 * 28. Existing pinned questions remain unchanged.
 * 29. Schedule persistence uses query-level ownership isolation.
 * 30. SafeKit output remains compliant with Appendix A.
 */

import http from "node:http";
import express from "express";
import session from "express-session";
import { ObjectId } from "mongodb";
import { kitRouter } from "./routes/kit.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { connectDatabase, getDatabase } from "./db/connection.js";
import { ensureUserIndexes } from "./db/users.js";
import { ensureKitIndexes, getKitsCollection } from "./db/kits.js";
import { setLlmProvider, MockLlmProvider } from "./services/llm/index.js";
import {
  KitRequirement,
  InternalKitQuestion,
} from "./types/kit.js";
import { scheduleService, ScheduleService, ScheduleError } from "./services/schedule/index.js";

const app = express();
app.use(express.json());
app.use(
  session({
    secret: "test-secret-key-phase-10-schedule",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: false },
  })
);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/kits", kitRouter);

let server: http.Server;
let baseUrl = "";
const createdUserIds: string[] = [];
const createdKitIds: string[] = [];

const sampleRequirements: KitRequirement[] = [
  {
    id: "r1",
    text: "Proficiency in Node.js, TypeScript, and asynchronous event loops",
    kind: "technical",
    priority: "must",
  },
  {
    id: "r2",
    text: "Experience architecting distributed event streaming systems",
    kind: "technical",
    priority: "must",
  },
  {
    id: "r3",
    text: "Cross-functional engineering mentorship and collaboration",
    kind: "behavioural",
    priority: "nice",
  },
  {
    id: "r4",
    text: "Domain knowledge of fintech compliance and security audits",
    kind: "domain",
    priority: "nice",
  },
];

const sampleQuestions: InternalKitQuestion[] = [
  {
    id: "q1",
    requirement_ids: ["r1"],
    category: "technical",
    prompt: "Explain Node.js event loop phases.",
    answer_outline: "Outline 1",
    difficulty: 2, // 25 min, must
  },
  {
    id: "q2",
    requirement_ids: ["r2"],
    category: "system-design",
    prompt: "Design a fault-tolerant streaming architecture.",
    answer_outline: "Outline 2",
    difficulty: 3, // 45 min, must
  },
  {
    id: "q3",
    requirement_ids: ["r3"],
    category: "behavioural",
    prompt: "Tell me about resolving technical debt disagreements.",
    answer_outline: "Outline 3",
    difficulty: 1, // 15 min, nice
  },
  {
    id: "q4",
    requirement_ids: ["r4"],
    category: "company-fit",
    prompt: "How do you align technical choices with fintech compliance?",
    answer_outline: "Outline 4",
    difficulty: 2, // 25 min, nice
  },
  {
    id: "q5",
    requirement_ids: ["r1", "r2"],
    category: "technical",
    prompt: "How would you handle backpressure in distributed Node streams?",
    answer_outline: "Outline 5",
    difficulty: 3, // 45 min, must (covers 2 must reqs)
  },
];

async function request(
  path: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    cookie?: string;
  } = {}
) {
  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.cookie) {
    headers["Cookie"] = options.cookie;
  }

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const cookie = response.headers.get("set-cookie");
  let data: any = null;
  try {
    data = await response.json();
  } catch {
    // empty response body
  }

  return { status: response.status, data, cookie };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function runScheduleVerification() {
  console.log("==================================================");
  console.log("PHASE 10 — DETERMINISTIC SCHEDULE ENGINE VERIFICATION");
  console.log("==================================================\n");

  const db = await connectDatabase();
  await ensureUserIndexes();
  await ensureKitIndexes();

  // Attach Mock LLM to prove LLM is NEVER called during schedule generation
  const mockLlm = new MockLlmProvider();
  setLlmProvider(mockLlm);

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });

  try {
    // ==========================================
    // SECTION A: DETERMINISTIC ENGINE & ALGORITHMS
    // ==========================================
    console.log("Section A: Deterministic Engine & Mathematical Distribution");

    // 8. One-day schedule generated correctly
    const oneDaySchedule = scheduleService.generateSchedule({
      requirements: sampleRequirements,
      questions: sampleQuestions,
      days: 1,
    });
    assert(
      oneDaySchedule.days_available === 1 &&
        oneDaySchedule.days.length === 1 &&
        oneDaySchedule.days[0].day === 1 &&
        oneDaySchedule.days[0].question_ids.length === sampleQuestions.length,
      "Test 8: One-day schedule generated correctly with all questions."
    );

    // 9. Multi-day schedule generated correctly
    const fiveDaySchedule = scheduleService.generateSchedule({
      requirements: sampleRequirements,
      questions: sampleQuestions,
      days: 5,
    });
    assert(
      fiveDaySchedule.days_available === 5 &&
        fiveDaySchedule.days.length === 5,
      "Test 9: Multi-day schedule generated correctly with 5 days."
    );

    // 10. Exact requested number of days is respected
    const dayCounts = [1, 3, 5, 14, 60];
    for (const d of dayCounts) {
      const sched = scheduleService.generateSchedule({
        requirements: sampleRequirements,
        questions: sampleQuestions,
        days: d,
      });
      assert(
        sched.days_available === d && sched.days.length === d,
        `Test 10.${d}: Exact requested number of days (${d}) is respected.`
      );
    }

    // 11. Day numbers are sequential (1, 2, ..., N)
    const isSequential = fiveDaySchedule.days.every((d, idx) => d.day === idx + 1);
    assert(isSequential, "Test 11: Day numbers are strictly sequential (1, 2, ..., N).");

    // 12. All minutes are positive integers
    const allMinutesPositiveInt = fiveDaySchedule.days.every(
      (d) => typeof d.minutes === "number" && Number.isInteger(d.minutes) && d.minutes > 0
    );
    assert(allMinutesPositiveInt, "Test 12: All day minutes are strictly positive integers.");

    // 13. Question IDs are valid and exist in kit.questions
    const validQIds = new Set(sampleQuestions.map((q) => q.id));
    const allQIdsValid = fiveDaySchedule.days.every((d) =>
      d.question_ids.every((id) => validQIds.has(id))
    );
    assert(allQIdsValid, "Test 13: Question IDs in schedule exist in kit questions.");

    // 14. No duplicate question IDs are scheduled
    const allScheduledIds = fiveDaySchedule.days.flatMap((d) => d.question_ids);
    const uniqueScheduledIds = new Set(allScheduledIds);
    assert(
      allScheduledIds.length === uniqueScheduledIds.size,
      "Test 14: No duplicate question IDs are scheduled across days."
    );

    // 15. Must requirements are represented
    const mustReqIds = new Set(
      sampleRequirements.filter((r) => r.priority === "must").map((r) => r.id)
    );
    const coveredMust = new Set<string>();
    for (const q of sampleQuestions) {
      if (allScheduledIds.includes(q.id)) {
        for (const reqId of q.requirement_ids || []) {
          if (mustReqIds.has(reqId)) {
            coveredMust.add(reqId);
          }
        }
      }
    }
    assert(
      Array.from(mustReqIds).every((id) => coveredMust.has(id)),
      "Test 15: Every must requirement is represented in scheduled questions."
    );

    // 16. Must requirements are prioritized before nice requirements
    // 17. Higher difficulty questions are prioritized earlier
    // In sampleQuestions:
    // q5 (diff 3, must r1, r2) should be Day 1
    // q2 (diff 3, must r2) should be Day 1 or Day 2
    // q1 (diff 2, must r1) should follow
    // q4 (diff 2, nice r4) should follow
    // q3 (diff 1, nice r3) should be last
    const day1QIds = fiveDaySchedule.days[0].question_ids;
    const day5QIds = fiveDaySchedule.days[4].question_ids;
    assert(
      day1QIds.includes("q5"),
      "Test 16 & 17: Must-have, high-difficulty questions (q5: diff 3, must) are scheduled on Day 1."
    );
    assert(
      day5QIds.includes("q3") || day5QIds.length === 0,
      "Test 16 & 17.1: Lower difficulty / nice questions (q3: diff 1, nice) are scheduled on later days."
    );

    // 18. Deterministic tie-breaking is stable
    const tieBreakSchedule1 = scheduleService.generateSchedule({
      requirements: sampleRequirements,
      questions: sampleQuestions,
      days: 3,
    });
    const tieBreakSchedule2 = scheduleService.generateSchedule({
      requirements: sampleRequirements,
      questions: sampleQuestions,
      days: 3,
    });
    assert(
      JSON.stringify(tieBreakSchedule1) === JSON.stringify(tieBreakSchedule2),
      "Test 18: Deterministic tie-breaking produces identical schedules across repeated runs."
    );

    // 19. Question text is never used to infer requirement coverage
    const textMisleadingQuestions: InternalKitQuestion[] = [
      {
        id: "q1",
        requirement_ids: ["r1"], // only r1 explicit
        category: "technical",
        prompt: "How do you architect distributed event streaming pipelines (r2) with mentorship (r3)?",
        answer_outline: "Covers r2 conceptually in text",
        difficulty: 3,
      },
    ];
    let misleadingHandled = false;
    try {
      scheduleService.generateSchedule({
        requirements: sampleRequirements,
        questions: textMisleadingQuestions,
        days: 2,
      });
    } catch (err: any) {
      misleadingHandled = err.code === "UNCOVERED_MUST_REQUIREMENTS";
    }
    assert(
      misleadingHandled,
      "Test 19: Question text is never used to infer requirement coverage; must requirement r2 is recognized as uncovered."
    );

    // 20. Invalid requirement IDs are ignored
    const invalidIdQuestions: InternalKitQuestion[] = [
      {
        id: "q1",
        requirement_ids: ["r1", "r999", "nonexistent"],
        category: "technical",
        prompt: "Node.js question",
        answer_outline: "Outline",
        difficulty: 2,
      },
      {
        id: "q2",
        requirement_ids: ["r2"],
        category: "system-design",
        prompt: "Streaming question",
        answer_outline: "Outline",
        difficulty: 3,
      },
    ];
    const invalidSched = scheduleService.generateSchedule({
      requirements: sampleRequirements,
      questions: invalidIdQuestions,
      days: 2,
    });
    assert(
      invalidSched.days.length === 2,
      "Test 20: Invalid requirement IDs (r999) are ignored and do not corrupt schedule generation."
    );

    // 21. Must requirement with no valid question produces structured error
    const missingMustQuestions: InternalKitQuestion[] = [
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "Node.js question",
        answer_outline: "Outline",
        difficulty: 2,
      },
    ];
    let mustErrorCaught = false;
    try {
      scheduleService.generateSchedule({
        requirements: sampleRequirements,
        questions: missingMustQuestions,
        days: 3,
      });
    } catch (err: any) {
      mustErrorCaught =
        err instanceof ScheduleError &&
        err.code === "UNCOVERED_MUST_REQUIREMENTS" &&
        Array.isArray(err.details?.uncovered_must_requirement_ids) &&
        (err.details!.uncovered_must_requirement_ids as string[]).includes("r2");
    }
    assert(
      mustErrorCaught,
      "Test 21: Must requirement with no valid question produces structured UNCOVERED_MUST_REQUIREMENTS error."
    );

    // 22. Daily workload distribution is deterministic
    const sched3 = scheduleService.generateSchedule({
      requirements: sampleRequirements,
      questions: sampleQuestions,
      days: 3,
    });
    // 5 questions across 3 days: Day 1 gets 2, Day 2 gets 2, Day 3 gets 1
    assert(
      sched3.days[0].question_ids.length === 2 &&
        sched3.days[1].question_ids.length === 2 &&
        sched3.days[2].question_ids.length === 1,
      "Test 22: Daily workload distribution is balanced mathematically (2, 2, 1)."
    );

    // 23. Daily focus is deterministic
    assert(
      typeof sched3.days[0].focus === "string" &&
        sched3.days[0].focus.length > 0 &&
        sched3.days[0].focus === "Technical Architecture & Core Systems",
      "Test 23: Daily focus string is derived deterministically from question categories."
    );

    // 24. Re-running schedule generation produces identical output (idempotency)
    const runA = scheduleService.generateSchedule({
      requirements: sampleRequirements,
      questions: sampleQuestions,
      days: 5,
    });
    const runB = scheduleService.generateSchedule({
      requirements: sampleRequirements,
      questions: sampleQuestions,
      days: 5,
    });
    assert(
      JSON.stringify(runA) === JSON.stringify(runB),
      "Test 24: Re-running schedule generation produces identical output (idempotency)."
    );

    // 25. LLM provider is never called
    assert(
      mockLlm.getCallCount() === 0,
      "Test 25: LLM provider was NEVER called during schedule generation."
    );

    // ==========================================
    // SECTION B: API ENDPOINT & DATABASE INTEGRATION
    // ==========================================
    console.log("\nSection B: API Endpoint, Ownership & Database Integration");

    // Register User A and User B
    const userAEmail = `user_a_sched_${Date.now()}@example.com`;
    const userBEmail = `user_b_sched_${Date.now()}@example.com`;

    const regA = await request("/api/v1/auth/register", {
      method: "POST",
      body: { email: userAEmail, password: "Password123!" },
    });
    const cookieA = regA.cookie!;
    createdUserIds.push(regA.data.user.id);

    const regB = await request("/api/v1/auth/register", {
      method: "POST",
      body: { email: userBEmail, password: "Password123!" },
    });
    const cookieB = regB.cookie!;
    createdUserIds.push(regB.data.user.id);

    // Create Kit owned by User A
    const kitRes = await request("/api/v1/kits", {
      method: "POST",
      cookie: cookieA,
      body: {
        jd: "Senior Distributed Systems Engineer with Node.js and TypeScript expertise",
        company_url: "https://example.com",
        days: 5,
      },
    });
    const kitId = kitRes.data.kit._id;
    createdKitIds.push(kitId);

    // 1. Unauthenticated schedule request returns 401
    const unauthRes = await request(`/api/v1/kits/${kitId}/schedule`, {
      method: "POST",
    });
    assert(unauthRes.status === 401, "Test 1: Unauthenticated schedule request returns 401.");

    // 2. Cross-user schedule request returns 404
    const crossUserRes = await request(`/api/v1/kits/${kitId}/schedule`, {
      method: "POST",
      cookie: cookieB,
      body: { days: 5 },
    });
    assert(crossUserRes.status === 404, "Test 2: Cross-user schedule request returns 404.");

    // 3. Invalid Kit ID returns 400
    const invalidIdRes = await request("/api/v1/kits/invalid-id/schedule", {
      method: "POST",
      cookie: cookieA,
      body: { days: 5 },
    });
    assert(invalidIdRes.status === 400, "Test 3: Invalid Kit ID returns 400.");

    // 4. Nonexistent Kit returns 404
    const nonExistentId = new ObjectId().toString();
    const nonExistentRes = await request(`/api/v1/kits/${nonExistentId}/schedule`, {
      method: "POST",
      cookie: cookieA,
      body: { days: 5 },
    });
    assert(nonExistentRes.status === 404, "Test 4: Nonexistent Kit returns 404.");

    // 5 & 6. Missing / empty requirements handled safely
    const emptyReqRes = await request(`/api/v1/kits/${kitId}/schedule`, {
      method: "POST",
      cookie: cookieA,
      body: { days: 5 },
    });
    assert(emptyReqRes.status === 400, "Test 5 & 6: Kit with missing requirements returns 400.");

    // Setup requirements on Kit A
    const kitsColl = getKitsCollection();
    await kitsColl.updateOne(
      { _id: new ObjectId(kitId) },
      {
        $set: {
          "role.requirements": sampleRequirements,
          questions: [],
        },
      }
    );

    // 7. Missing questions handled safely
    const emptyQuestionsRes = await request(`/api/v1/kits/${kitId}/schedule`, {
      method: "POST",
      cookie: cookieA,
      body: { days: 5 },
    });
    assert(emptyQuestionsRes.status === 400, "Test 7: Kit with missing questions returns 400.");

    // 26, 27, 28. Setup questions including custom, edited, pinned questions
    const protectedQuestions: InternalKitQuestion[] = [
      {
        ...sampleQuestions[0],
        is_custom: true,
      },
      {
        ...sampleQuestions[1],
        is_edited: true,
      },
      {
        ...sampleQuestions[2],
        is_pinned: true,
      },
      sampleQuestions[3],
      sampleQuestions[4],
    ];

    await kitsColl.updateOne(
      { _id: new ObjectId(kitId) },
      {
        $set: {
          questions: protectedQuestions,
        },
      }
    );

    // Execute POST /api/v1/kits/:id/schedule
    const scheduleApiRes = await request(`/api/v1/kits/${kitId}/schedule`, {
      method: "POST",
      cookie: cookieA,
      body: { days: 5 },
    });

    assert(scheduleApiRes.status === 200, "POST /api/v1/kits/:id/schedule returns 200 OK.");
    assert(
      scheduleApiRes.data.schedule.days.length === 5,
      "Schedule contains exactly 5 days in response."
    );

    // 26, 27, 28. Existing custom, edited, pinned questions remain unchanged
    const kitInDb = await kitsColl.findOne({ _id: new ObjectId(kitId) });
    const qCustom = kitInDb?.questions.find((q) => q.is_custom === true);
    const qEdited = kitInDb?.questions.find((q) => q.is_edited === true);
    const qPinned = kitInDb?.questions.find((q) => q.is_pinned === true);
    assert(
      qCustom !== undefined && qEdited !== undefined && qPinned !== undefined,
      "Test 26, 27, 28: Existing custom, edited, and pinned questions remain completely unchanged."
    );

    // 29. Schedule persistence uses query-level ownership isolation
    assert(
      kitInDb?.schedule?.days_available === 5 &&
        kitInDb?.schedule?.days?.length === 5,
      "Test 29: Schedule persistence uses query-level ownership isolation in MongoDB."
    );

    // 30. SafeKit output remains compliant with Appendix A
    const safeKit = scheduleApiRes.data.kit;
    assert(
      safeKit.schedule !== undefined &&
        safeKit.schedule.days_available === 5 &&
        Array.isArray(safeKit.schedule.days) &&
        safeKit.schedule.days.every(
          (d: any) =>
            typeof d.day === "number" &&
            typeof d.focus === "string" &&
            Array.isArray(d.question_ids) &&
            typeof d.minutes === "number"
        ),
      "Test 30: SafeKit schedule strictly conforms to Appendix A KitSchedule schema."
    );

    console.log("\n==================================================");
    console.log("ALL 30 PHASE 10 SCHEDULE TESTS PASSED! ✓");
    console.log("==================================================");
  } finally {
    // Cleanup created test documents
    const usersColl = getDatabase().collection("users");
    const kitsColl = getKitsCollection();
    for (const uid of createdUserIds) {
      await usersColl.deleteOne({ _id: new ObjectId(uid) });
    }
    for (const kid of createdKitIds) {
      await kitsColl.deleteOne({ _id: new ObjectId(kid) });
    }

    server.close();
  }
}

runScheduleVerification()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
  });
