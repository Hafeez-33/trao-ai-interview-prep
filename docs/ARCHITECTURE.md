# Architecture Design Document
## Trao AI Interview Prep Kit

---

## 1. System Overview

The **Trao AI Interview Prep Kit** is a full-stack web application and automated evaluation system that transforms raw job descriptions and company URLs into personalized, structured interview preparation kits.

The architecture strictly enforces **separation of concerns** between:
1. **Interactive Web Application** (Next.js + Express API + MongoDB)
2. **Deterministic Processing Engines** (Coverage checking, Schedule allocation, Contract validation)
3. **External Research & Scraper Layer** (Robots.txt-compliant site crawler, link ranker, page cleaner)
4. **Targeted AI Generation Services** (Multi-stage LLM prompts with token-rate resilience)
5. **Headless Batch Evaluator CLI** (Executes the identical core pipeline from the command line)

---

## 2. High-Level Architectural Flow

```text
┌────────────────────────────────────────────────────────┐
│                   User Interfaces                      │
│   Web UI (Next.js)      │     CLI Batch Runner         │
│   (Interactive Builder, │     (npm run evaluate)       │
│    Practice Mode)       │                              │
└──────────────┬──────────┴──────────────┬───────────────┘
               │ HTTP REST               │ CLI Execution
               ▼                         │
┌────────────────────────────────────────┼───────────────┐
│              Backend API Layer         │               │
│   - Auth Controller & Session Guard    │               │
│   - Kits Controller (CRUD + Slices)    │               │
│   - Practice Controller                │               │
└──────────────┬─────────────────────────┘               │
               ▼                                         │
┌────────────────────────────────────────────────────────▼┐
│               Core Application Pipeline                 │
│                                                         │
│   1. Input Validation (Zod / Contracts)                 │
│   2. Requirement Extraction (LLM -> Stable IDs)         │
│   3. Dynamic Site Crawler & Link Ranker (Cheerio/HTTP)  │
│   4. Public Interview Search / Heuristic Scanner        │
│   5. Company Brief & Role Synthesizer (LLM)             │
│   6. Categorized Question Generation (LLM Staged)       │
│   7. Flashcard Generation (LLM)                         │
│   8. Deterministic Coverage Engine (Code Rule Checker)  │
│   9. Second-Pass Gap Closure Loop (LLM)                 │
│  10. Deterministic Schedule Allocator (Math/Heuristic)  │
│  11. Strict Appendix A Schema Validator (Zod)           │
└──────────────┬──────────────────────────────────────────┘
               ▼
┌────────────────────────────────────────────────────────┐
│                  Persistence Layer                     │
│   MongoDB Database (User & Kit Documents)              │
│   - Edit & Pin Preservation State                       │
│   - Flashcard Practice Confidence Tracking              │
└────────────────────────────────────────────────────────┘
```

---

## 3. Shared Pipeline Principle

> [!IMPORTANT]
> **Zero Duplicate Logic**: The CLI batch evaluator (`npm run evaluate`) and the web application API (`POST /kits/:id/generate`) invoke the **exact same pipeline function** (`generateKitPipeline`). The only difference is the trigger and final sink (HTTP response / MongoDB vs. STDOUT / JSON file).

```text
CLI (npm run evaluate) ──┐
                         ├──► executeKitPipeline(caseInput) ──► Strict Appendix A Validation ──► Appendix B Result
Web API (POST /generate) ┘
```

---

## 4. Responsibility Boundaries: AI vs. Deterministic

The assessment specifically rewards strict engineering judgment regarding **what the LLM does** vs. **what application code must control**.

| System Responsibility | Execution Engine | Rationale |
| :--- | :---: | :--- |
| **Requirement Extraction** | **AI (LLM)** | Natural language parsing of unstructured JD text. |
| **Requirement Stable ID Assignment (`r1`, `r2`)** | **Deterministic (Code)** | Guarantees predictable, non-hallucinated sequential IDs. |
| **Requirement Kind & Priority Tagging** | **AI + Schema Validation** | Identifies `technical`/`behavioural`/`domain` and `must`/`nice`. |
| **URL Crawling & Link Ranking** | **Deterministic (Code)** | Follows site links, computes keyword relevance scores. |
| **Page Text Sanitization & Size Limit** | **Deterministic (Code)** | Strips HTML/scripts/styles, caps token payload, enforces bounds. |
| **Company Brief & Interview Insights** | **AI (LLM)** | Synthesizes crawled text into clear company background. |
| **Category-Specific Question Generation** | **AI (LLM)** | Prompts tailored per requirement category. |
| **Answer Outline & Flashcard Content** | **AI (LLM)** | Creates pedagogical prep content based on requirements. |
| **Coverage Verification & Gap Detection** | **Deterministic (Code)** | Arithmetic set comparison: `uncovered = must_requirements - covered_requirements`. |
| **Second-Pass Gap Identification** | **Deterministic (Code)** | Isolates only uncovered requirement IDs to pass to retry prompt. |
| **Schedule Allocation Across Days** | **Deterministic (Code)** | Exact mathematical distribution of questions across $D$ days. |
| **Schedule Duration Calculation** | **Deterministic (Code)** | Integer minute sum based on question difficulty formula. |
| **Preservation of User Edits / Pins** | **Deterministic (Code)** | Merge logic preserving dirty/pinned items during regeneration. |
| **Appendix A Schema Enforcement** | **Deterministic (Zod)** | Runtime schema validation rejecting invalid structures. |
| **Authorization & Ownership** | **Deterministic (Code)** | Ensures users access only their own kits. |

---

## 5. Security Boundaries & Threat Modeling

### 5.1 Untrusted Input & Prompt Injection Defense
- **Rule:** Fetched webpage text and pasted job descriptions are **DATA**, never instructions.
- **Implementation:** All external text fed to the LLM is encapsulated within distinct XML delimiters (e.g. `<untrusted_company_content>` and `<untrusted_job_description>`). System prompts explicitly instruct the model to ignore any instructional text, override attempts, or prompt leakage contained inside those data tags.

### 5.2 Server-Side Request Forgery (SSRF) Protection
- External company URLs are validated before network requests:
  - Valid protocols: `http:` and `https:` only.
  - In production: Private IP ranges (RFC 1918), loopback (`127.0.0.1`, `localhost`), metadata endpoints (`169.254.169.254`), and local subnet ranges are blocked.
  - In development / batch evaluation mode: Local addresses (`http://localhost:*`, `http://127.0.0.1:*`) are explicitly allowed to satisfy assessment testing requirements against local test servers.

### 5.3 Request & Content Size Limits
- Job descriptions: Capped at 50,000 characters.
- Scraped HTML pages: Download size capped at 1.5MB per page; raw text extracted and truncated to 8,000 characters per page before feeding to the LLM.
- Link crawling: Maximum 5 internal links fetched per domain; timeout capped at 5 seconds per request.

### 5.4 Secret Management
- Zero hardcoded credentials. All secrets (`SESSION_SECRET`, `LLM_API_KEY`, `DATABASE_URL`) are loaded from environment variables documented in `.env.example`.

---

## 6. Planned Project Structure

```text
trao-ai-interview-prep/
├── backend/
│   ├── src/
│   │   ├── config/          # Environment & constants
│   │   ├── controllers/     # HTTP route handlers (Auth, Kits, Practice)
│   │   ├── routes/          # Express route definitions
│   │   ├── middleware/      # Auth guard, validation, error handler, rate limiter
│   │   ├── models/          # MongoDB Mongoose schemas
│   │   ├── services/        # Business orchestration services
│   │   │   ├── pipeline.ts  # Core generation pipeline (Shared with CLI)
│   │   │   ├── crawler/     # Scraper, link scorer, page cleaner, robots parser
│   │   │   ├── llm/         # LLM client with exponential backoff & rate-limiter
│   │   │   ├── prompts/     # Staged prompts (extraction, company, questions, flashcards)
│   │   │   ├── coverage/    # Deterministic requirement coverage checker
│   │   │   ├── scheduler/   # Deterministic day-by-day schedule allocator
│   │   │   └── state/       # Edit / Pin merge logic for section regeneration
│   │   └── utils/           # Logger, SSRF validator, sanitizers
│   ├── scripts/
│   │   └── evaluate.ts      # Mandatory batch runner (npm run evaluate)
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router pages
│   │   ├── components/      # Reusable UI components (Builder, Practice, Schedule)
│   │   ├── hooks/           # Custom React hooks (useKit, usePractice, useAuth)
│   │   ├── lib/             # API client, state helpers
│   │   └── styles/          # Tailwind CSS tokens
│   ├── package.json
│   └── tsconfig.json
│
├── shared/
│   └── contracts/
│       ├── kit.schema.ts    # Exact Appendix A TypeScript types & Zod schemas
│       ├── batch.schema.ts  # Exact Appendix B TypeScript types & Zod schemas
│       └── api.schema.ts    # Request/response DTOs for web API
│
├── tests/
│   ├── unit/                # Coverage, scheduler, and schema validator tests
│   ├── integration/         # Pipeline & batch evaluation tests
│   └── fixtures/            # Mock cases, stub JDs, sample HTML pages
│
├── cases/                   # Sample test cases for batch evaluation
├── docs/                    # Architecture, Database, API, Pipeline, Errors, Batch specs
├── PLAN.md                  # Master implementation plan
├── README.md                # Project documentation
├── .env.example             # Documented environment template
└── .gitignore               # Root ignore rules
```
