# Diraschool API Documentation (Developer + Maintenance Guide)

Version: `v1`  
Base path: `/api/v1`  
Health endpoint: `/health`

## 1. Purpose and Scope

This document is the implementation-aligned reference for:
- Backend developers extending the API.
- Frontend/mobile teams integrating against current behavior.
- Operators maintaining production incidents, workers, and data integrity.

It is derived from code in `apps/api/src` (routes, validators, controllers, models, middleware, workers).

## 2. System Overview

Stack:
- Node.js + Express (`ESM` modules).
- MongoDB (Mongoose) for primary data.
- Redis (ioredis) for cache, rate-limit counters, and job state.
- BullMQ for async jobs.
- Cookie-based JWT auth.

Server entrypoint:
- `src/server.js`

Worker entrypoint:
- `src/jobs/worker.entry.js`

Key runtime behavior:
- HTTP server starts before DB/Redis to satisfy liveness checks quickly.
- MongoDB failures at startup are logged; reconnects happen in background.
- Redis degradation is non-fatal for most request paths.

## 3. Environment Variables

Required (process exits if missing):
- `MONGO_URI`
- `REDIS_URL`
- `JWT_SECRET` (minimum 32 chars)
- `CLIENT_URL`

Common optional vars:
- `CLIENT_URL_STAGING`
- `JWT_EXPIRES_IN` (default `1d`)
- `PORT` (default `3000`)
- `RESEND_API_KEY`, `EMAIL_FROM`
- `AT_USERNAME`, `AT_API_KEY`, `AT_SENDER_ID`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `SENTRY_DSN`
- `SCHOOL_RATE_LIMIT` (default `300` req/min per school)

## 4. Security Model

Middleware order (`server.js`):
1. `helmet`
2. `cors`
3. custom CSRF origin/referer guard (`csrf`)
4. JSON/urlencoded parser + cookies
5. route handlers
6. 404
7. global error handler

Auth and session:
- JWT is stored in cookie `token`.
- Cookie is `httpOnly`; `secure` in production.
- `sameSite`: `strict` in production, `lax` in development.

CSRF guard:
- For `POST|PUT|PATCH|DELETE`, validates `Origin` or `Referer` against allowlist.
- Allows non-browser clients with no origin/referer headers.

Rate limiting:
- Auth endpoints: 20 requests / 15 min (`express-rate-limit`, except in test env).
- Per-school limiter in `protect`: Redis `INCR` window; default 300 req/min.

## 5. Response and Error Conventions

Success shape:
```json
{
  "status": "success",
  "...": "payload fields"
}
```

Error shape:
```json
{
  "message": "Human-readable error"
}
```

Pagination helper returns:
```json
"meta": {
  "total": 123,
  "page": 1,
  "limit": 20,
  "totalPages": 7
}
```

Global error normalization:
- Mongoose validation: `400`
- Mongoose cast/ObjectId errors: `400`
- Duplicate key: `409`
- JWT invalid/expired: `401`

## 6. Auth, Roles, and Access Gates

Roles (`constants/index.js`):
- `superadmin`
- `school_admin`, `director`, `headteacher`, `deputy_headteacher`
- `secretary`, `accountant`, `teacher`, `parent`

Middleware primitives:
- `protect`: validates cookie JWT, loads user, checks user active, checks school active/subscription status, applies per-school rate-limit.
- `blockIfMustChangePassword`: blocks most routes when `mustChangePassword=true`.
- `authorize(...roles)`: role allowlist.
- `adminOnly`: school admin roles only.
- `superadminOnly`: platform role only.

Plan feature gate (`requireFeature`):
- Reads plan from cache/DB and blocks with `403` when unavailable.
- Feature keys:
  - `report_cards`, `parent_portal`, `timetable`, `library`, `transport`, `bulk_import`, `audit_log`, `sms`
- Note: current `PLAN_FEATURE_MAP` includes all features on all tiers (pricing TODO).

## 7. Authentication Lifecycle

Registration (`POST /auth/register`):
- Creates school + school admin in transaction.
- Creates email verification token (hashed in DB, 24h expiry).
- Enqueues verification email.
- Does **not** set auth cookie until verified.

Login (`POST /auth/login`):
- Requires `emailVerified=true` and `invitePending=false`.
- Sets auth cookie and returns user.

Password/reset/invite:
- `POST /auth/forgot-password`: enumeration-safe response.
- `POST /auth/reset-password/:token`: sets new password, clears reset token, logs user in.
- `POST /auth/accept-invite/:token`: sets password for invited account, marks verified, logs in.
- `POST /auth/change-password`: allowed even when `mustChangePassword=true`.

## 8. Endpoint Catalog

### 8.1 Public + Session endpoints

- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/forgot-password`
- `POST /auth/reset-password/:token`
- `POST /auth/accept-invite/:token`
- `GET /auth/verify-email/:token`
- `POST /auth/resend-verification`
- `POST /auth/logout` (protected)
- `GET /auth/me` (protected + `blockIfMustChangePassword`)
- `POST /auth/change-password` (protected)

### 8.2 Users (`/users`) - `adminOnly`

- `GET /users` (optional query `role`)
- `POST /users`
- `GET /users/:id`
- `PATCH /users/:id`
- `POST /users/:id/resend-invite`

Behavior notes:
- Creates staff with generated temporary password and `mustChangePassword=true`.
- Resend invite re-issues temporary password.
- Admin cannot mutate own record through this module.

### 8.3 Schools (`/schools`)

All require `protect` + `blockIfMustChangePassword`.

School admin routes:
- `GET /schools/me` (`adminOnly`)
- `PATCH /schools/me` (`adminOnly`)

Superadmin routes:
- `GET /schools`
- `POST /schools`
- `GET /schools/:id`
- `PATCH /schools/:id`
- `PATCH /schools/:id/subscription`

Behavior notes:
- Subscription/status updates bust Redis subscription cache.
- `isActive=false`, `suspended`, or `expired` blocks protected access at middleware layer.

### 8.4 Classes (`/classes`) - `adminOnly`

- `GET /classes`
- `POST /classes`
- `GET /classes/:id`
- `PATCH /classes/:id`
- `DELETE /classes/:id`
- `POST /classes/:id/promote`

Behavior notes:
- Class list supports Redis caching for simple first-page query.
- Promotion uses transaction-like flow to move active students and sync `studentCount`.

### 8.5 Students (`/students`) - `adminOnly`

- `GET /students`
- `POST /students`
- `GET /students/:id`
- `PATCH /students/:id`
- `POST /students/:id/transfer`
- `POST /students/:id/withdraw`
- `POST /students/import` (`requireFeature(bulk_import)`, CSV upload)
- `GET /students/import/:jobId/status`

Behavior notes:
- Enrollment can link existing parent or create parent user.
- Import uses in-memory CSV parsing and BullMQ `import` queue.
- Import result is stored in Redis key `import:result:{jobId}` (TTL 2h).

### 8.6 Attendance (`/attendance`) - `adminOnly`

- `GET /attendance/registers`
- `POST /attendance/registers`
- `GET /attendance/registers/:id`
- `PATCH /attendance/registers/:id`
- `POST /attendance/registers/:id/submit`

Behavior notes:
- Exactly one register per class/day per school.
- Submitted registers are immutable.
- Student entries must be active students in that class.

### 8.7 Subjects (`/subjects`) - `adminOnly`

- `GET /subjects`
- `POST /subjects`
- `GET /subjects/:id`
- `PATCH /subjects/:id`
- `PATCH /subjects/:id/teacher`
- `DELETE /subjects/:id`

Behavior notes:
- Pre-primary classes cannot have subjects.
- `PATCH /teacher` accepts null/undefined to unassign.

### 8.8 Exams (`/exams`) - `adminOnly`

- `GET /exams`
- `POST /exams`
- `GET /exams/:id`
- `PATCH /exams/:id`
- `DELETE /exams/:id`

Behavior notes:
- Pre-primary classes cannot have exams.
- Cannot change `totalMarks` if results already exist.
- Cannot delete exam when results exist.

### 8.9 Results (`/results`) - `adminOnly`

- `POST /results/bulk`
- `GET /results`
- `GET /results/:id`
- `PATCH /results/:id`

Behavior notes:
- Bulk endpoint upserts per `(schoolId, examId, studentId)`.
- Grade/points computed from CBC rubric (`computeCBCGrade`).
- Marks cannot exceed exam total marks.

### 8.10 Fees (`/fees`) - `adminOnly`

Structures:
- `GET /fees/structures`
- `POST /fees/structures`
- `GET /fees/structures/:id`
- `PATCH /fees/structures/:id`
- `DELETE /fees/structures/:id`

Payments:
- `GET /fees/payments`
- `POST /fees/payments`
- `GET /fees/payments/:id`
- `POST /fees/payments/:id/reverse`

Balance:
- `GET /fees/balance?studentId=&academicYear=&term=`

Behavior notes:
- Payment create enqueues async receipt PDF generation.
- Reverse marks status and records reason/user/time.
- Balance uses fee structure total minus completed payments aggregate.

### 8.11 Report Cards (`/report-cards`) - `adminOnly` + `requireFeature(report_cards)`

- `POST /report-cards/generate`
- `POST /report-cards/generate-class`
- `GET /report-cards/annual-summary?studentId=&academicYear=`
- `GET /report-cards`
- `GET /report-cards/:id`
- `PATCH /report-cards/:id/remarks`
- `PATCH /report-cards/:id/subjects/:subjectId/remark`
- `POST /report-cards/:id/publish`

Behavior notes:
- Generation computes weighted subject averages + attendance summary.
- Published cards are immutable (no regen, no remark edits).
- Class generation skips already published students.

### 8.12 Parent Portal (`/parent`) - `role=parent` + `requireFeature(parent_portal)`

- `GET /parent/children`
- `GET /parent/children/:studentId/fees`
- `GET /parent/children/:studentId/attendance`
- `GET /parent/children/:studentId/results`
- `GET /parent/children/:studentId/report-cards`

Behavior notes:
- Child access is restricted to `req.user.children` links.
- Report-card view is published-only.

### 8.13 Audit Logs (`/audit-logs`) - `adminOnly` + `requireFeature(audit_log)`

- `GET /audit-logs`

Filters:
- `resource`, `action`, `userId`, `resourceId`, `from`, `to`, pagination.

### 8.14 Settings (`/settings`) - `adminOnly`

- `GET /settings`
- `PUT /settings`
- `POST /settings/holidays`
- `DELETE /settings/holidays/:holidayId`

Behavior notes:
- Lazy creates settings doc on first GET.
- Cached in Redis (`settings:{schoolId}`), invalidated on updates.

### 8.15 Timetables (`/timetables`) - `requireFeature(timetable)`

Read roles: admin + teacher + secretary  
Write roles: admin only

- `GET /timetables`
- `GET /timetables/:id`
- `POST /timetables`
- `PUT /timetables/:id/slots`
- `DELETE /timetables/:id`

### 8.16 Library (`/library`) - `requireFeature(library)`

Books:
- `GET /library/books`
- `GET /library/books/:id`
- `POST /library/books` (admin)
- `PATCH /library/books/:id` (admin)

Loans:
- `POST /library/loans`
- `GET /library/loans`
- `GET /library/loans/:id`
- `POST /library/loans/:id/return`
- `PATCH /library/loans/:id/overdue` (admin)

Behavior notes:
- Issue/return use DB transactions to preserve copy counts.

### 8.17 Transport (`/transport`) - `requireFeature(transport)`

Read roles: staff  
Write roles: admin only

- `GET /transport/routes`
- `GET /transport/routes/:id`
- `POST /transport/routes`
- `PATCH /transport/routes/:id`
- `DELETE /transport/routes/:id`
- `POST /transport/routes/:id/assign`
- `POST /transport/routes/:id/unassign`

## 9. Data Model and Integrity Rules

Core uniqueness/index constraints:
- `User`: unique `(schoolId, email)`.
- `School`: unique `email`.
- `Class`: unique `(schoolId, name, stream, academicYear, term)`.
- `Student`: unique `(schoolId, admissionNumber)`.
- `Attendance`: unique `(schoolId, classId, date)`.
- `Subject`: unique `(schoolId, classId, name)`.
- `Exam`: unique `(schoolId, classId, subjectId, name, term, academicYear)`.
- `Result`: unique `(schoolId, examId, studentId)`.
- `FeeStructure`: unique `(schoolId, classId, academicYear, term)`.
- `Timetable`: unique `(schoolId, classId, academicYear, term)`.
- `TransportRoute`: unique `(schoolId, name)`.
- `Book`: unique `(schoolId, isbn)` when ISBN present.
- `ReportCard`: unique `(schoolId, studentId, academicYear, term)`.

Important cross-entity invariants:
- Student `status` drives allowed operations (e.g., active-only checks).
- Class `studentCount` is maintained by hooks and controller flows; avoid bypass writes.
- Report cards are treated as snapshots plus remarks, not live joins.

## 10. Async Jobs and Worker Operations

Queues (`jobs/queues.js`):
- `sms`
- `report`
- `import`
- `receipt`
- `email`

Worker process (`npm run worker`):
- Must run separately from API process in production.
- Concurrency defaults:
  - `sms`: 5
  - `report`: 2
  - `receipt`: 5
  - `import`: 1
  - `email`: 5

Failure semantics:
- Queue-level retry policies vary by queue.
- Some enqueue operations are non-fatal to request success (e.g., receipt PDF).

Cloudinary behavior:
- PDF upload helpers return `null` when Cloudinary env vars are absent.
- Business operation still succeeds; only remote PDF URL is skipped.

## 11. Caching and Redis Keys

Primary keys used:
- `school:sub:{schoolId}` (subscription/plan cache)
- `school:classes:{schoolId}:all` (class list cache)
- `settings:{schoolId}` (settings cache)
- `rate:school:{schoolId}:{minuteWindow}` (per-school limiter)
- `import:result:{jobId}` (CSV import result)

Operational note:
- `cacheDelPattern` uses Redis `KEYS`; avoid high-cardinality wildcard use at scale.

## 12. Audit Logging Coverage

Audit writes are fire-and-forget (`utils/auditLogger.js`) and do not block responses.

Current explicit logged actions include:
- Student create/transfer/withdraw.
- Payment create/reverse.
- Report card publish.
- School activate/suspend/subscription update.
- Library create/issue/return.

## 13. Validation Contracts (High-Level)

Validation is Zod-based in each feature validator and rejects with first error message.

Important contract examples:
- IDs are 24-char hex ObjectId strings.
- Academic year is 4-digit string (`YYYY`).
- Terms are exact enum: `Term 1`, `Term 2`, `Term 3`.
- Phone fields use Kenyan patterns for relevant endpoints.
- Import upload must be CSV, field name `file`, max 5MB.

## 14. Testing and Quality Gates

Available scripts (`apps/api/package.json`):
- `npm run dev`
- `npm start`
- `npm run worker`
- `npm test`
- `npm run test:coverage`
- `npm run lint`

Integration tests exist under `tests/integration` and module tests under `src/features/**/__tests__`.

## 15. Maintenance Playbook

When adding a new module:
1. Add model with school scoping + indexes.
2. Add validator (strict body/query schemas).
3. Add controller with `sendSuccess/sendError` helpers.
4. Add routes with correct middleware order (`protect` first).
5. Mount route in `server.js` under `/api/v1/...`.
6. Add tests for auth, tenant boundaries, and edge cases.
7. Add audit logging for sensitive state changes.
8. Update this document.

When changing auth/subscription behavior:
1. Update middleware in `auth.js` / `requireFeature.js`.
2. Verify cache invalidation for `school:sub:{id}`.
3. Re-test protected routes and role-plan gate paths.

When changing worker/job contracts:
1. Update enqueue payload and worker processor atomically.
2. Maintain backward compatibility if old jobs may still be in queue.
3. Re-check retry policy and idempotency.

## 16. Known Design Notes

- Current response format is `status: "success"` (not `success: true`).
- `PLAN_FEATURE_MAP` is currently permissive on all tiers by design (pricing pending).
- `DELETE /classes/:id` performs hard delete (with guard), despite earlier comments referencing soft delete.
- Redis outages are intentionally fail-open for non-critical paths.

---

Source of truth: implementation in `apps/api/src`.
