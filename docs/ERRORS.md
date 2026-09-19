# Error Handling & Edge Cases Specification
## Trao AI Interview Prep Kit

---

## 1. Error Philosophy & Principles

1. **Graceful Degradation over Fatal Crashes**: External failures (e.g. 404 on company website, no hiring page found, missing public discussion) must **never abort the entire pipeline**. The system produces an honest kit with clear indicators of what was found and what was unavailable.
2. **Deterministic Error Taxonomy**: All system errors carry structured error codes and user-friendly messages.
3. **Multi-Sink Representation**: Errors are logged with complete stack traces internally, rendered as actionable toasts/banners in the web UI, and serialized into Appendix B error structures for the batch CLI.

---

## 2. Error Taxonomy & Codes

| Error Category | Error Code | HTTP Status | CLI Behavior | Description |
| :--- | :--- | :---: | :---: | :--- |
| **Validation** | `INVALID_INPUT_PARAMETERS` | `400` | Mark case `failed` | JD missing or invalid URL/days parameter. |
| **Authentication** | `UNAUTHORIZED` | `401` | N/A | Missing or invalid auth session token. |
| **Authorization** | `FORBIDDEN_KIT_ACCESS` | `403` | N/A | User attempting to view/modify another user's kit. |
| **Resource** | `KIT_NOT_FOUND` | `404` | N/A | Requested kit ID does not exist. |
| **Crawling** | `COMPANY_UNREACHABLE` | `200` (Degraded) | Proceed `ok` / Record in kit | Company site returned timeout/DNS failure after 3 retries. Note in brief. |
| **Crawling** | `NO_HIRING_PAGE_FOUND` | `200` (Degraded) | Proceed `ok` | Crawl succeeded but no hiring page exists. Note honestly in brief. |
| **LLM Service** | `LLM_RATE_LIMIT_EXCEEDED` | `503` / Retry | Exponential backoff (max 3 retries) | Provider returned 429. Paced queue retries automatically. |
| **LLM Service** | `LLM_OUTPUT_PARSE_ERROR` | `500` / Retry | Re-prompt with strict schema | LLM returned malformed JSON. Clean & retry parse. |
| **Coverage** | `UNCOVERED_MUST_REQUIREMENTS` | `500` | Mark `failed` if pass 2 fails | Pipeline unable to close must-have requirement gaps. |
| **Schema** | `SCHEMA_VALIDATION_ERROR` | `500` | Mark case `failed` | Generated kit failed strict Appendix A Zod schema. |
| **Batch Fatal** | `FATAL_CASE_FAILURE` | N/A | Mark case `failed` & continue | Case could not produce a kit at all. Output formatted per Appendix B. |

---

## 3. Representation Across System Layers

### 3.1 Backend Internal Log Format
```typescript
interface InternalErrorLog {
  timestamp: string;
  level: "warn" | "error" | "fatal";
  errorCode: string;
  caseId?: string;
  kitId?: string;
  url?: string;
  message: string;
  stack?: string;
  details?: Record<string, unknown>;
}
```

### 3.2 Frontend API Error Response Payload
```json
{
  "success": false,
  "error": {
    "code": "COMPANY_UNREACHABLE",
    "message": "Unable to connect to company website after 3 retries. Generated kit based on job description only.",
    "details": {
      "targetUrl": "https://invalid-nonexistent-domain.xyz"
    }
  }
}
```

### 3.3 Batch Evaluator Error Format (Appendix B Strict Schema)
When a case **fails completely** and cannot produce a kit:
```json
{
  "id": "case-04",
  "status": "failed",
  "kit": null,
  "error": {
    "code": "COMPANY_UNREACHABLE",
    "message": "Company site unreachable after 3 retries."
  }
}
```

---

## 4. Edge Cases & Handling Strategies

### 1. Two-Line Stub Job Description
- **Approach**: Extract only the few genuine requirements present. Do not hallucinate or invent 15 fake requirements. Produce an honest, concise kit with a note in `company_brief.summary`.

### 2. Company Site with No Careers or Hiring Page
- **Approach**: Synthesize company brief from homepage and about page. In the interview section, note honestly: *"No public hiring or interview process documentation found for this company. Questions are tailored directly to role requirements."*

### 3. Rate Limit / 429 From Free Tier LLM Provider
- **Approach**: Wrap all LLM calls in a token-bucket queue with exponential backoff and jitter (`initialDelay: 1500ms`, `factor: 2`, `maxRetries: 3`).

### 4. Schedule Boundary Cases (1 Day vs 60 Days)
- **1 Day**: Group all must-have questions into a focused, intensive high-yield session for Day 1.
- **60 Days**: Distribute questions systematically, pairing new concepts in early days with progressive review/mock sessions in later days.
