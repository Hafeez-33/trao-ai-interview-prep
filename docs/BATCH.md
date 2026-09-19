# Batch Evaluation CLI Specification
## Trao AI Interview Prep Kit

---

## 1. Overview & Command Invocation

Section 9 of the Trao Assessment requires an automated evaluation command:

```bash
npm run evaluate -- --input <cases.json> --output <kits.json>
```

This command runs the exact same retrieval, generation, coverage, and scheduling pipeline headlessly across a batch of test cases and writes a single JSON output file conforming to **Appendix B**.

---

## 2. Input Specification (Appendix B)

The input file `<cases.json>` contains an array of test cases:

```json
[
  {
    "id": "case-01",
    "jd": "Senior Backend Engineer\n\nWe are looking for a Node.js engineer with 5+ years experience...",
    "company_url": "http://localhost:8099/acme/",
    "days": 5
  },
  {
    "id": "case-02",
    "jd": "Frontend Developer with React expertise.",
    "company_url": "https://example.com",
    "days": 3
  }
]
```

### Input Field Constraints:
- `id`: string (unique identifier for the test case).
- `jd`: string (raw job description text).
- `company_url`: string (URL of the company website; may point to `http://localhost:*` or an external domain).
- `days`: number (integer days available before interview, $1 \le \text{days} \le 60$).

---

## 3. Output Specification (Appendix B Strict Schema)

The generated output file `<kits.json>` must have the following exact schema:

```json
{
  "version": "1.0",
  "generated_at": "2026-09-01T09:12:44Z",
  "kits": [
    {
      "id": "case-01",
      "status": "ok",
      "kit": {
        "source": {
          "company": "Acme Corp",
          "company_url": "http://localhost:8099/acme/",
          "role": "Senior Backend Engineer",
          "location": "Remote",
          "jd_chars": 842,
          "researched_at": "2026-09-01T09:12:44Z",
          "pages_used": ["http://localhost:8099/acme/", "http://localhost:8099/acme/careers"]
        },
        "company_brief": {
          "summary": "Acme Corp builds developer tools.",
          "what_they_do": "Cloud infrastructure automation and observability.",
          "sources": ["http://localhost:8099/acme/"]
        },
        "role": {
          "title": "Senior Backend Engineer",
          "seniority": "Senior",
          "responsibilities": ["Design distributed systems", "Maintain microservices"],
          "requirements": [
            {
              "id": "r1",
              "text": "5+ years experience with Node.js and TypeScript",
              "kind": "technical",
              "priority": "must"
            }
          ]
        },
        "questions": [
          {
            "id": "q1",
            "requirement_ids": ["r1"],
            "category": "technical",
            "prompt": "How do you optimize asynchronous I/O in high-throughput Node.js microservices?",
            "answer_outline": "Discuss libuv worker pool, clustering, and stream backpressure.",
            "difficulty": 3
          }
        ],
        "flashcards": [
          {
            "id": "f1",
            "front": "What controls thread pool size in Node.js libuv?",
            "back": "UV_THREADPOOL_SIZE environment variable.",
            "requirement_ids": ["r1"]
          }
        ],
        "schedule": {
          "days_available": 5,
          "days": [
            {
              "day": 1,
              "focus": "Core Architecture & Backend Mastery",
              "question_ids": ["q1"],
              "minutes": 45
            }
          ]
        },
        "coverage": {
          "uncovered_requirement_ids": [],
          "passes": 1
        }
      },
      "error": null
    },
    {
      "id": "case-04",
      "status": "failed",
      "kit": null,
      "error": {
        "code": "COMPANY_UNREACHABLE",
        "message": "Company site unreachable after 3 retries."
      }
    }
  ]
}
```

---

## 4. Key Operational Rules & Guarantees

1. **Non-Aborting Execution**: If one case encounters a fatal error, it is recorded with `"status": "failed"` and structured error info. The batch evaluator **continues immediately** to the next case.
2. **Partial Research = Status `ok`**: If a company has no hiring page or is unreachable, but a valid kit can still be generated from the JD, the case produces `"status": "ok"` with the lack of research noted honestly in the kit. `"failed"` is reserved only for cases where a valid kit could not be produced at all.
3. **Local & Relative URLs**: The scraper accepts local test servers (`http://localhost:*`, `http://127.0.0.1:*`) and resolves relative links (`/about`, `../careers`) correctly against the origin.
4. **Performance & Rate Pacing**: 5 test cases will complete within 15 minutes, accommodating exponential backoff and rate limits gracefully.
5. **Clean Clone Usability**: The command runs without any interactive prompt or setup beyond standard environment configuration.
