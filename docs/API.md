# API Specification & Contracts
## Trao AI Interview Prep Kit

---

## 1. API Standards & Conventions

- **Base Path**: `/api/v1`
- **Content-Type**: `application/json`
- **Authentication**: Bearer JWT token in `Authorization: Bearer <token>` header or `httpOnly` secure session cookie.
- **Error Response Format**: Consistent JSON error payload (see [ERRORS.md](file:///d:/A%20PROJECT/Trao%20Assesment/trao-ai-interview-prep/docs/ERRORS.md)).

---

## 2. Endpoints Overview

### 2.1 Authentication

#### `POST /api/v1/auth/register`
- **Purpose**: Register a new user account.
- **Auth Required**: No.
- **Request Body**:
  ```json
  {
    "email": "candidate@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Validation**:
  - `email`: valid email string.
  - `password`: minimum 8 characters.
- **Response `201 Created`**:
  ```json
  {
    "user": { "id": "usr_123", "email": "candidate@example.com" },
    "token": "jwt_token_string"
  }
  ```
- **Errors**: `400 Bad Request` (validation failure), `409 Conflict` (email already exists).

---

#### `POST /api/v1/auth/login`
- **Purpose**: Authenticate user credentials and start a session.
- **Auth Required**: No.
- **Request Body**:
  ```json
  {
    "email": "candidate@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "user": { "id": "usr_123", "email": "candidate@example.com" },
    "token": "jwt_token_string"
  }
  ```
- **Errors**: `401 Unauthorized` (invalid credentials).

---

#### `POST /api/v1/auth/logout`
- **Purpose**: Terminate current session.
- **Auth Required**: Yes.
- **Response `200 OK`**:
  ```json
  { "message": "Successfully logged out" }
  ```

---

### 2.2 Kit Management (CRUD)

#### `POST /api/v1/kits`
- **Purpose**: Create a new Kit draft and trigger asynchronous or streamed pipeline generation.
- **Auth Required**: Yes.
- **Request Body**:
  ```json
  {
    "jd": "Senior Backend Engineer with 5+ years of Node.js and MongoDB...",
    "company_url": "https://posthog.com",
    "days": 5
  }
  ```
- **Validation**:
  - `jd`: non-empty string, min 10 chars, max 50,000 chars.
  - `company_url`: valid URL string.
  - `days`: integer between 1 and 60.
- **Response `201 Created`**:
  ```json
  {
    "kit": {
      "_id": "kit_678",
      "status": "generating",
      "source": { "company_url": "https://posthog.com", "days_available": 5 },
      "createdAt": "2026-09-01T09:12:44Z"
    }
  }
  ```

---

#### `GET /api/v1/kits`
- **Purpose**: List all kits owned by the authenticated user.
- **Auth Required**: Yes.
- **Response `200 OK`**:
  ```json
  {
    "kits": [
      {
        "_id": "kit_678",
        "company": "PostHog",
        "role": "Senior Backend Engineer",
        "status": "completed",
        "createdAt": "2026-09-01T09:12:44Z"
      }
    ]
  }
  ```

---

#### `GET /api/v1/kits/:id`
- **Purpose**: Fetch a complete kit by ID.
- **Auth Required**: Yes (Ownership verified).
- **Response `200 OK`**: Returns the full `InternalKitStructure` conforming to Appendix A.
- **Errors**: `404 Not Found`, `403 Forbidden`.

---

#### `PATCH /api/v1/kits/:id`
- **Purpose**: Save user edits (inline question edits, category reordering, flashcard updates, pinned states).
- **Auth Required**: Yes (Ownership verified).
- **Request Body**:
  ```json
  {
    "questions": [ ... ],
    "flashcards": [ ... ],
    "company_brief": { ... }
  }
  ```
- **Response `200 OK`**: Returns updated `InternalKitStructure`.

---

#### `DELETE /api/v1/kits/:id`
- **Purpose**: Delete a prep kit.
- **Auth Required**: Yes.
- **Response `200 OK`**:
  ```json
  { "message": "Kit deleted successfully" }
  ```

---

### 2.3 Section Regeneration (Preserving User Edits)

#### `POST /api/v1/kits/:id/regenerate`
- **Purpose**: Regenerate a single section/category without losing user edits or pinned items.
- **Auth Required**: Yes.
- **Request Body**:
  ```json
  {
    "target": "questions", // "questions" | "company_brief" | "schedule"
    "category": "technical" // applicable when target is "questions"
  }
  ```
- **Response `200 OK`**: Returns updated kit where protected questions are preserved and unedited AI questions are replaced.

---

### 2.4 Practice Mode & Flashcard Confidence

#### `GET /api/v1/kits/:id/practice`
- **Purpose**: Get current practice session cards, ordered by lowest confidence / due review.
- **Auth Required**: Yes.
- **Response `200 OK`**:
  ```json
  {
    "totalCards": 15,
    "reviewedCount": 8,
    "cards": [
      {
        "flashcardId": "f1",
        "front": "What is the event loop in Node.js?",
        "back": "The event loop...",
        "confidence": "hard",
        "reviewCount": 2
      }
    ]
  }
  ```

---

#### `POST /api/v1/kits/:id/practice`
- **Purpose**: Record user confidence on a flashcard review.
- **Auth Required**: Yes.
- **Request Body**:
  ```json
  {
    "flashcardId": "f1",
    "confidence": "good" // "again" | "hard" | "good" | "easy"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "flashcardId": "f1",
    "confidence": "good",
    "nextReviewDue": "2026-09-02T10:00:00Z"
  }
  ```

---

### 2.5 Multi-Role Bulk Upload

#### `POST /api/v1/kits/bulk`
- **Purpose**: Upload a JSON or CSV file containing multiple `{ jd, company_url, days }` tuples.
- **Auth Required**: Yes.
- **Request Body**: Multi-part form or JSON array.
- **Response `202 Accepted`**:
  ```json
  {
    "queued": 3,
    "kitIds": ["kit_01", "kit_02", "kit_03"]
  }
  ```
