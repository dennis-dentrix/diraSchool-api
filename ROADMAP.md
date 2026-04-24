# DiraSchool — Product Roadmap & Technical Recommendations

**Last updated:** 2026-04-24  
**Overall readiness: 7.2 / 10**

The architecture is production-quality. The gaps are almost entirely surface-level — features that are fully built on the API side but not yet surfaced in the UI, plus a few data-integrity fixes.

---

## Table of Contents

1. [Quick Wins — Under 1 Hour Each](#1-quick-wins--under-1-hour-each)
2. [Before First Paid Demo](#2-before-first-paid-demo)
3. [Data Integrity Fixes](#3-data-integrity-fixes)
4. [Logic & Performance Improvements](#4-logic--performance-improvements)
5. [UI / UX Improvements](#5-ui--ux-improvements)
6. [Before Scaling](#6-before-scaling)
7. [Payment Gateway (Pesapal)](#7-payment-gateway-pesapal)
8. [End-to-End Feature Status](#8-end-to-end-feature-status)
9. [API Security Checklist](#9-api-security-checklist)
10. [Testing Gaps](#10-testing-gaps)

---

## 1. Quick Wins — Under 1 Hour Each

| # | Item | File | Notes |
|---|---|---|---|
| 1 | ✅ **Render Breadcrumbs in layout** | `apps/web/src/app/(dashboard)/layout.jsx` | Done — `Breadcrumbs` imported and rendered above `{children}`. |
| 2 | ✅ **Add Results to sidebar nav** | `apps/web/src/components/layout/nav-items.js` | Done — `/results` added between Exams and Report Cards. |
| 3 | ✅ **DataTable mobile overflow** | `apps/web/src/components/shared/data-table.jsx` | Already present — `overflow-x-auto` wrapper exists. |
| 4 | ✅ **AuditLog TTL index** | `apps/api/src/features/audit/AuditLog.model.js` | Done — TTL index expires entries after 1 year. |
| 5 | ✅ **Remove duplicate `Student.routeId`** | `apps/api/src/features/students/Student.model.js` | Done — root-level `routeId` removed; `transportAssignment.routeId` is canonical. |
| 6 | ✅ **Set Cloudinary env vars** | `apps/api/.env` | Done — keys already present in `.env`. |

---

## 2. Before First Paid Demo

### Student Photo Upload
- **Status:** Complete — API endpoint (`POST /students/:id/photo`), multer middleware, Cloudinary upload, and UI are all wired.
- **Blocker:** Cloudinary env vars (see Quick Win #6).

### Report Card PDF Download
- **Status:** Worker generates PDF → uploads to Cloudinary → saves `pdfUrl`. Frontend had no download button.
- **Fix applied:** PDF status card added to detail page with polling, Generate/Download/Retry buttons.

### In-app Notifications
- **Status:** Complete end-to-end. Backend (`Notification` model, controller, routes), `notifyUser()` helper called from all workers, and the notification bell in the header polls every 20 seconds.
- **No action needed.**

### Multi-Guardian Enrollment
- **Status:** ✅ Complete — form uses `useFieldArray` with "Add another guardian" button. Multiple guardians fully supported.

### `PATCH /auth/me` — Staff Profile Edit
- **Status:** ✅ Complete — endpoint added to auth controller/routes; "Edit Profile" modal added to the header user menu.

### Billing Page — Dynamic Pricing
- **Status:** `BASE_FEE = 7500` and `PER_STUDENT = 40` are hardcoded in `apps/web/src/app/(dashboard)/billing/page.jsx`. The `/pricing/calculate` endpoint exists.
- **Fix:** Replace the hardcoded constants with a `useQuery` call to `/pricing/calculate`. Prevents wrong numbers if pricing changes.

---

## 3. Data Integrity Fixes

### Receipt Number Race Condition
- **Status:** Fixed. Redis atomic `INCR` per `schoolId:year` replaces the old `countDocuments + 1` pattern.

### Duplicate Transport Field on Student
- `Student.routeId` (root level) and `Student.transportAssignment.routeId` (nested) can drift.
- Remove root-level `routeId`. `transportAssignment` is the canonical transport record.

### AuditLog Unbounded Growth
- Add a TTL index: documents older than 1 year auto-expire.
- Without this, a busy school generates thousands of log entries per day with no cleanup.

### Subscription Cache Invalidation
- The `protect` middleware caches school subscription status in Redis for 5 minutes.
- When a school is suspended from the admin panel, teachers can keep working for up to 5 minutes.
- **Fix:** Call `cacheDel(`school:sub:${schoolId}`)` inside the `suspendSchool` / `updateSubscriptionStatus` controller to invalidate immediately on status change.

---

## 4. Logic & Performance Improvements

### Report Card Generation — Concurrent Class Generation
- `generate-class` runs `buildReportCardPayload` per student **sequentially** in a loop.
- For a class of 40 students, this fires 40 serial MongoDB aggregations.
- **Fix:** Wrap with `Promise.all` + a concurrency limiter (`p-limit` at 5) to run 5 at a time.

### Finance Dashboard — Server-side Aggregation
- `FinanceOpsDashboard` fetches `limit: 120` payments and aggregates totals in JS on the client.
- **Fix:** Add an aggregation to the `/dashboard` endpoint that returns daily/monthly totals directly. Move the arithmetic to MongoDB.

### Duplicate Parent Account Creation Logic
- `enrollStudent` and `updateStudent` both contain ~50 lines of "create parent user + send invite" logic.
- **Fix:** Extract into a shared `ensureParentAccount(guardian, schoolId, session)` utility. Prevents silent divergence when one copy is updated and the other isn't.

### CSV Import Parser
- `apps/api/src/features/students/import.worker.js` uses naive `split(',')`.
- Any field containing a comma (e.g. `"Kamau, Jr."`) silently corrupts the row.
- **Fix:** Replace with `papaparse` or Node's built-in CSV parsing.

### Validation — Return All Errors
- The Zod `validate` factory returns only the first error per request.
- Multi-field forms require multiple round-trips to surface all problems.
- **Fix:** Collect `result.error.errors` into an array and return all of them in one response.

### `normalizeSuccessPayload` in `lib/api.js`
- Uses a fragile heuristic to unwrap the API response envelope.
- **Fix:** Enforce one shape (`{ status, data, meta }`) from `sendSuccess` across all controllers, then unwrap with a single pattern on the client.

---

## 5. UI / UX Improvements

### Navigation
- **Breadcrumbs:** Component built, never rendered. Add to layout.
- **Results in sidebar:** `/results` page exists, not in nav. Teachers need a direct path.
- **Fees sub-nav:** Fixed — Overview, Fee Structures, and Payments now expand when Fees is active.

### Mobile
- `DataTable` has no `overflow-x-auto` wrapper — wide tables break on phones.
- Attendance entry (most frequent teacher action) is a full-width grid — unusable on small screens. A "list mode" where you swipe through students one by one would be far better for touch.
- Exam results entry (inline inputs per student per subject) also needs a mobile-friendly alternative.

### Print / PDF
- `report-cards/[id]/print` page exists. Verify it uses `@media print` CSS to hide the sidebar/header, fits A4, and doesn't clip content. This is what a principal sees on parent-teacher day.
- Payment receipts have a print page (`fees/payments/[id]/print`) — verify same.

### Empty & Error States
- `isError` handling added to fees, subjects, students, classes pages.
- Ensure report card list page has an empty state that prompts the admin to generate report cards (not just an empty table).
- Library and transport pages should be audited for missing error states.

### Staff Photo / Avatar
- The `User` model likely has an avatar field (or could add one). Upload endpoint does not exist for staff.
- The header avatar shows initials only. A real photo would improve the product feel significantly.

---

## 6. Before Scaling

### Extract `packages/shared`
The `packages/` directory in the monorepo exists but is empty. The following are duplicated between API and web:
- CBC grading thresholds (`utils/grading.js` vs `exams/[id]/page.jsx`)
- Role constants (`ADMIN_ROLES`, etc.)
- Student / payment / attendance status enums
- Relationship enum (`mother`, `father`, `guardian`, `other`)

**Fix:** Create `packages/shared` with a barrel export. Both apps import from there. Prevents silent divergence when one copy is updated.

### MongoDB Connection Pool
Default `maxPoolSize: 5` in `connectDB`. Under multiple PM2 cluster processes on DigitalOcean this will queue up.
Increase to 20–50 depending on expected concurrent users.

### Cache Infrastructure — Actually Use It
✅ **Done.** `GET /classes` caches unfiltered admin queries for 10 min; `GET /subjects` caches unfiltered admin queries for 15 min. Both bust on any create/update/delete/assign mutation via `bustClassCache` / `bustSubjectCache`.

### Dashboard Architecture
The dashboard page is one large client component that branches on role and fires multiple queries.
Split into `/dashboard/admin`, `/dashboard/teacher`, `/dashboard/finance` so each loads only what it needs.

### Playwright e2e Tests
✅ **Done.** `e2e/flows.spec.js` covers all 4 core flows with a shared auth setup:
- Enrollment: login → enroll → verify in list
- Attendance: select class → mark students → submit
- Fee payment: record 2 payments → assert unique receipt numbers
- Report card: open card → generate PDF → assert queued status

### `PLAN_FEATURE_MAP` — Implement Tiers
All tiers currently get all features (`TODO` placeholders in `requireFeature`).
Implement before the paid tier launches to prevent free-tier users accessing paid features.

---

## 7. Payment Gateway (Pesapal)

The Pesapal service layer is complete. What's needed to go live:

### Environment Variables Required
```
PESAPAL_ENABLED=true
PESAPAL_ENV=sandbox            # change to "live" for production
PESAPAL_CONSUMER_KEY=...
PESAPAL_CONSUMER_SECRET=...
PESAPAL_NOTIFICATION_ID=...    # register IPN URL in Pesapal dashboard first
```

### IPN (Instant Payment Notification) URL
Pesapal calls back to your server when a payment completes. The webhook endpoint exists in the codebase.
- Must be a **publicly reachable URL** (your DigitalOcean Droplet domain/IP, not localhost)
- Register it in the Pesapal Merchant Dashboard to get the `PESAPAL_NOTIFICATION_ID`

### Frontend Wiring Needed
- `billing/page.jsx` needs a "Subscribe" button that calls the subscription initiate endpoint
- The initiate endpoint returns a `redirectUrl` — redirect the browser there for Pesapal's hosted checkout
- On return, poll `/subscriptions/status` to confirm payment completed

### M-Pesa (Safaricom Daraja)
Not yet implemented. Every Kenyan school expects M-Pesa. Add STK Push (Lipa Na M-Pesa) as a payment method for fee collection. This is the single largest competitive gap versus alternatives.

---

## 8. End-to-End Feature Status

| Feature | API | Frontend | Complete? |
|---|---|---|---|
| School registration + email verify | ✅ | ✅ | ✅ |
| Staff invitation + onboarding | ✅ | ✅ | ✅ |
| Student enrollment | ✅ | ✅ | ✅ (single guardian only) |
| Student photo upload | ✅ | ✅ | ✅ (needs Cloudinary keys) |
| Class management | ✅ | ✅ | ✅ |
| Attendance entry | ✅ | ✅ | ✅ |
| Exams + Results entry | ✅ | ✅ | ✅ |
| Report card generation | ✅ | ✅ | ✅ |
| Report card PDF (generate + download) | ✅ | ✅ | ✅ (needs Cloudinary keys) |
| Fee structures | ✅ | ✅ | ✅ |
| Fee payment recording | ✅ | ✅ | ✅ |
| Payment receipt print | ✅ | ✅ | ✅ |
| In-app notifications | ✅ | ✅ | ✅ |
| Timetable | ✅ | ✅ | ✅ |
| Library | ✅ | ✅ | ✅ |
| Transport | ✅ | ✅ | ✅ |
| Audit logs | ✅ | ✅ | ✅ |
| Settings + school branding | ✅ | ✅ | ✅ |
| Parent portal | ✅ | ✅ | ✅ |
| Billing / subscription | ✅ | ⚠️ | Hardcoded pricing, no Pesapal CTA |
| Multi-guardian enrollment | ✅ | ✅ | Full multi-guardian form with add/remove |
| Staff profile edit (`/auth/me`) | ✅ | ✅ | Endpoint + header Edit Profile modal |
| Results direct page (sidebar nav) | ✅ | ✅ | Added to nav between Exams and Report Cards |
| Breadcrumb navigation | ✅ | ✅ | Rendered in dashboard layout |
| M-Pesa STK Push | ❌ | ❌ | Not implemented |
| Email delivery log page | ✅ | ❌ | API exists, no frontend |

---

## 9. API Security Checklist

| Check | Status |
|---|---|
| Helmet | ✅ |
| CORS allowlist | ✅ |
| CSRF Origin/Referer check | ✅ |
| HTTP-only cookies | ✅ |
| Rate limiting on auth routes (20/15 min) | ✅ |
| Per-school Redis rate limit (300 req/min) | ✅ |
| Global IP rate limit (200 req/min) | ✅ Fixed |
| Input validation (Zod) | ✅ |
| Password hashing (bcrypt) | ✅ |
| Reset tokens stored as SHA-256 hash | ✅ |
| JWT sliding session | ✅ Fixed |
| Receipt number uniqueness | ✅ Fixed (Redis INCR) |
| XSS sanitization | ❌ Not applied |
| MongoDB query injection guard | ⚠️ Partial |

---

## 10. Testing Gaps

| Area | Status |
|---|---|
| API — Auth, students, attendance, results, fees | ✅ Integration tests |
| API — Transport, library, timetable, admin, export | ❌ No tests |
| API — Grading utility, pagination, audit logger | ❌ No unit tests |
| API — Receipt number concurrency | ❌ No concurrency test |
| API — Report card PDF generation | ❌ No integration test |
| Web — Any tests | ❌ Zero test files |

**Recommended first web tests (Playwright):**
1. Full enrollment flow — login → enroll student → verify in list
2. Attendance entry — mark class, submit, verify register
3. Fee payment — record payment → verify receipt number is unique
4. Report card — generate → add remarks → publish → verify PDF queued

---

*This document replaces QA_REPORT.md. Update as features ship.*
