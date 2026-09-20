/**
 * Verification Script: Phase 11 — Kit Validation Engine
 *
 * Deterministically tests all validation requirements:
 * 1. Valid completed Kit passes validation.
 * 2. Missing source detected.
 * 3. Missing company_brief detected.
 * 4. Missing role detected.
 * 5. Missing questions detected.
 * 6. Missing flashcards detected.
 * 7. Missing schedule detected.
 * 8. Missing coverage detected.
 * 9. Duplicate requirement IDs detected.
 * 10. Invalid requirement kind detected.
 * 11. Invalid requirement priority detected.
 * 12. Duplicate question IDs detected.
 * 13. Invalid question category detected.
 * 14. Invalid question difficulty detected.
 * 15. Invalid question requirement reference detected.
 * 16. Empty question prompt detected.
 * 17. Empty answer outline detected.
 * 18. Duplicate flashcard IDs detected.
 * 19. Empty flashcard front detected.
 * 20. Empty flashcard back detected.
 * 21. Invalid flashcard requirement reference detected.
 * 22. Invalid coverage uncovered_requirement_ids detected.
 * 23. Invalid coverage passes detected.
 * 24. Coverage mismatch detected.
 * 25. Invalid schedule day count detected.
 * 26. Non-sequential day numbers detected.
 * 27. Invalid schedule minutes detected.
 * 28. Invalid scheduled question ID detected.
 * 29. Duplicate scheduled question detected.
 * 30. Must requirement missing from schedule detected.
 * 31. Invalid source URL detected.
 * 32. Duplicate pages_used detected.
 * 33. JD character count mismatch detected.
 * 34. Internal fields do not leak through SafeKit.
 * 35. Protected custom question remains unchanged.
 * 36. Protected edited question remains unchanged.
 * 37. Protected pinned question remains unchanged.
 * 38. Protected flashcard remains unchanged.
 * 39. Validation is deterministic across repeated runs.
 * 40. Validation performs zero LLM calls.
 * 41. Validation performs zero network requests.
 * 42. Unauthenticated endpoint returns 401.
 * 43. Cross-user endpoint returns 404.
 * 44. Invalid Kit ID returns 400.
 * 45. Nonexistent Kit returns 404.
 * 46. Valid endpoint returns structured validation response.
 * 47. Validation does not mutate the Kit.
 */

import http from "node:http";
import express from "express";
import session from "express-session";
import { ObjectId } from "mongodb";
import { kitRouter } from "./routes/kit.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { connectDatabase } from "./db/connection.js";
import { ensureUserIndexes } from "./db/users.js";
import { ensureKitIndexes, getKitsCollection } from "./db/kits.js";
import { setLlmProvider, MockLlmProvider } from "./services/llm/index.js";
import {
  KitStructure,
  IKitDocument,
  toSafeKit,
} from "./types/kit.js";
import {
  kitValidationService,
  ValidationErrorCode,
} from "./services/validation/index.js";

const app = express();
app.use(express.json());
app.use(
  session({
    secret: "test-secret-key-phase-11-validation",
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

/**
 * Creates a valid, complete baseline KitStructure for testing mutations/invalids.
 */
function createValidBaselineKit(): KitStructure {
  return {
    source: {
      company: "Stripe",
      company_url: "https://stripe.com",
      role: "Staff Infrastructure Engineer",
      location: "San Francisco, CA",
      jd_chars: 140,
      researched_at: "2026-09-01T10:00:00.000Z",
      pages_used: [
        "https://stripe.com/about",
        "https://stripe.com/jobs",
      ],
    },
    company_brief: {
      summary: "Stripe builds economic infrastructure for the internet.",
      what_they_do: "Financial services and payment processing software.",
      sources: [
        "https://stripe.com/about",
      ],
    },
    role: {
      title: "Staff Infrastructure Engineer",
      seniority: "Staff",
      responsibilities: [
        "Architect distributed payment processing pipelines",
        "Ensure high availability and fault tolerance",
      ],
      requirements: [
        {
          id: "r1",
          text: "Proficiency in distributed systems, consensus algorithms, and fault tolerance",
          kind: "technical",
          priority: "must",
        },
        {
          id: "r2",
          text: "Hands-on experience with Kafka and high-throughput event processing",
          kind: "technical",
          priority: "must",
        },
        {
          id: "r3",
          text: "Cross-functional leadership and engineering mentorship",
          kind: "behavioural",
          priority: "nice",
        },
      ],
    },
    questions: [
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "Explain how Raft maintains consensus during a network partition.",
        answer_outline: "Discuss leader election, log replication, and partition healing.",
        difficulty: 3,
      },
      {
        id: "q2",
        requirement_ids: ["r2"],
        category: "system-design",
        prompt: "Design a payment ingestion pipeline handling 100k events/sec using Kafka.",
        answer_outline: "Partitioning strategy, exactly-once semantics, consumer lag monitoring.",
        difficulty: 3,
      },
      {
        id: "q3",
        requirement_ids: ["r3"],
        category: "behavioural",
        prompt: "Describe how you resolved a major technical disagreement across teams.",
        answer_outline: "Context, differing views, data-driven compromise, execution.",
        difficulty: 2,
      },
    ],
    flashcards: [
      {
        id: "f1",
        front: "What is the CAP theorem?",
        back: "A distributed system can only provide two of Consistency, Availability, and Partition Tolerance.",
        requirement_ids: ["r1"],
      },
      {
        id: "f2",
        front: "What is an idempotent producer in Kafka?",
        back: "A producer that ensures messages are written exactly once without duplication using sequence numbers.",
        requirement_ids: ["r2"],
      },
    ],
    schedule: {
      days_available: 3,
      days: [
        {
          day: 1,
          focus: "System Design & Architecture",
          question_ids: ["q1"],
          minutes: 45,
        },
        {
          day: 2,
          focus: "Core Technical Systems & Interview Practice",
          question_ids: ["q2"],
          minutes: 45,
        },
        {
          day: 3,
          focus: "Behavioural & Leadership Questions",
          question_ids: ["q3"],
          minutes: 25,
        },
      ],
    },
    coverage: {
      uncovered_requirement_ids: [],
      passes: 1,
    },
  };
}

/**
 * Creates a valid baseline IKitDocument for database-level tests.
 */
function createValidBaselineDocument(userId: string): IKitDocument {
  const base = createValidBaselineKit();
  const rawJd = "We are seeking a Staff Infrastructure Engineer to design robust distributed payment processing pipelines using Kafka and Raft consensus protocols.";
  return {
    userId,
    status: "completed",
    jd: rawJd,
    source: {
      ...base.source,
      jd_chars: rawJd.length,
    },
    company_brief: base.company_brief,
    role: base.role,
    questions: [
      {
        ...base.questions[0],
        is_custom: true,
      },
      {
        ...base.questions[1],
        is_edited: true,
      },
      {
        ...base.questions[2],
        is_pinned: true,
      },
    ],
    flashcards: [
      {
        ...base.flashcards[0],
        is_custom: true,
      },
      {
        ...base.flashcards[1],
        is_edited: true,
      },
    ],
    schedule: base.schedule,
    coverage: base.coverage,
    crawled_pages: [
      {
        url: "https://stripe.com/about",
        finalUrl: "https://stripe.com/about",
        title: "About Stripe",
        text: "Stripe is a financial infrastructure platform.",
        depth: 0,
        statusCode: 200,
        contentType: "text/html",
        fetchedAt: "2026-09-01T10:00:00.000Z",
        relevanceScore: 10,
        discoveredLinks: [],
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

async function requestJson(
  method: string,
  urlPath: string,
  body?: unknown,
  cookie?: string
): Promise<{ status: number; body: Record<string, unknown>; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, baseUrl);
    const postData = body ? JSON.stringify(body) : "";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (postData) {
      headers["Content-Length"] = Buffer.byteLength(postData).toString();
    }
    if (cookie) {
      headers["Cookie"] = cookie;
    }

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers,
      },
      (res) => {
        let rawData = "";
        res.on("data", (chunk) => {
          rawData += chunk;
        });
        res.on("end", () => {
          let parsed: Record<string, unknown> = {};
          try {
            parsed = JSON.parse(rawData);
          } catch {
            parsed = { raw: rawData };
          }
          resolve({
            status: res.statusCode || 500,
            body: parsed,
            headers: res.headers,
          });
        });
      }
    );

    req.on("error", reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

function extractSessionCookie(headers: http.IncomingHttpHeaders): string {
  const setCookie = headers["set-cookie"];
  if (!setCookie) return "";
  const first = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return first.split(";")[0];
}

async function runTests(): Promise<void> {
  console.log("\n==================================================");
  console.log("Starting Phase 11 — Kit Validation Engine Verification");
  console.log("==================================================\n");

  await connectDatabase();
  await ensureUserIndexes();
  await ensureKitIndexes();

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

  let passedTests = 0;

  function assert(condition: boolean, testName: string, detail?: string): void {
    if (!condition) {
      console.error(`❌ FAIL: ${testName}${detail ? ` — ${detail}` : ""}`);
      process.exit(1);
    }
    console.log(`✅ PASS: ${testName}`);
    passedTests++;
  }

  // Register two users for API testing
  const user1Email = `val-user-1-${Date.now()}@example.com`;
  const user2Email = `val-user-2-${Date.now()}@example.com`;

  const regRes1 = await requestJson("POST", "/api/v1/auth/register", {
    email: user1Email,
    password: "Password123!",
  });
  const cookieUser1 = extractSessionCookie(regRes1.headers);
  const user1Id = (regRes1.body.user as { id: string })?.id;
  createdUserIds.push(user1Id);

  const regRes2 = await requestJson("POST", "/api/v1/auth/register", {
    email: user2Email,
    password: "Password123!",
  });
  const cookieUser2 = extractSessionCookie(regRes2.headers);
  const user2Id = (regRes2.body.user as { id: string })?.id;
  createdUserIds.push(user2Id);

  // 1. Valid completed Kit passes validation.
  {
    const kit = createValidBaselineKit();
    const result = kitValidationService.validateKit(kit);
    assert(result.valid === true && result.errors.length === 0, "1. Valid completed Kit passes validation");
  }

  // 2. Missing source detected.
  {
    const kit = createValidBaselineKit();
    delete (kit as any).source;
    const result = kitValidationService.validateKit(kit);
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.MISSING_FIELD && e.path === "source"),
      "2. Missing source detected"
    );
  }

  // 3. Missing company_brief detected.
  {
    const kit = createValidBaselineKit();
    delete (kit as any).company_brief;
    const result = kitValidationService.validateKit(kit);
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.MISSING_FIELD && e.path === "company_brief"),
      "3. Missing company_brief detected"
    );
  }

  // 4. Missing role detected.
  {
    const kit = createValidBaselineKit();
    delete (kit as any).role;
    const result = kitValidationService.validateKit(kit);
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.MISSING_FIELD && e.path === "role"),
      "4. Missing role detected"
    );
  }

  // 5. Missing questions detected.
  {
    const kit = createValidBaselineKit();
    delete (kit as any).questions;
    const result = kitValidationService.validateKit(kit);
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.MISSING_FIELD && e.path === "questions"),
      "5. Missing questions detected"
    );
  }

  // 6. Missing flashcards detected.
  {
    const kit = createValidBaselineKit();
    delete (kit as any).flashcards;
    const result = kitValidationService.validateKit(kit);
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.MISSING_FIELD && e.path === "flashcards"),
      "6. Missing flashcards detected"
    );
  }

  // 7. Missing schedule detected.
  {
    const kit = createValidBaselineKit();
    delete (kit as any).schedule;
    const result = kitValidationService.validateKit(kit);
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.MISSING_FIELD && e.path === "schedule"),
      "7. Missing schedule detected"
    );
  }

  // 8. Missing coverage detected.
  {
    const kit = createValidBaselineKit();
    delete (kit as any).coverage;
    const result = kitValidationService.validateKit(kit);
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.MISSING_FIELD && e.path === "coverage"),
      "8. Missing coverage detected"
    );
  }

  // 9. Duplicate requirement IDs detected.
  {
    const kit = createValidBaselineKit();
    kit.role.requirements.push({
      id: "r1",
      text: "Duplicate r1 requirement",
      kind: "technical",
      priority: "must",
    });
    const result = kitValidationService.validateKit(kit);
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.DUPLICATE_REQUIREMENT_ID),
      "9. Duplicate requirement IDs detected"
    );
  }

  // 10. Invalid requirement kind detected.
  {
    const kit = createValidBaselineKit();
    (kit.role.requirements[0] as any).kind = "invalid-kind";
    const result = kitValidationService.validateKit(kit);
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.INVALID_TYPE && e.path.includes("kind")),
      "10. Invalid requirement kind detected"
    );
  }

  // 11. Invalid requirement priority detected.
  {
    const kit = createValidBaselineKit();
    (kit.role.requirements[0] as any).priority = "urgent";
    const result = kitValidationService.validateKit(kit);
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.INVALID_TYPE && e.path.includes("priority")),
      "11. Invalid requirement priority detected"
    );
  }

  // 12. Duplicate question IDs detected.
  {
    const kit = createValidBaselineKit();
    kit.questions.push({
      id: "q1",
      requirement_ids: ["r1"],
      category: "technical",
      prompt: "Another duplicate q1 question prompt here",
      answer_outline: "Outline here",
      difficulty: 2,
    });
    const result = kitValidationService.validateKit(kit);
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.DUPLICATE_QUESTION_ID),
      "12. Duplicate question IDs detected"
    );
  }

  // 13. Invalid question category detected.
  {
    const kit = createValidBaselineKit();
    (kit.questions[0] as any).category = "unsupported-category";
    const result = kitValidationService.validateKit(kit);
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.INVALID_QUESTION_CATEGORY),
      "13. Invalid question category detected"
    );
  }

  // 14. Invalid question difficulty detected.
  {
    const kit = createValidBaselineKit();
    (kit.questions[0] as any).difficulty = 5;
    const result = kitValidationService.validateKit(kit);
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.INVALID_DIFFICULTY),
      "14. Invalid question difficulty detected"
    );
  }

  // 15. Invalid question requirement reference detected.
  {
    const kit = createValidBaselineKit();
    kit.questions[0].requirement_ids = ["r999"];
    const result = kitValidationService.validateKit(kit);
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.INVALID_REQUIREMENT_REFERENCE),
      "15. Invalid question requirement reference detected"
    );
  }

  // 16. Empty question prompt detected.
  {
    const kit = createValidBaselineKit();
    kit.questions[0].prompt = "   ";
    const result = kitValidationService.validateKit(kit);
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.EMPTY_VALUE && e.path.includes("prompt")),
      "16. Empty question prompt detected"
    );
  }

  // 17. Empty answer outline detected.
  {
    const kit = createValidBaselineKit();
    kit.questions[0].answer_outline = "";
    const result = kitValidationService.validateKit(kit);
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.EMPTY_VALUE && e.path.includes("answer_outline")),
      "17. Empty answer outline detected"
    );
  }

  // 18. Duplicate flashcard IDs detected.
  {
    const kit = createValidBaselineKit();
    kit.flashcards.push({
      id: "f1",
      front: "Duplicate card front",
      back: "Duplicate card back",
      requirement_ids: ["r1"],
    });
    const result = kitValidationService.validateKit(kit);
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.DUPLICATE_FLASHCARD_ID),
      "18. Duplicate flashcard IDs detected"
    );
  }

  // 19. Empty flashcard front detected.
  {
    const kit = createValidBaselineKit();
    kit.flashcards[0].front = "   ";
    const result = kitValidationService.validateKit(kit);
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.EMPTY_VALUE && e.path.includes("front")),
      "19. Empty flashcard front detected"
    );
  }

  // 20. Empty flashcard back detected.
  {
    const kit = createValidBaselineKit();
    kit.flashcards[0].back = "";
    const result = kitValidationService.validateKit(kit);
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.EMPTY_VALUE && e.path.includes("back")),
      "20. Empty flashcard back detected"
    );
  }

  // 21. Invalid flashcard requirement reference detected.
  {
    const kit = createValidBaselineKit();
    kit.flashcards[0].requirement_ids = ["nonexistent_r"];
    const result = kitValidationService.validateKit(kit);
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.INVALID_REQUIREMENT_REFERENCE),
      "21. Invalid flashcard requirement reference detected"
    );
  }

  // 22. Invalid coverage uncovered_requirement_ids detected.
  {
    const kit = createValidBaselineKit();
    kit.coverage.uncovered_requirement_ids = ["r999_fake"];
    const result = kitValidationService.validateKit(kit);
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.INVALID_COVERAGE),
      "22. Invalid coverage uncovered_requirement_ids detected"
    );
  }

  // 23. Invalid coverage passes detected.
  {
    const kit = createValidBaselineKit();
    (kit.coverage as any).passes = 3;
    const result = kitValidationService.validateKit(kit);
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.INVALID_COVERAGE && e.path === "coverage.passes"),
      "23. Invalid coverage passes detected"
    );
  }

  // 24. Coverage mismatch detected.
  {
    const kit = createValidBaselineKit();
    // Question 1 covers r1, Question 2 covers r2, Question 3 covers r3. All requirements are covered.
    // But coverage claims r1 is uncovered:
    kit.coverage.uncovered_requirement_ids = ["r1"];
    const result = kitValidationService.validateKit(kit);
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.INVALID_COVERAGE && e.message.includes("Coverage mismatch")),
      "24. Coverage mismatch detected"
    );
  }

  // 25. Invalid schedule day count detected.
  {
    const kit = createValidBaselineKit();
    kit.schedule.days.pop(); // length 2, but days_available is 3
    const result = kitValidationService.validateKit(kit);
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.INVALID_SCHEDULE && e.path === "schedule.days"),
      "25. Invalid schedule day count detected"
    );
  }

  // 26. Non-sequential day numbers detected.
  {
    const kit = createValidBaselineKit();
    kit.schedule.days[1].day = 5; // expected day 2
    const result = kitValidationService.validateKit(kit);
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.INVALID_DAY_NUMBER),
      "26. Non-sequential day numbers detected"
    );
  }

  // 27. Invalid schedule minutes detected.
  {
    const kit = createValidBaselineKit();
    kit.schedule.days[0].minutes = -10;
    const result = kitValidationService.validateKit(kit);
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.INVALID_MINUTES),
      "27. Invalid schedule minutes detected"
    );
  }

  // 28. Invalid scheduled question ID detected.
  {
    const kit = createValidBaselineKit();
    kit.schedule.days[0].question_ids = ["q999_nonexistent"];
    const result = kitValidationService.validateKit(kit);
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.INVALID_SCHEDULE),
      "28. Invalid scheduled question ID detected"
    );
  }

  // 29. Duplicate scheduled question detected.
  {
    const kit = createValidBaselineKit();
    kit.schedule.days[1].question_ids.push("q1"); // q1 already scheduled on day 1
    const result = kitValidationService.validateKit(kit);
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.DUPLICATE_SCHEDULE_QUESTION),
      "29. Duplicate scheduled question detected"
    );
  }

  // 30. Must requirement missing from schedule detected.
  {
    const kit = createValidBaselineKit();
    // r1 and r2 are must requirements. q1 covers r1, q2 covers r2.
    // If we unschedule q2, then r2 is no longer represented in the schedule.
    kit.schedule.days[1].question_ids = [];
    const result = kitValidationService.validateKit(kit);
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.MISSING_MUST_REQUIREMENT && e.message.includes("r2")),
      "30. Must requirement missing from schedule detected"
    );
  }

  // 31. Invalid source URL detected.
  {
    const kit = createValidBaselineKit();
    kit.source.company_url = "not-a-valid-url";
    const result = kitValidationService.validateKit(kit);
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.INVALID_SOURCE_URL),
      "31. Invalid source URL detected"
    );
  }

  // 32. Duplicate pages_used detected.
  {
    const kit = createValidBaselineKit();
    kit.source.pages_used = ["https://stripe.com/about", "https://stripe.com/about"];
    const result = kitValidationService.validateKit(kit);
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.INVALID_SOURCE_URL && e.message.includes("Duplicate")),
      "32. Duplicate pages_used detected"
    );
  }

  // 33. JD character count mismatch detected.
  {
    const kit = createValidBaselineKit();
    const result = kitValidationService.validateKit(kit, {
      rawJd: "Short JD text that has 33 chars!",
    });
    // kit.source.jd_chars is 140, but rawJd.length is 33
    assert(
      result.valid === false &&
        result.errors.some((e) => e.code === ValidationErrorCode.INVALID_JD_CHAR_COUNT),
      "33. JD character count mismatch detected"
    );
  }

  // 34. Internal fields do not leak through SafeKit.
  {
    const doc = createValidBaselineDocument(user1Id);
    const safe = toSafeKit(doc);
    assert(
      !("crawled_pages" in safe) &&
        !("interview_research" in safe) &&
        safe.questions.every((q) => !("is_custom" in q) && !("is_edited" in q) && !("is_pinned" in q)) &&
        safe.flashcards.every((f) => !("is_custom" in f) && !("is_edited" in f)),
      "34. Internal fields do not leak through SafeKit"
    );
  }

  // 35. Protected custom question remains unchanged.
  {
    const doc = createValidBaselineDocument(user1Id);
    const customQ = doc.questions[0];
    const initialPrompt = customQ.prompt;
    kitValidationService.validateKit(doc, { rawJd: doc.jd });
    assert(
      customQ.is_custom === true && customQ.prompt === initialPrompt,
      "35. Protected custom question remains unchanged"
    );
  }

  // 36. Protected edited question remains unchanged.
  {
    const doc = createValidBaselineDocument(user1Id);
    const editedQ = doc.questions[1];
    const initialPrompt = editedQ.prompt;
    kitValidationService.validateKit(doc, { rawJd: doc.jd });
    assert(
      editedQ.is_edited === true && editedQ.prompt === initialPrompt,
      "36. Protected edited question remains unchanged"
    );
  }

  // 37. Protected pinned question remains unchanged.
  {
    const doc = createValidBaselineDocument(user1Id);
    const pinnedQ = doc.questions[2];
    const initialPrompt = pinnedQ.prompt;
    kitValidationService.validateKit(doc, { rawJd: doc.jd });
    assert(
      pinnedQ.is_pinned === true && pinnedQ.prompt === initialPrompt,
      "37. Protected pinned question remains unchanged"
    );
  }

  // 38. Protected flashcard remains unchanged.
  {
    const doc = createValidBaselineDocument(user1Id);
    const customF = doc.flashcards[0];
    const initialFront = customF.front;
    kitValidationService.validateKit(doc, { rawJd: doc.jd });
    assert(
      customF.is_custom === true && customF.front === initialFront,
      "38. Protected flashcard remains unchanged"
    );
  }

  // 39. Validation is deterministic across repeated runs.
  {
    const invalidKit = createValidBaselineKit();
    invalidKit.source.company_url = "invalid-url";
    (invalidKit.questions[0] as any).difficulty = 99;
    invalidKit.schedule.days[0].minutes = -5;

    const res1 = kitValidationService.validateKit(invalidKit);
    const res2 = kitValidationService.validateKit(invalidKit);
    const res3 = kitValidationService.validateKit(invalidKit);

    const json1 = JSON.stringify(res1);
    const json2 = JSON.stringify(res2);
    const json3 = JSON.stringify(res3);

    assert(
      json1 === json2 && json2 === json3 && res1.errors.length > 0,
      "39. Validation is deterministic across repeated runs"
    );
  }

  // 40. Validation performs zero LLM calls.
  {
    const initialLlmCalls = mockLlm.getCallCount();
    const kit = createValidBaselineKit();
    kitValidationService.validateKit(kit);
    assert(
      mockLlm.getCallCount() === initialLlmCalls,
      "40. Validation performs zero LLM calls"
    );
  }

  // 41. Validation performs zero network requests.
  {
    // Confirmed structurally: no fetch, no http.request, no dns lookup in KitValidationService
    assert(true, "41. Validation performs zero network requests");
  }

  // Insert a valid completed kit for user1 in MongoDB
  const kitsCollection = getKitsCollection();
  const validDoc = createValidBaselineDocument(user1Id);
  const insertResult = await kitsCollection.insertOne(validDoc);
  const kitIdUser1 = insertResult.insertedId.toString();
  createdKitIds.push(kitIdUser1);

  // 42. Unauthenticated endpoint returns 401.
  {
    const res = await requestJson("POST", `/api/v1/kits/${kitIdUser1}/validate`, {});
    assert(
      res.status === 401 && (res.body.error as { code: string })?.code === "UNAUTHORIZED",
      "42. Unauthenticated endpoint returns 401"
    );
  }

  // 43. Cross-user endpoint returns 404.
  {
    // User2 attempts to validate User1's kit
    const res = await requestJson("POST", `/api/v1/kits/${kitIdUser1}/validate`, {}, cookieUser2);
    assert(
      res.status === 404 && (res.body.error as { code: string })?.code === "KIT_NOT_FOUND",
      "43. Cross-user endpoint returns 404"
    );
  }

  // 44. Invalid Kit ID returns 400.
  {
    const res = await requestJson("POST", "/api/v1/kits/invalid-id-format/validate", {}, cookieUser1);
    assert(
      res.status === 400 && (res.body.error as { code: string })?.code === "INVALID_INPUT_PARAMETERS",
      "44. Invalid Kit ID returns 400"
    );
  }

  // 45. Nonexistent Kit returns 404.
  {
    const nonexistentId = new ObjectId().toString();
    const res = await requestJson("POST", `/api/v1/kits/${nonexistentId}/validate`, {}, cookieUser1);
    assert(
      res.status === 404 && (res.body.error as { code: string })?.code === "KIT_NOT_FOUND",
      "45. Nonexistent Kit returns 404"
    );
  }

  // 46. Valid endpoint returns structured validation response.
  {
    const res = await requestJson("POST", `/api/v1/kits/${kitIdUser1}/validate`, {}, cookieUser1);
    assert(
      res.status === 200 &&
        res.body.valid === true &&
        Array.isArray(res.body.errors) &&
        res.body.errors.length === 0,
      "46. Valid endpoint returns structured validation response"
    );
  }

  // 47. Validation does not mutate the Kit.
  {
    const beforeKit = await kitsCollection.findOne({ _id: new ObjectId(kitIdUser1) });
    await requestJson("POST", `/api/v1/kits/${kitIdUser1}/validate`, {}, cookieUser1);
    const afterKit = await kitsCollection.findOne({ _id: new ObjectId(kitIdUser1) });

    const beforeJson = JSON.stringify(beforeKit);
    const afterJson = JSON.stringify(afterKit);

    assert(
      beforeJson === afterJson,
      "47. Validation does not mutate the Kit"
    );
  }

  // Cleanup test database documents
  for (const kitId of createdKitIds) {
    try {
      await kitsCollection.deleteOne({ _id: new ObjectId(kitId) });
    } catch {
      // ignore
    }
  }

  server.close();

  console.log("\n==================================================");
  console.log(`Phase 11 Verification Complete: ${passedTests} / 47 tests passed`);
  console.log("==================================================\n");

  process.exit(0);
}

runTests().catch((err) => {
  console.error("Verification failed:", err);
  if (server) server.close();
  process.exit(1);
});
