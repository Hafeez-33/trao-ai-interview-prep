import type {
  KitStructure,
  KitRequirement,
  KitQuestion,
  KitFlashcard,
  KitSchedule,
  KitCompanyBrief,
  KitRole,
  KitSource,
} from "../../../shared/contracts/kit.schema.js";

export const mockUser = {
  id: "6ab0b02647b5ec03f320cfd6",
  email: "alice@example.com",
  name: "Alice Developer",
  createdAt: "2026-09-20T10:00:00.000Z",
};

export const mockSecondUser = {
  id: "6ab0b02747b5ec03f320cfd7",
  email: "bob@example.com",
  name: "Bob Engineer",
  createdAt: "2026-09-20T10:05:00.000Z",
};

export const mockRequirements: KitRequirement[] = [
  {
    id: "r1",
    text: "Proficiency in Node.js and TypeScript microservices",
    kind: "technical",
    priority: "must",
  },
  {
    id: "r2",
    text: "Experience with MongoDB aggregation pipelines",
    kind: "technical",
    priority: "nice",
  },
  {
    id: "r3",
    text: "Distributed systems and caching with Redis",
    kind: "technical",
    priority: "must",
  },
  {
    id: "r4",
    text: "Effective cross-functional communication and agile leadership",
    kind: "behavioural",
    priority: "nice",
  },
];

export const mockQuestions: KitQuestion[] = [
  {
    id: "q1",
    category: "technical",
    prompt: "How does the Node.js event loop handle asynchronous I/O and worker threads?",
    difficulty: 2,
    requirement_ids: ["r1"],
    answer_outline: "Explain the libuv event loop phases (timers, poll, check, close), worker pool offloading, and process.nextTick vs setImmediate.",
  },
  {
    id: "q2",
    category: "technical",
    prompt: "How do you optimize complex MongoDB aggregation queries with proper indexing?",
    difficulty: 1,
    requirement_ids: ["r2"],
    answer_outline: "Use $match as early as possible to leverage index filters, ensure covered queries, and analyze execution plans with explain().",
  },
  {
    id: "q3",
    category: "system-design",
    prompt: "Design a distributed cache invalidation strategy for a high-traffic microservices cluster.",
    difficulty: 3,
    requirement_ids: ["r3"],
    answer_outline: "Compare write-through and cache-aside patterns, use Redis pub/sub or Kafka events for broadcast invalidation, and mitigate thundering herds.",
  },
  {
    id: "q4",
    category: "behavioural",
    prompt: "Describe a situation where you had to lead a team through a high-priority production incident.",
    difficulty: 2,
    requirement_ids: ["r4"],
    answer_outline: "Structure response using STAR framework: situation triaging, stakeholder communications, and post-mortem preventive measures.",
  },
];

export const mockFlashcards: KitFlashcard[] = [
  {
    id: "f1",
    front: "What is the difference between setImmediate and process.nextTick in Node.js?",
    back: "process.nextTick executes immediately after the current operation before the event loop continues, while setImmediate runs in the check phase of the loop.",
    requirement_ids: ["r1"],
  },
  {
    id: "f2",
    front: "What is the primary trade-off of the Cache-Aside pattern?",
    back: "High read throughput vs potential momentary stale data and cache miss latency on initial access.",
    requirement_ids: ["r3"],
  },
];

export const mockCompanyBrief: KitCompanyBrief = {
  summary: "Acme Cloud builds next-generation serverless observability and application performance monitoring tools.",
  what_they_do: "They provide distributed tracing, real-time log analysis, and automated anomaly detection for microservices.",
  sources: ["https://example.com/about", "https://example.com/careers"],
};

export const mockRole: KitRole = {
  title: "Senior Backend Engineer",
  seniority: "Senior",
  responsibilities: ["Design distributed microservices", "Optimize database aggregations"],
  requirements: mockRequirements,
};

export const mockSchedule: KitSchedule = {
  days_available: 5,
  days: [
    {
      day: 1,
      focus: "High-priority distributed systems & architecture",
      minutes: 45,
      question_ids: ["q3"],
    },
    {
      day: 2,
      focus: "Core Node.js event loop & asynchronous runtime",
      minutes: 45,
      question_ids: ["q1"],
    },
    {
      day: 3,
      focus: "MongoDB aggregations & indexing performance",
      minutes: 30,
      question_ids: ["q2"],
    },
    {
      day: 4,
      focus: "Behavioural & incident leadership scenarios",
      minutes: 30,
      question_ids: ["q4"],
    },
    {
      day: 5,
      focus: "Final synthesis and full-concept review",
      minutes: 30,
      question_ids: [],
    },
  ],
};

export const mockSource: KitSource = {
  company: "Acme Cloud",
  company_url: "https://example.com",
  role: "Senior Backend Engineer",
  location: "Remote",
  jd_chars: 120,
  researched_at: "2026-09-20T10:00:00.000Z",
  pages_used: ["https://example.com/about", "https://example.com/careers"],
};

export const mockValidKit: KitStructure = {
  source: mockSource,
  company_brief: mockCompanyBrief,
  role: mockRole,
  questions: mockQuestions,
  flashcards: mockFlashcards,
  coverage: {
    uncovered_requirement_ids: [],
    passes: 1,
  },
  schedule: mockSchedule,
};

export const mockPartialKit: Partial<KitStructure> = {
  source: mockSource,
  role: {
    title: "Software Engineer",
    seniority: "Mid",
    responsibilities: ["Develop features"],
    requirements: [mockRequirements[0]],
  },
};
