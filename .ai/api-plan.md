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

Simplified flow: the backend accepts direct uploads and performs the S3 upload internally. There are three endpoints: upload (create), list, and delete. We no longer use presigned URLs or separate metadata endpoints.

1) Upload CV (create + upload)
- Method: POST
- Path: `/cvs`
- Description: Accept a single file upload (multipart/form-data) with field name `cv` (PDF required) and optional `filename`. The server validates the file, enforces per-user limit (max 5 CVs), uploads the file to S3, and creates the `cvs` DB record in a single request.
- Request: multipart/form-data with file `cv` (Content-Type: `application/pdf`) and optional `filename` string
- Response 201:
```json
{ "id": "uuid", "user_id": "uuid", "filename": "cv.pdf", "s3_key": "...", "created_at": "iso8601" }
```
- Errors:
  - 400 — invalid file (not PDF, missing file, filename too long)
  - 403 — user reached max CVs (5)
  - 422 — upload/S3 validation failed (e.g., file missing after upload, virus/OCR validation failed)

2) List CVs
- Method: GET
- Path: `/cvs`
- Description: Return all CVs for the current authenticated user. No pagination is required because users can have at most 5 CVs.
- Response 200:
```json
{ "items": [{"id":"uuid","filename":"cv.pdf","created_at":"iso8601"}] }
```

3) Delete CV
- Method: DELETE
- Path: `/cvs/:id`
- Description: Delete the CV DB record and the S3 object (attempt synchronous deletion; if S3 deletion fails, schedule a retry and return 500). Access limited to owner.
- Response 204 No Content
- Errors:
  - 404 — not found
  - 403 — not owner
  - 500 — S3 deletion failed (retry/queue)

### Letters (letters)

1) Create letter (generate)
- Method: POST
- Path: `/letters`
- Description: Start pipeline: use chosen CV and job description to generate HTML letter. Enforce per-user limit (max 5 letters).
- Request JSON:
```json
{
  "cv_id": "uuid",
  "job_title": "Senior Backend Engineer",
  "job_description": "<text 1000-10000 chars>"
}
```
- Response 201 (synchronous generation):
```json
{ "id":"uuid","user_id":"uuid","html":"<string>","status":"completed","created_at":"iso8601" }
```
- Errors:
  - 400 — missing/invalid fields (job_description length), CV missing/extraction failed
  - 403 — user hit max letters (5)
  - 422 — AI provider error

2) List letters
- Method: GET
- Path: `/letters`
- Description: Return all letters for the current authenticated user. No pagination is required because users can have at most 5 letters.
- Response 200:
```json
{ "items":[{"id":"uuid","html":"<string>","status":"completed","created_at":"iso8601","updated_at":"iso8601"}] }
```

3) Download letter as PDF
- Method: GET
- Path: `/letters/:id/download`
- Description: Generates PDF from letter HTML and returns it as a file download (Content-Type: application/pdf, Content-Disposition: attachment).
- Response 200: PDF binary stream
- Errors:
  - 404 — letter not found
  - 403 — not owner
  - 500 — PDF generation failed


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

