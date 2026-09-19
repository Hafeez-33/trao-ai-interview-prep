# TRAO AI INTERVIEW PREP KIT
# Master Implementation Plan

> This document is the master plan for the Trao Full-Stack Engineering Assessment.
> Follow the phases sequentially unless a dependency requires otherwise.
>
> The goal is to build a reliable, explainable, production-quality MVP that satisfies
> the Trao assessment requirements without unnecessary scope.

---

# 0. Assessment Objective

Build a full-stack web application that turns:

- Job Description
- Company Website URL
- Number of Days Before Interview

into a personalized interview preparation kit.

The application must:

1. Authenticate users.
2. Accept job descriptions and company URLs.
3. Research the company website.
4. Discover relevant hiring/interview information.
5. Search public discussion about the company's interview process.
6. Extract requirements from the job description.
7. Generate categorized interview questions.
8. Generate flashcards.
9. Check requirement coverage deterministically.
10. Generate missing questions when requirements are uncovered.
11. Generate a deterministic day-by-day preparation schedule.
12. Allow users to edit and restructure the generated kit.
13. Preserve user edits during regeneration.
14. Provide flashcard practice mode.
15. Provide the mandatory batch evaluation command.
16. Handle failures and edge cases honestly.
17. Be publicly deployed.
18. Include tests, README, and a 3–4 minute walkthrough video.

---

# 1. Assessment Priorities

The implementation must remain aligned with the Trao evaluation criteria.

## Automated Evaluation — 55 Points

### Requirement Extraction — 20 points

The system must:

- Correctly identify requirements from the JD.
- Distinguish `must` and `nice`.
- Categorize requirements as:
  - `technical`
  - `behavioural`
  - `domain`
- Avoid inventing requirements.

### Coverage + Schedule — 15 points

The system must:

- Ensure every must-have requirement has question coverage.
- Detect uncovered requirements using application code.
- Generate missing questions when necessary.
- Re-check coverage.
- Generate exactly the number of requested days.
- Include all must-have requirements in the schedule.

### Research + Sequencing — 10 points

The system must:

- Crawl the company site.
- Rank and follow useful links.
- Search for hiring information.
- Search public interview discussion.
- Generate questions separately by requirement/category.
- Perform a genuine second-pass coverage loop.

### Robustness — 10 points

The system must:

- Handle unreachable websites.
- Handle 404s/timeouts.
- Handle missing hiring pages.
- Handle thin job descriptions.
- Handle missing public interview information.
- Handle invalid/incomplete LLM output.
- Handle rate limiting.
- Handle duplicate submissions.
- Handle 1-day and 60-day schedules.
- Validate generated kit structure.
- Continue batch processing after individual failures.

---

# 2. Human Review — 45 Points

## Builder — 15 points

The application must support:

- Editing questions.
- Editing answer outlines.
- Editing flashcards.
- Editing company brief.
- Reordering questions.
- Moving questions between categories.
- Adding questions.
- Adding flashcards.
- Deleting questions.
- Deleting flashcards.
- Regenerating individual sections.
- Preserving user edits during regeneration.

## Interaction Design — 10 points

The application must provide:

- Clear loading states.
- Generation progress.
- Empty states.
- Error states.
- Partial failure handling.
- Responsive laptop/phone UI.
- Keyboard navigation.
- Immediate-feeling editing/reordering.

## Code Quality + README — 10 points

The project must have:

- Clean architecture.
- Separation of concerns.
- Meaningful naming.
- Appropriate abstractions.
- Meaningful Git commits.
- Automated tests.
- Complete README.
- Clear design decisions and trade-offs.

## Practice + Creative Feature — 10 points

The application must:

- Provide flashcard practice.
- Reveal answers.
- Record confidence.
- Prioritize weaker cards.

An optional creative feature may be added only after all mandatory requirements work.

---

# 3. Non-Negotiable Contracts

These must not be changed casually.

## 3.1 Kit Structure

Every generated kit must conform to the required Appendix A structure.

Required top-level sections:

```text
source
company_brief
role
questions
flashcards
schedule
coverage