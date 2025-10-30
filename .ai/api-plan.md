# REST API Plan

## 1. Resources
- **User** — maps to `users` table
- **CV (Curriculum Vitae)** — maps to `cvs` table
- **Letter** — maps to `letters` table
- **Auth / Session** — authentication endpoints (not stored in DB schema as separate table in MVP)
- **S3 Uploads / Storage** — external objects referenced by `s3_key` fields

## 2. Endpoints

Notes on conventions used in endpoints below:
- All endpoints require `Authorization: Bearer <JWT>` except `/auth/register` and `/auth/login`.
- All JSON request/response bodies use UTF-8 and `application/json` unless otherwise noted.
- Lists use cursor-based pagination (cursor = `created_at,id` pair) by default; `?limit=..&cursor=..`.
- All resource IDs are UUIDs.

### Auth / Users

1) Register
- Method: POST
- Path: `/auth/register`
- Description: Create a new user account (email + password). Returns JWT on success.
- Request JSON:
```json
{ "email": "user@example.com", "password": "strongPassword" }
```
- Response 201:
```json
{ "user": { "id": "uuid", "email": "user@example.com", "created_at": "iso8601" }, "token": "jwt" }
```
- Errors:
  - 400 Bad Request — validation errors (invalid email, weak password)
  - 409 Conflict — email already exists

2) Login
- Method: POST
- Path: `/auth/login`
- Description: Exchange credentials for JWT
- Request JSON:
```json
{ "email": "user@example.com", "password": "password" }
```
- Response 200:
```json
{ "user": { "id": "uuid", "email": "user@example.com" }, "token": "jwt" }
```
- Errors:
  - 401 Unauthorized — invalid credentials

3) Get current user
- Method: GET
- Path: `/users/me`
- Description: Returns minimal profile for current authenticated user
- Response 200:
```json
{ "id": "uuid", "email": "user@example.com", "created_at": "iso8601" }
```

### CVs (cvs)

Flow design choice: use S3 presigned uploads to avoid proxying binaries through backend. Two-step flow:
1. Client requests a presigned upload URL (`POST /cvs/presign`) — backend enforces per-user limits and returns presigned PUT URL and an `upload_id` or temp `s3_key`.
2. Client uploads file directly to S3 and then calls `POST /cvs` to confirm create record (or backend can accept a single multipart upload alternative if preferred).

1) Get presigned upload URL (enforce limits before issuing)
- Method: POST
- Path: `/cvs/presign`
- Description: Return S3 presigned URL and metadata to upload a new CV. Backend checks per-user CV count (max 5).
- Request JSON:
```json
{ "filename": "cv.pdf", "content_type": "application/pdf", "length": 123456 }
```
- Response 200:
```json
{ "s3_key": "temp/.../uuid.pdf", "upload_url": "https://...", "expires_in": 3600 }
```
- Errors:
  - 400 — invalid filename, not a PDF, or size too large
  - 403 — user reached max CVs (5)

2) Confirm uploaded CV (create DB record)
- Method: POST
- Path: `/cvs`
- Description: Create `cvs` record after successful upload to S3. This call must be short and transactional; use advisory lock to enforce max 5 rule.
- Request JSON:
```json
{ "s3_key": "temp/.../uuid.pdf", "filename": "cv.pdf" }
```
- Response 201:
```json
{ "id": "uuid", "user_id": "uuid", "s3_key": "...", "filename": "cv.pdf", "created_at": "iso8601" }
```
- Errors:
  - 400 — filename too long (>255), invalid s3_key
  - 409 — user already has 5 CVs (race-protected check)
  - 422 — S3 object missing or not text-based PDF (validation/OCR failed)

3) List CVs (paginated)
- Method: GET
- Path: `/cvs`
- Query params: `?limit=20&cursor=<created_at,id>&sort=desc` (default desc)
- Description: List current user's CVs (most recent first)
- Response 200:
```json
{ "items": [{"id":"uuid","filename":"cv.pdf","created_at":"iso8601"}], "next_cursor": "<cursor>" }
```

4) Get CV metadata
- Method: GET
- Path: `/cvs/:id`
- Description: Return CV metadata (no file contents). Access limited to owner via RLS/App auth.
- Response 200:
```json
{ "id":"uuid","filename":"cv.pdf","s3_key":"...","created_at":"iso8601" }
```

5) Delete CV
- Method: DELETE
- Path: `/cvs/:id`
- Description: Deletes DB record and (recommended) deletes S3 object synchronously; if S3 deletion fails, schedule compensating job and report error.
- Response 204 No Content
- Errors:
  - 404 — not found
  - 403 — not owner
  - 500 — S3 deletion failed (retry/queue)

### Extraction / OCR status
- Extraction is performed asynchronously after CV confirm. Expose status and failure reason.

1) Get extraction status
- Method: GET
- Path: `/cvs/:id/extraction`
- Response 200:
```json
{ "status": "pending|success|failed", "extracted_text_sample": "...", "error": "..." }
```
- Errors:
  - 404 — not found
  - 403 — not owner

### Job: Create Letter (AI pipeline)
Design: POST creates a letter-generation job tied to a CV and job description. Generation can be async; return letter record with `status`.

1) Create generation job / Create letter
- Method: POST
- Path: `/letters`
- Description: Start pipeline: use chosen CV(s) and job description to generate HTML letter. Enforce per-user limit (max 5 letters).
- Request JSON:
```json
{
  "cv_id": "uuid",         // optional: if omitted, use user's primary CV
  "job_title": "Senior Backend Engineer",
  "job_description": "<text 1000-10000 chars>",
  "preferences": { }
}
```
- Response 202 (accepted) or 201 if synchronous generation used:
```json
{ "id":"uuid","user_id":"uuid","status":"pending|completed|failed","created_at":"iso8601" }
```
- Errors:
  - 400 — missing/invalid fields (job_description length), CV missing/extraction failed
  - 403 — user hit max letters (5)
  - 422 — AI provider error

2) Get letter (metadata + HTML)
- Method: GET
- Path: `/letters/:id`
- Description: Return letter metadata and HTML content (if generation complete). `html` can be large; consider streaming or omitting HTML in listing endpoints.
- Response 200:
```json
{ "id":"uuid","user_id":"uuid","html":"<string>","pdf_s3_key":"...|null","status":"completed","created_at":"iso8601","updated_at":"iso8601" }
```

3) List letters (paginated)
- Method: GET
- Path: `/letters`
- Query: `?limit=20&cursor=...&sort=desc`
- Response 200:
```json
{ "items":[{"id":"uuid","status":"completed","created_at":"iso8601"}], "next_cursor":"..." }
```

4) Edit letter text
- Method: PATCH
- Path: `/letters/:id`
- Description: Save edits made by the user in the simple editor. Update `html` and `updated_at`.
- Request JSON:
```json
{ "html": "<new html>" }
```
- Validation: `html` max length <= 200000 characters
- Response 200: updated record
- Errors:
  - 400 — html too large
  - 403 — not owner

5) Generate PDF for a letter (server-side)
- Method: POST
- Path: `/letters/:id/generate-pdf`
- Description: Synchronously or asynchronously render `html` to PDF and upload to S3; response contains `pdf_s3_key` and optionally a presigned download URL.
- Response 200 (sync) or 202 (async):
```json
{ "pdf_s3_key": "...", "download_url": "https://..." }
```
- Errors:
  - 404 — letter not found
  - 403 — not owner
  - 500 — PDF generation failed

6) Download PDF
- Method: GET
- Path: `/letters/:id/download` (redirect or return presigned URL)
- Description: Returns or redirects to presigned S3 URL for download. Use short expiry.
- Response 302 Location header (or 200 with URL in body)


## 3. Authentication & Authorization
- Mechanism: JWT-based stateless authentication with short expiry and refresh token strategy if needed. Implement in NestJS using Passport/JWT strategy.
- Passwords: store salted password hashes (argon2/bcrypt) — hashing parameters configured in backend, not DB.
- Authorization: every resource endpoint must validate that the current user is the owner of the requested resource.
- DB-level enforcement (required by DB plan): set PostgreSQL session variable per request and enable RLS, e.g. `SELECT set_config('app.current_user', '<user_uuid>', true);` immediately after connecting/authenticating for each request/transaction. This ensures that server-side queries are protected by RLS policies declared in DB.
- For connection pooling (pgbouncer), ensure safe strategy (e.g., short-lived DB connections or a middleware that sets session context per-request).

## 4. Validation & Business Logic (mapped from DB + PRD)
- Global:
  - All endpoints must validate and sanitize input using DTOs (class-validator / zod) in NestJS.
  - All endpoints return structured error payloads: `{ "status": "error", "code": "ERR_CODE", "message": "Human message", "details": { ... } }`.

- Users:
  - `email` must be a valid email; unique constraint enforced by DB and surfaced as 409.
  - `password` must meet minimum complexity (configurable).

- CVs:
  - File type: only `application/pdf` allowed (PRD: only PDF). Reject other content types. (See PRD: "only PDF", `.ai/prd.md`)
  - File size: enforce max size (few MB) in presign and/or after upload (PRD: "limit: a few MB").
  - Filename length <= 255 (DB CHECK: `cvs.filename_length`).
  - Max per user: 5 CVs — enforce transactionally using one of the DB patterns:
    - Preferred: use `pg_advisory_xact_lock(hashtext(current_setting('app.current_user', true))::bigint)` then count and insert (example in `.ai/db-plan.md`). If count >= 5 — return 403/409.
  - On confirm, verify the S3 object exists and pass a lightweight validation: ensure PDF is text-based (simple OCR check or check for embedded text). If extraction fails mark extraction status `failed` and report to user.

- Letters:
  - HTML max length <= 200000 (DB CHECK `letters_html_max_length`). Enforce in DTO and reject larger payloads with 400.
  - Max letters per user: 5. Enforce with same transactional pattern as CVs (advisory lock) to avoid races.
  - Job description length: 1000–10000 characters (PRD). Reject out-of-range with 400.
  - If CV extraction missing or insufficient, creating a letter should fail early with the PRD message: `"No data: could not generate letter"` (map to 422 or 400 with error code `EXTRACTION_INSUFFICIENT`).

## 5. Pagination, Filtering, Sorting
- Use cursor pagination for lists (`created_at,id`) with `limit` param. This suits the composite index `user_id, created_at DESC` in DB.
- Sorting: default `created_at DESC` for both `cvs` and `letters`. Support `sort=asc|desc` if needed.
- Filtering: allow minimal filters (e.g., `status` for letters: `pending|completed|failed`).

## 6. Security & Performance Considerations
- Security:
  - Enforce HTTPS for all client-backend and client-S3 interactions.
  - Use JWT auth; store refresh tokens securely (httpOnly cookie or secure storage per product choice).
  - Validate files on upload: content-type and size; do a secondary check on S3 after upload to ensure the object is valid.
  - RLS: set `app.current_user` per request to leverage DB RLS policies from the schema (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) and prevent accidental cross-user access.
  - Revoke `password_hash` access from public DB roles (as specified in DB plan).
  - Rate-limit endpoints per IP and per user (e.g., 10 generation jobs per minute per user) — enforce in NestJS using rate-limit middleware.
- Performance:
  - Use presigned S3 uploads to reduce backend load.
  - Keep DB transactions short; upload to S3 outside transactions; only create DB record in a short transaction that checks limits and inserts.
  - Use composite `user_id, created_at DESC` indexes for efficient listing per user.
  - Offload long-running tasks (AI generation, PDF rendering, OCR/extraction) to background workers and expose job/status endpoints.

## 7. Error codes and mapping (examples)
- 400 Bad Request — input validation failed (INVALID_INPUT)
- 401 Unauthorized — missing/invalid auth token (UNAUTHORIZED)
- 403 Forbidden — business rule forbids operation (e.g., max resources reached) (FORBIDDEN/MAX_LIMIT_REACHED)
- 404 Not Found — resource doesn’t exist or not visible to user (NOT_FOUND)
- 409 Conflict — duplicate resource (e.g., email exists) (CONFLICT)
- 422 Unprocessable Entity — extraction or AI generation failed because of domain data (EXTRACTION_FAILED / AI_ERROR)
- 500 Internal Server Error — unexpected failures

## 8. Async job patterns and webhooks
- AI generation and OCR should be queued (e.g., BullMQ/Redis or a worker pool). Endpoints return job IDs or `letters` records with `status` to poll.
- Optionally support server-sent events / websockets for real-time job updates, but polling via `GET /letters/:id` and `GET /cvs/:id/extraction` is sufficient for MVP.

## 9. Operational & Logging
- Log events required by PRD: `CV_uploaded`, `Letter_generated`, `OCR_performed`, `Extraction_failed`, `File_deleted` with fields `{ timestamp, userId, eventType, metadata }` to a server logfile or structured log sink.
- Emit metrics on counts of uploads, generation success/failures and latencies.

## 10. Assumptions and open questions
- Assumptions:
  - Use JWT access tokens for API auth and a refresh token mechanism if session expiry is required.
  - Use S3-compatible storage with presigned URLs for uploads and downloads.
  - Extraction/OCR result not stored in DB (only referenced in job logs or metadata); if needed, add `extracted_text` to `cvs` or a separate table.
  - PDF generation will be handled by a worker (puppeteer/wkhtmltopdf) and uploaded to S3; DB stores `pdf_s3_key`.
- Open questions to clarify with product owner:
  - Should extraction text be persisted for later reuse/search? (Current DB plan does not store it.)
  - Preferred concurrency model / worker infra (Redis/Bull, serverless, etc.)

