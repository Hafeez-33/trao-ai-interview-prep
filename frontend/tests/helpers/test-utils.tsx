import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { SafeKit, SafeKitSummary } from "@/types/kit.js";

export const mockUser = {
  id: "6ab0b02647b5ec03f320cfd6",
  email: "alice@example.com",
  name: "Alice Developer",
  createdAt: "2026-09-20T10:00:00.000Z",
};

export const mockKit: SafeKit = {
  _id: "6ab0b02647b5ec03f320cfd8",
  userId: "6ab0b02647b5ec03f320cfd6",
  status: "completed",
  jd: "Senior Node.js and React Developer with microservices and TypeScript expertise.",
  source: {
    company: "Acme Corp",
    company_url: "https://example.com",
    role: "Senior Fullstack Engineer",
    location: "Remote",
    jd_chars: 120,
    researched_at: "2026-09-20T10:00:00.000Z",
    pages_used: ["https://example.com/about"],
  },
  company_brief: {
    summary: "Acme Corp builds enterprise cloud tools.",
    what_they_do: "They develop distributed microservices and monitoring dashboards.",
    sources: ["https://example.com/about"],
  },
  role: {
    title: "Senior Fullstack Engineer",
    seniority: "Senior",
    responsibilities: ["Lead frontend architecture", "Build distributed APIs"],
    requirements: [
      { id: "r1", text: "React & TypeScript UI components", kind: "technical", priority: "must" },
      { id: "r2", text: "Node.js microservices", kind: "technical", priority: "must" },
    ],
  },
  questions: [
    {
      id: "q1",
      category: "technical",
      prompt: "Explain React 18 concurrent rendering and automatic batching.",
      difficulty: 2,
      requirement_ids: ["r1"],
      answer_outline: "Discuss flushSync, startTransition, and fiber priority scheduling.",
    },
  ],
  flashcards: [
    {
      id: "f1",
      front: "What does useTransition hook do?",
      back: "Marks state updates as non-blocking transitions to keep UI responsive.",
      requirement_ids: ["r1"],
    },
  ],
  schedule: {
    days_available: 3,
    days: [
      { day: 1, focus: "React concurrency", minutes: 30, question_ids: ["q1"] },
      { day: 2, focus: "Node runtime", minutes: 30, question_ids: [] },
      { day: 3, focus: "Review", minutes: 30, question_ids: [] },
    ],
  },
  coverage: {
    uncovered_requirement_ids: [],
    passes: 1,
  },
  createdAt: "2026-09-20T10:00:00.000Z",
  updatedAt: "2026-09-20T10:05:00.000Z",
};

export const mockKitSummary: SafeKitSummary = {
  _id: "6ab0b02647b5ec03f320cfd8",
  company: "Acme Corp",
  role: "Senior Fullstack Engineer",
  status: "completed",
  createdAt: "2026-09-20T10:00:00.000Z",
};

export function renderWithRouter(
  ui: React.ReactElement,
  {
    route = "/",
    path = "/",
  }: {
    route?: string;
    path?: string;
  } = {}
) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path={path} element={ui} />
      </Routes>
    </MemoryRouter>
  );
}
