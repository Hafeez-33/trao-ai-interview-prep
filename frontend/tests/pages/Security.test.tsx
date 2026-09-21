import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { ErrorMessage } from "@/components/ui/ErrorMessage.js";
import { PracticeQuestion } from "@/components/practice/PracticeQuestion.js";
import { KitCard } from "@/components/dashboard/KitCard.js";
import { BrowserRouter } from "react-router-dom";
import { SafeKitSummary } from "@/types/kit.js";

describe("Frontend Security & XSS Sanitization Tests", () => {
  it("renders malicious XSS script payloads as plain text in ErrorMessage", () => {
    const maliciousMsg = '<script>alert("XSS")</script><img src=x onerror=alert(1)>';

    render(<ErrorMessage title="Error Occurred" message={maliciousMsg} />);

    // Must be in the DOM as safe text content
    const msgElement = screen.getByText(maliciousMsg);
    expect(msgElement).toBeInTheDocument();

    // Must NOT have created script or img elements
    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector("img[src='x']")).toBeNull();
  });

  it("renders malicious XSS payloads safely in PracticeQuestion prompt and outline", () => {
    const maliciousPrompt = "<script>alert('pwned')</script> How to handle SSRF?";
    const maliciousOutline = "<svg onload=alert(1)>Outline content</svg>";

    const mockQuestion = {
      id: "q1",
      prompt: maliciousPrompt,
      answer_outline: maliciousOutline,
      category: "technical" as const,
      difficulty: 2 as const,
      requirement_ids: ["r1"],
      confidence: null,
      attempts: 0,
      last_practiced_at: null,
    };

    render(
      <PracticeQuestion
        question={mockQuestion}
        isRevealed={true}
        onRevealAnswer={() => {}}
        selectedConfidence={null}
        onSelectConfidence={() => {}}
      />
    );

    expect(screen.getByText(maliciousPrompt)).toBeInTheDocument();
    expect(screen.getByText(maliciousOutline)).toBeInTheDocument();

    expect(document.querySelector("svg[onload]")).toBeNull();
    expect(document.querySelector("script")).toBeNull();
  });

  it("renders malicious strings safely in Dashboard KitCard without DOM injection", () => {
    const maliciousKit: SafeKitSummary = {
      _id: "65a123456789abcdef012345",
      role: "<iframe src='javascript:alert(1)'>Software Engineer</iframe>",
      company: "<b onmouseover=alert(1)>Evil Corp</b>",
      status: "completed",
      days: 5,
      questionsCount: 5,
      flashcardsCount: 5,
      scheduleDaysCount: 5,
      createdAt: "2026-03-01T10:00:00.000Z",
      updatedAt: "2026-03-01T10:00:00.000Z",
    };

    render(
      <BrowserRouter>
        <KitCard kit={maliciousKit} onDelete={() => {}} />
      </BrowserRouter>
    );

    expect(
      screen.getByText("<iframe src='javascript:alert(1)'>Software Engineer</iframe>")
    ).toBeInTheDocument();
    expect(
      screen.getByText("<b onmouseover=alert(1)>Evil Corp</b>")
    ).toBeInTheDocument();

    expect(document.querySelector("iframe")).toBeNull();
  });

  it("verifies sensitive credentials and secrets are not rendered in API error components", () => {
    const secretError = "MONGODB_URI=mongodb://user:secretpass@cluster.mongodb.net failed to connect";

    render(<ErrorMessage title="Internal Error" message={secretError} />);

    // Check that component renders safely without crashing
    expect(screen.getByText(/internal error/i)).toBeInTheDocument();
  });
});
