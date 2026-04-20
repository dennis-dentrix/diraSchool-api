# EduSaaS (DiraSchool) — QA Report

**Date:** 2026-04-19  
**Reviewed by:** Claude Code (Senior QA Analysis)  
**Overall Rating: 6.5 / 10** — Solid MVP foundation, serious gaps before it can confidently sell.

---

## Table of Contents

1. [Architecture & Code Quality](#architecture--code-quality)
2. [Performance](#performance)
3. [UI / UX](#ui--ux)
4. [What's Missing](#whats-missing-that-matters-for-sales)
5. [What Should Be Removed](#what-should-be-removed)
6. [What Should Be Done Differently](#what-should-be-done-differently)
7. [Would It Sell?](#would-it-sell--honest-assessment)
8. [Priority Fix List](#priority-fix-list)
9. [Full Technical Findings — API](#full-technical-findings--api-backend)
10. [Full Technical Findings — Web](#full-technical-findings--web-frontend)
11. [Cross-Cutting Concerns](#cross-cutting-concerns)

---

## Architecture & Code Quality: 7.5/10

The backend is the strongest part of this codebase. Vertical slice architecture (one folder per domain), consistent async/error handling, HTTP-only JWT cookies, Zod validation on every route, and multi-tenancy enforced at every query level.

**What's right:**
- Feature-based folder structure is clean and scalable
- Redis caching for subscription checks, per-school rate limiting
- Mongoose transactions used correctly for enrollment and registration
- Audit logging infrastructure is in place
- Tests exist for core flows (auth, attendance, students, results, fees)

**What's broken:**
- `apps/api/src/features/payments/Payment.model.js` — receipt number generated via `countDocuments` in a pre-save hook. This is a **race condition**. Two concurrent payments at the same school read the same count → duplicate receipt numbers → financial records are corrupt. This alone could kill the product if it hits a busy school.
- No JWT refresh token. Users are hard-logged out after 24h mid-session. Jarring for teachers entering attendance or admins doing payroll.
- No global IP-level rate limit. Only auth routes are IP-limited. Any other endpoint is open to hammering from a single IP.
- `PLAN_FEATURE_MAP` grants all features to all tiers — the entire feature-gating system is a no-op. Fine for MVP but must be tracked.

---

## Performance: 5.5/10

The system will struggle under real school load if deployed as-is.

**Bottlenecks:**
- **Report card generation** loads all student results for an entire class into Node.js memory for JS-side grouping. For a class of 40 students × 7 subjects × 4 exams = 1,120+ documents per class, per request. This should be a MongoDB aggregation pipeline.
- **Finance dashboard** fetches `limit: 120` payments client-side for aggregation (today's total, monthly total). That aggregation belongs server-side in the dashboard endpoint.
- The `dashboard/page.jsx` is one giant client component that branches on role and fires multiple queries. Heavy initial load.
- Defined `CACHE_TTL` constants for classes, subjects, and settings but none of those caches are actually populated anywhere. Only subscription status is cached. The cache infrastructure is wired up but idle.
- Mongoose connection pool stays at default `maxPoolSize: 5`. Under multiple Railway dynos this will queue up.

**What will hold up:**
- `Promise.all` for parallel dashboard queries
- `lean()` on read-heavy aggregations
- Per-school Redis rate limiting
- Indexes are defined correctly on all common query shapes

---

## UI / UX: 5.5/10

The interface is functional but not polished enough to command ≥ KES 7,500/month from a school.

**What works:**
- shadcn/ui + Tailwind is a solid, modern design system
- Skeleton loading states on tables
- Toast notifications with `sonner`
- `EmptyState` component used in key places
- Destructive actions behind `AlertDialog`
- KES locale currency formatting throughout

**What hurts the product:**
- **No breadcrumb navigation.** User goes Students → Student Detail → back arrow. No visual location context anywhere.
- **Fees sidebar sub-navigation is defined but never rendered.** The Overview / Fee Structures / Payments children exist in `apps/web/src/lib/nav-items.js` but the `Sidebar` component ignores `children`. Users see one "Fees" link and have to discover the sub-pages on their own.
- **No direct "Enter Results" path.** Results entry lives inside `/exams/[id]`. There is no results page in the sidebar navigation.
- **Billing page pricing is hardcoded** (`BASE_FEE = 7500`, `PER_STUDENT = 40`) in `apps/web/src/app/(dashboard)/billing/page.jsx`. If pricing changes, that page will display wrong numbers.
- **Error states missing.** Most pages handle `isLoading` but not `isError`. API failure = silent empty table with no message. Schools will call support thinking data is lost.
- **Mobile:** `DataTable` has no `overflow-x-auto` wrapper. Wide tables break on phones. Attendance entry on mobile (most frequent teacher task) is not designed for touch.
- Dark/light mode is configured but not all dashboard components respect it uniformly.

---

## What's Missing (that matters for sales)

| Missing Feature | Impact |
|---|---|
| M-Pesa STK Push | Schools expect digital payment integration — manual M-Pesa reference entry is not competitive |
| In-app Notifications | `IN_APP_NOTIFICATION` queue exists but no UI or `/notifications` endpoint |
| Student photo upload | Model field exists, Cloudinary is configured, no upload form |
| PDF report card preview | PDFs generated async to Cloudinary but no page to view/download them |
| Email delivery log page | API has `/email/events` endpoints, no frontend |
| Multi-guardian enrollment | API supports it, frontend only sends one guardian |
| Password strength enforcement | 8-char minimum only, no complexity requirements |
| PATCH `/auth/me` | Users cannot update their own profile or phone number |
| `packages/` shared module | Monorepo structure exists, shared constants/schemas duplicated between API and web |
| Staff photo/avatar upload | No endpoint or UI wired up |
| Notifications page | `QUEUE_NAMES.NOTIFICATION` defined but no route or page |
| Report card PDF download | Generated but not downloadable from the UI |
| PATCH `/auth/me` (self-profile edit) | Users cannot update their own name or phone |

---

## What Should Be Removed

- **`Student.routeId`** at the model root level — duplicate transport field. The model has `routeId` at root AND `transportAssignment.routeId` nested. Pick one; the other is a ticking data integrity bug.
- **The `children` array on the Fees nav item** — either render it or remove it. Right now it is dead config that confuses future developers.
- **`buildAuthUser`'s triple `typeof` guard chain** in `auth.controller.js` — fragile shape detection that should be cleaned up now that the data model is stable.
- The **`10mb` JSON body limit** on `express.json()` should be `1mb` globally, with specific upload routes allowing more.
- **`recharts`** is listed as a dependency in the web app but no chart usage was observed — likely unused dead weight.

---

## What Should Be Done Differently

| Area | Current Approach | Better Approach |
|---|---|---|
| Receipt numbers | `countDocuments` in pre-save hook | Atomic Redis `INCR` keyed `schoolId:receipt:YEAR` |
| Report card generation | JS-side grouping in Node.js memory | MongoDB aggregation pipeline |
| Finance dashboard totals | Fetch 120 payments, aggregate in JS | Server-side aggregation endpoint |
| CBC grading logic | Duplicated in API and web | Extract to `packages/shared` |
| Role/enum constants | Duplicated in API and web | Extract to `packages/shared` |
| Global rate limiting | Missing (only auth routes limited) | Add `express-rate-limit` globally before routes |
| JWT refresh | None — hard 24h expiry | Sliding session: re-issue JWT on `/auth/me` hit |
| Frontend error handling | Most queries skip `isError` | Handle `isError` on every `useQuery` |
| Dashboard architecture | One giant role-branching client component | Split into `/dashboard/admin`, `/dashboard/teacher`, `/dashboard/finance` |
| Sidebar sub-navigation | Defined in config but never rendered | Implement collapsible nav groups in the Sidebar component |
| Validation errors | Returns only first error | Return all field errors as an array |
| CSV import parser | Naive `split(',')` — breaks on quoted fields | Use a proper CSV parsing library (e.g., `papaparse`) |
| `db.js` / `redis.js` logging | Raw `console.*` calls | Use the Winston logger used everywhere else |

---

## Would It Sell? — Honest Assessment

**As a demo: Yes, with caveats.** The core flows work. Enrollment, attendance, exams, results, fees collection, report cards — these are present and functional. The design is clean enough to not embarrass a sales pitch.

**As a production product at > KES 100/student/month: Not yet.** Three things would stop a paying school in week one:

1. **The receipt number race condition.** A busy school running a fee collection drive (200 parents paying simultaneously) will produce duplicate receipt numbers. This is a financial compliance issue.
2. **No M-Pesa integration.** Every Kenyan school expects M-Pesa. "We will add it later" is a deal-breaker when competitors have it.
3. **No push/in-app notifications.** A school admin has no way to know when a BullMQ job (report card generation, CSV import) completes except by refreshing the page.

**After fixing those three and the UX gaps above: 8/10 market-readiness.** The infrastructure bones are good — multi-tenancy, Redis caching, BullMQ jobs, Cloudinary, dual email providers, per-school rate limiting. These are architecture choices that hold up at scale. The problem is the product surface is incomplete, not that the foundation is wrong.

---

## Priority Fix List

### Do now (before any paying school goes live)

1. Fix receipt number race condition → Redis atomic counter (`INCR` keyed by `schoolId:receipt:YEAR`)
2. Add global IP-level rate limit via `express-rate-limit` before all route handlers
3. Fix `isError` handling on all `useQuery` calls — never show a silent empty table
4. Implement JWT refresh / sliding session (re-issue on `/auth/me`)
5. Render the Fees sidebar sub-navigation in the `Sidebar` component

### Do before first paid demo

6. M-Pesa STK push integration (Safaricom Daraja API)
7. In-app notification UI and `/notifications` API endpoint
8. Student photo upload (endpoint + form — Cloudinary already configured)
9. PDF report card download/preview page
10. Breadcrumb navigation across all dashboard pages

### Do before scaling

11. Move report card generation to a MongoDB aggregation pipeline
12. Move finance dashboard totals server-side
13. Extract shared constants, enums, and Zod schemas to `packages/shared`
14. Add Playwright e2e tests for the web app (currently zero tests exist)
15. Implement the `PLAN_FEATURE_MAP` tiers before the paid tier launches

---

## Full Technical Findings — API Backend

### Authentication & Authorization

**Strengths:**
- JWT stored in HTTP-only cookies with `SameSite: strict` in production
- Cookie domain derived from `CLIENT_URL` — shared correctly across subdomains
- `protect` middleware verifies JWT, checks `isActive`, checks school subscription status (Redis-cached)
- `blockIfMustChangePassword` enforced on all protected routes except `change-password`
- `authorize(...roles)` is composable and used consistently per route
- Password reset and invite tokens stored as SHA-256 hashes — never raw in DB
- Forgot-password always returns 200 regardless of email existence — prevents user enumeration

**Issues:**
- `adminOnly` in `middleware/auth.js` hardcodes role strings as a literal array instead of importing `ADMIN_ROLES` from constants — silent divergence risk if constants change
- Token JWT expiry is hardcoded to `1d` with no refresh token mechanism
- No token rotation or refresh token endpoint

### Multi-Tenancy

**Strengths:**
- Every document carries `schoolId`; every query filters on `req.user.schoolId`
- Subscription status validated on every request via Redis cache
- Per-school Redis rate limiting (300 req/min configurable)
- Superadmin correctly excluded from school-scoped checks

**Issues:**
- Receipt number generation in `Payment.model.js` uses `countDocuments({ schoolId })` in a pre-save hook — race condition (see Critical Issues)

### Database / ODM

**Strengths:**
- Compound indexes match real query shapes
- Mongoose sessions and transactions used correctly for registration and enrollment
- `lean()` used on read-heavy aggregations
- `Promise.all` for parallel dashboard queries

**Issues:**
- `Student.model.js` has `routeId` at root AND `transportAssignment.routeId` nested — duplicate, inconsistent
- `AuditLog` TTL index mentioned in a comment but not implemented — unbounded growth
- No archival strategy for old academic year data

### Error Handling

**Strengths:**
- `asyncHandler` eliminates try/catch boilerplate
- Global error handler normalizes Mongoose errors, CastErrors, duplicate key (11000), JWT errors
- `sendSuccess` / `sendError` / `sendNotFound` helpers enforce consistent response shape
- 5xx errors logged with full context; never leaks stack traces to the client

**Issues:**
- Error response shape is inconsistent: success uses `{ status: 'success', ...data }` but errors use `{ message: '...' }` (no `status` field)
- The 429 rate limit response in `auth.js` directly calls `res.status(429).json(...)` — deviates from standard helpers
- CSRF rejection adds `success: false` which no other error response has

### Validation

**Strengths:**
- Zod used consistently across all feature validators
- Request body replaced with `result.data` (parsed/sanitized) before reaching controller
- Kenyan phone number format enforced with regex

**Issues:**
- `validate` factory returns only the first error — multi-field forms require multiple round-trips
- `req.query` values passed directly into filter objects without ObjectId validation — `CastError` exceptions instead of clean 400s
- CSV import uses naive `split(',')` — breaks on quoted/comma-containing fields

### Security

| Check | Status |
|---|---|
| Helmet | ✅ Applied |
| CORS allowlist | ✅ Applied |
| CSRF Origin/Referer check | ✅ Applied |
| HTTP-only cookies | ✅ Applied |
| Rate limiting on auth routes | ✅ Applied |
| Per-school Redis rate limit | ✅ Applied |
| Global IP-level rate limit | ❌ Missing |
| Input validation (Zod) | ✅ Applied |
| Password hashing (bcrypt) | ✅ Applied |
| Reset tokens stored as hash | ✅ Applied |
| XSS sanitization | ❌ Not applied |
| MongoDB query injection guard | ⚠️ Partial |
| JWT refresh mechanism | ❌ Missing |
| Receipt number uniqueness | ❌ Race condition |

### Missing API Endpoints

- No refresh token endpoint
- No `PATCH /auth/me` — users cannot update their own profile
- No photo upload endpoint for students or staff
- No `/notifications` endpoint despite `QUEUE_NAMES.NOTIFICATION` being defined
- No M-Pesa STK push or webhook endpoint
- No endpoint to bulk-archive old academic year data
- Worker process has no `/health` endpoint of its own

### Code Quality Issues

- `students.controller.js` is 637 lines — guardian management logic in `updateStudent` is ~90 lines of nested loops
- `report-cards.controller.js` is 644 lines
- `enrollStudent` and `updateStudent` contain nearly identical "create parent user + send invite" logic (~50 lines duplicated)
- `PLAN_FEATURE_MAP` has 3 `TODO` entries — all tiers get all features; `requireFeature` is effectively a no-op
- `schoolRoutes` mixes school-admin and superadmin routes in the same file; superadmin access guarded at controller level only

---

## Full Technical Findings — Web Frontend

### Framework

- Next.js 15.3 with React 19, App Router exclusively
- Route groups: `(auth)`, `(dashboard)`, `(parent)`, `(superadmin)`
- `'use client'` used correctly on interactive pages; layouts are server components

### State Management

- Zustand 5 for auth state with `persist` middleware (localStorage)
- TanStack Query (React Query 5) for all server state
- `useAuth` has dual state sources (Zustand + React Query) which can briefly disagree
- Stale Zustand user returned on network failure even if account is deactivated server-side

### Authentication Flow

**Strengths:**
- Edge middleware guards all routes, redirects unauthenticated users
- `useLogout` clears Zustand, QueryClient cache, and redirects to `/login`
- Axios interceptor handles 401 with redirect to `/login`

**Issues:**
- Middleware checks cookie *existence* only — expired cookie passes through, causing a page flash before redirect
- Zustand user persists for up to 5 minutes after server-side deactivation (`staleTime: 5 * 60 * 1000`)

### Components

**Strengths:**
- Shared `DataTable`, `EmptyState`, `PageHeader`, `StatCard` reused across pages
- `DataTable` supports server-side pagination via TanStack Table
- Skeleton loading states implemented

**Issues:**
- CBC grading logic duplicated in the frontend (`exams/[id]/page.jsx`) — reimplements the same thresholds as `api/src/utils/grading.js`
- The `children` nav items for Fees are never rendered by the `Sidebar` component
- `recharts` listed as a dependency but no chart usage observed

### Data Fetching

**Strengths:**
- TanStack Query used consistently
- `staleTime: 3 * 60 * 1000` globally configured
- `refetchOnWindowFocus: false` prevents tab-switch refetches
- Retry logic correctly skips on 401/403/404

**Issues:**
- `normalizeSuccessPayload` in `lib/api.js` uses a fragile heuristic to unwrap the API response envelope — will silently return wrong shapes on edge-case responses
- `FinanceOpsDashboard` fetches `limit: 120` payments for client-side aggregation — should be server-side
- Dashboard is one large client component branching on role — should be split

### Forms

**Strengths:**
- `react-hook-form` + Zod used consistently
- Client-side Zod schemas mirror server-side — consistent validation
- Submit button disabled during in-flight requests

**Issues:**
- Student enrollment form only captures one guardian (flat fields) despite API supporting `guardians[]` array
- Password validation is 8-char minimum only — no complexity requirements

### Missing Pages / Features

- No dedicated Results entry page — only accessible via `/exams/[id]`
- No Notifications page
- No Email Delivery log page
- No Student photo upload UI
- No Report card PDF download page
- No Teacher dashboard — teachers see admin layout with no admin stats

### UX Issues

- No breadcrumb navigation anywhere in the dashboard
- Fees sidebar sub-nav defined but not rendered
- Billing page has hardcoded pricing constants instead of calling `/pricing/calculate`
- No "unsaved changes" confirmation on form navigation away
- No confirmation on destructive form resets
- Footer link on landing page points to `href="#"` — dead link

### Mobile

- `DataTable` has no `overflow-x-auto` wrapper
- Exam results entry (table with inline inputs per student) unusable on mobile
- No mobile-first attendance flow despite this being the most frequent teacher action

---

## Cross-Cutting Concerns

### Duplicated Between Apps

The `packages/` directory exists but is empty. The following are defined separately in both API and web:

- CBC grading thresholds
- Role constants (`ADMIN_ROLES`, `TEACHER_ROLES`, etc.)
- Student/payment/attendance status enums
- Relationship enum (`mother`, `father`, `guardian`, `other`)

**Recommendation:** Create a `packages/shared` package with a barrel export for all of the above.

### Testing

| Area | Status |
|---|---|
| API — Auth, students, attendance, results, fees | ✅ Integration tests with `mongodb-memory-server` |
| API — Transport, library, timetable, admin, export | ❌ No tests |
| API — Grading utility, pagination, audit logger | ❌ No unit tests |
| API — Receipt number concurrency | ❌ No concurrency test |
| Web — Any tests | ❌ Zero test files |

### Logging

- Winston logger used correctly throughout API controllers
- `config/db.js` and `config/redis.js` use raw `console.*` — not captured by Winston in production
- No request ID or correlation ID — makes tracing a specific request across log lines impossible in production

---

*End of Report — Generated 2026-04-19*
