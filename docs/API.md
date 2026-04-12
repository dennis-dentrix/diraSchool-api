# Diraschool API Documentation

**Version:** 1.0  
**Base URL (Production):** `https://diraschool-api-production.up.railway.app`  
**Base URL (Local):** `http://localhost:3000`  
**API Prefix:** `/api/v1`

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Response Format](#response-format)
4. [Error Codes](#error-codes)
5. [Pagination](#pagination)
6. [Rate Limiting](#rate-limiting)
7. [Roles & Permissions](#roles--permissions)
8. [Enumerations](#enumerations)
9. [Endpoints](#endpoints)
   - [Health Check](#health-check)
   - [Auth](#auth)
   - [Users (Staff)](#users-staff)
   - [Schools](#schools)
   - [Classes](#classes)
   - [Students](#students)
   - [Subjects](#subjects)
   - [Attendance](#attendance)
   - [Exams](#exams)
   - [Results](#results)
   - [Fees](#fees)
   - [Report Cards](#report-cards)
   - [Timetable](#timetable)
   - [Library](#library)
   - [Transport](#transport)
   - [Settings](#settings)
   - [Audit Logs](#audit-logs)
   - [Parent Portal](#parent-portal)

---

## Overview

Diraschool is a multi-tenant CBC school management SaaS. Every resource (students, classes, users, fees, etc.) is scoped to a `schoolId`. A user's `schoolId` is embedded in their JWT cookie — there is no need to pass it explicitly in request bodies.

**Multi-tenancy rule:** All data operations are automatically filtered to the authenticated user's school. Cross-school access returns `404` (not `403`) to prevent information leakage.

---

## Authentication

Authentication uses **httpOnly cookies**. The server sets a `token` cookie on login/register — no manual token management is required. Postman and browsers handle this automatically.

### Cookie Details

| Property | Value |
|---|---|
| Name | `token` |
| Type | HttpOnly, SameSite=Strict |
| Lifetime | Matches `JWT_EXPIRES_IN` (default: `1d`) |
| Transport | Sent automatically on every request |

### How it works

1. Call `POST /api/v1/auth/login` (or `/register`)
2. The server sets the `token` cookie — do **not** store the token manually
3. All subsequent requests automatically include the cookie
4. Call `POST /api/v1/auth/logout` to clear the cookie

---

## Response Format

All responses follow a consistent shape.

### Success Response
```json
{
  "status": "success",
  "<resource>": { ... }
}
```
Data fields are spread at the top level alongside `status` — there is **no** wrapping `data` key.

### Error Response
```json
{
  "message": "Human-readable error description"
}
```

### Paginated Success Response
```json
{
  "status": "success",
  "<resources>": [ ... ],
  "meta": {
    "total": 47,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

---

## Error Codes

| Code | Meaning |
|---|---|
| `400` | Bad request — validation failure, invalid body |
| `401` | Not authenticated — missing or expired cookie |
| `403` | Forbidden — authenticated but insufficient role/plan |
| `404` | Resource not found (or cross-school access attempt) |
| `409` | Conflict — duplicate unique field (e.g. email, admission number) |
| `429` | Rate limit exceeded |
| `500` | Internal server error |

---

## Pagination

All list endpoints support optional query parameters:

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | Page number (1-indexed) |
| `limit` | integer | `20` | Items per page (max `100`) |

The response includes a `meta` object with `total`, `page`, `limit`, and `totalPages`.

---

## Rate Limiting

Authentication endpoints (`/auth/*`) are rate-limited to **20 requests per 15 minutes** per IP.

When exceeded:
```json
{ "message": "Too many attempts. Please try again in 15 minutes." }
```

---

## Roles & Permissions

### Role Hierarchy

| Role | Scope | Description |
|---|---|---|
| `superadmin` | Global | Platform admin — manages schools and subscriptions |
| `school_admin` | School | Full access to all school data |
| `director` | School | Full admin access |
| `headteacher` | School | Full admin access |
| `deputy_headteacher` | School | Full admin access |
| `secretary` | School | Admin access |
| `accountant` | School | Admin access (fees focus) |
| `teacher` | School | Limited — own class data only |
| `parent` | School | Read-only — own children only |

**Admin roles** (have full school management access):  
`school_admin`, `director`, `headteacher`, `deputy_headteacher`

### Middleware Layers

| Middleware | Description |
|---|---|
| `protect` | Validates JWT cookie — required on all protected routes |
| `blockIfMustChangePassword` | Blocks access until password is changed (except `/auth/change-password`) |
| `adminOnly` | Requires one of the admin roles |
| `superadminOnly` | Requires `superadmin` role |
| `authorize(...roles)` | Requires one of the listed roles |
| `requireFeature(feature)` | Checks school subscription plan includes the feature |

---

## Enumerations

### Roles
`superadmin` · `school_admin` · `director` · `headteacher` · `deputy_headteacher` · `secretary` · `accountant` · `teacher` · `parent`

### Assignable Roles (via POST /users)
`director` · `headteacher` · `deputy_headteacher` · `secretary` · `accountant` · `teacher` · `parent`

### Terms
`Term 1` · `Term 2` · `Term 3`

### CBC Level Categories
| Value | Grades | Grading |
|---|---|---|
| `Pre-Primary` | PP1–PP2 | Observation only |
| `Lower Primary` | Grade 1–3 | 4-level rubric (EE/ME/AE/BE) |
| `Upper Primary` | Grade 4–6 | 4-level rubric (EE/ME/AE/BE) |
| `Junior Secondary` | Grade 7–9 | 8-point scale (EE1–BE2) |
| `Senior School` | Grade 10–12 | 8-point scale (EE1–BE2) |

### Exam Types
`opener` · `midterm` · `endterm` · `sba`

### Attendance Statuses
`present` · `absent` · `late` · `excused`

### Payment Methods
`cash` · `mpesa` · `bank`

### Student Statuses
`active` · `transferred` · `graduated` · `withdrawn`

### Subscription Statuses
`trial` · `active` · `suspended` · `expired`

### Plan Tiers
`trial` · `basic` · `standard` · `premium`

### Plan Features (Gated)
`report_cards` · `parent_portal` · `timetable` · `library` · `transport` · `bulk_import` · `audit_log` · `sms`

### Days of Week
`monday` · `tuesday` · `wednesday` · `thursday` · `friday` · `saturday` · `sunday`

### Borrower Types
`student` · `staff`

### Loan Statuses
`active` · `returned` · `overdue`

---

## Endpoints

---

## Health Check

### `GET /health`

No authentication required. Returns the live status of all backing services.

**Response `200`**
```json
{
  "status": "ok",
  "timestamp": "2026-04-12T10:00:00.000Z",
  "services": {
    "api": "up",
    "mongodb": "up",
    "redis": "up"
  }
}
```

> Redis `status` values: `up` · `connecting` · `reconnecting` · `degraded`  
> The API always returns HTTP 200 — Redis degraded state does not cause a restart.

---

## Auth

**Base path:** `/api/v1/auth`  
Rate limit: 20 req / 15 min on public endpoints

---

### `POST /api/v1/auth/register`

Register a new school and create the school admin account. Sets auth cookie on success.

**Auth required:** No

**Request Body**

| Field | Type | Required | Rules |
|---|---|---|---|
| `schoolName` | string | ✅ | min 2 chars |
| `schoolEmail` | string | ✅ | valid email |
| `schoolPhone` | string | ✅ | Kenyan format (`+254`/`07`/`01`) |
| `county` | string | ✅ | min 2 chars |
| `firstName` | string | ✅ | admin first name |
| `lastName` | string | ✅ | admin last name |
| `email` | string | ✅ | admin email, valid format |
| `password` | string | ✅ | min 8 chars |
| `phone` | string | ✅ | Kenyan phone format |

```json
{
  "schoolName":  "Sunrise Academy",
  "schoolEmail": "info@sunrise.ac.ke",
  "schoolPhone": "+254700000001",
  "county":      "Nairobi",
  "firstName":   "John",
  "lastName":    "Kamau",
  "email":       "john@sunrise.ac.ke",
  "password":    "Admin@1234!",
  "phone":       "+254700000002"
}
```

**Response `201`**
```json
{
  "status":  "success",
  "school":  { "_id": "...", "name": "Sunrise Academy", "email": "info@sunrise.ac.ke", "planTier": "trial", ... },
  "user":    { "_id": "...", "firstName": "John", "lastName": "Kamau", "email": "john@sunrise.ac.ke", "role": "school_admin", ... }
}
```

> Sets `token` httpOnly cookie. Trial period: 30 days.

---

### `POST /api/v1/auth/login`

**Auth required:** No

**Request Body**

| Field | Type | Required | Rules |
|---|---|---|---|
| `email` | string | ✅ | valid email |
| `password` | string | ✅ | min 1 char |

```json
{
  "email":    "john@sunrise.ac.ke",
  "password": "Admin@1234!"
}
```

**Response `200`**
```json
{
  "status": "success",
  "user": {
    "_id":              "abc123",
    "firstName":        "John",
    "lastName":         "Kamau",
    "email":            "john@sunrise.ac.ke",
    "role":             "school_admin",
    "schoolId":         "xyz789",
    "mustChangePassword": false,
    "invitePending":    false,
    "isActive":         true,
    "lastLoginAt":      "2026-04-12T09:00:00.000Z"
  }
}
```

**Errors**

| Code | Condition |
|---|---|
| `401` | Wrong email or password |
| `403` | Account inactive |
| `403` | `invitePending: true` — user must accept email invite first |

---

### `POST /api/v1/auth/logout`

**Auth required:** Yes  
Clears the `token` cookie.

**Response `200`**
```json
{ "status": "success", "message": "Logged out successfully." }
```

---

### `GET /api/v1/auth/me`

**Auth required:** Yes (not blocked by `mustChangePassword`)

Returns the authenticated user's profile.

**Response `200`**
```json
{
  "status": "success",
  "user": { "_id": "...", "firstName": "John", "role": "school_admin", ... }
}
```

---

### `POST /api/v1/auth/change-password`

**Auth required:** Yes — accessible even when `mustChangePassword = true`

**Request Body**

| Field | Type | Required | Rules |
|---|---|---|---|
| `currentPassword` | string | ✅ | existing password |
| `newPassword` | string | ✅ | min 8 chars |

```json
{
  "currentPassword": "OldPass123!",
  "newPassword":     "NewPass456!"
}
```

**Response `200`**
```json
{ "status": "success", "message": "Password changed successfully." }
```

> Clears `mustChangePassword`. Sets a new cookie (refreshes session).

**Errors**

| Code | Condition |
|---|---|
| `400` | Current password is wrong |
| `400` | New password too short |

---

### `POST /api/v1/auth/forgot-password`

**Auth required:** No  
Sends a password reset link to the user's email via Resend.

**Request Body**

| Field | Type | Required |
|---|---|---|
| `email` | string | ✅ |

```json
{ "email": "john@sunrise.ac.ke" }
```

**Response `200`** (always 200 — no user enumeration)
```json
{
  "status":  "success",
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

> The reset link is: `{CLIENT_URL}/reset-password?token={rawToken}`  
> Token expires in **1 hour**.

---

### `POST /api/v1/auth/reset-password/:token`

**Auth required:** No

**URL Parameter:** `token` — the raw token from the email link

**Request Body**

| Field | Type | Required | Rules |
|---|---|---|---|
| `password` | string | ✅ | min 8 chars |

```json
{ "password": "NewSecurePass123!" }
```

**Response `200`**
```json
{
  "status":  "success",
  "message": "Password reset successfully. You are now logged in.",
  "user":    { ... }
}
```

> Sets auth cookie (auto-logs user in). Token is single-use.

**Errors**

| Code | Condition |
|---|---|
| `400` | Token invalid or expired |
| `400` | Password too short |

---

### `POST /api/v1/auth/accept-invite/:token`

**Auth required:** No  
Called when a newly created staff member clicks their email invite link to set their password.

**URL Parameter:** `token` — raw invite token from the email link

**Request Body**

| Field | Type | Required | Rules |
|---|---|---|---|
| `password` | string | ✅ | min 8 chars |

```json
{ "password": "MyNewPassword1!" }
```

**Response `200`**
```json
{
  "status":  "success",
  "message": "Your account is set up. Welcome!",
  "user":    { "_id": "...", "firstName": "Grace", "role": "teacher", ... }
}
```

> Sets auth cookie (auto-logs user in). Clears `invitePending` flag. Invite token is invalidated.

**Errors**

| Code | Condition |
|---|---|
| `400` | Token invalid, expired (7-day window), or already used |
| `400` | Password too short |

---

## Users (Staff)

**Base path:** `/api/v1/users`  
**Auth:** Required — admin roles only (`school_admin`, `director`, `headteacher`, `deputy_headteacher`)

All users are scoped to the authenticated admin's school.

---

### `POST /api/v1/users`

Create a new staff account. An invite email is sent to the new user. The account is locked (`invitePending: true`) until they accept the invite and set their own password.

**Request Body**

| Field | Type | Required | Rules |
|---|---|---|---|
| `firstName` | string | ✅ | min 1 char |
| `lastName` | string | ✅ | min 1 char |
| `email` | string | ✅ | valid email |
| `role` | string | ✅ | see assignable roles |
| `phone` | string | — | Kenyan phone format |
| `staffId` | string | — | internal staff ID |
| `tscNumber` | string | — | TSC registration number (teachers) |

```json
{
  "firstName": "Grace",
  "lastName":  "Wanjiku",
  "email":     "grace@sunrise.ac.ke",
  "role":      "teacher",
  "phone":     "0712345678",
  "staffId":   "TSR/2024/001",
  "tscNumber": "TSC123456"
}
```

**Response `201`**
```json
{
  "status": "success",
  "user": {
    "_id":          "...",
    "firstName":    "Grace",
    "lastName":     "Wanjiku",
    "email":        "grace@sunrise.ac.ke",
    "role":         "teacher",
    "phone":        "+254712345678",
    "staffId":      "TSR/2024/001",
    "tscNumber":    "TSC123456",
    "schoolId":     "...",
    "invitePending": true,
    "mustChangePassword": false,
    "isActive":     true,
    "createdAt":    "2026-04-12T10:00:00.000Z"
  },
  "message": "Invitation email sent to grace@sunrise.ac.ke. They must accept it before they can log in."
}
```

**Errors**

| Code | Condition |
|---|---|
| `400` | Missing required fields, invalid role, invalid phone |
| `409` | Email already exists in this school |

---

### `GET /api/v1/users`

List all staff users in the school.

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `role` | string | Filter by role (e.g. `teacher`) |
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Items per page (default: 20) |

**Response `200`**
```json
{
  "status": "success",
  "users": [ { "_id": "...", "firstName": "Grace", "role": "teacher", ... } ],
  "meta": { "total": 12, "page": 1, "limit": 20, "totalPages": 1 }
}
```

---

### `GET /api/v1/users/:id`

Get a single staff user by ID.

**Response `200`**
```json
{
  "status": "success",
  "user": { "_id": "...", "firstName": "Grace", "lastName": "Wanjiku", "role": "teacher", ... }
}
```

---

### `PATCH /api/v1/users/:id`

Update a staff user. Cannot update yourself via this endpoint (use `/auth/change-password`).

**Request Body** (all fields optional)

| Field | Type | Rules |
|---|---|---|
| `firstName` | string | min 1 char |
| `lastName` | string | min 1 char |
| `phone` | string | Kenyan phone format |
| `role` | string | assignable roles only |
| `isActive` | boolean | activate / deactivate account |
| `staffId` | string | — |
| `tscNumber` | string | — |

```json
{
  "firstName": "Grace",
  "isActive": false
}
```

**Response `200`**
```json
{ "status": "success", "user": { ... } }
```

---

### `POST /api/v1/users/:id/resend-invite`

Re-send the invitation email to a staff member. Generates a new 7-day token. Works for both pending invites and active users who need a new password reset link.

**Response `200`**
```json
{
  "status":  "success",
  "message": "Invitation email re-sent to grace@sunrise.ac.ke."
}
```

---

## Schools

**Base path:** `/api/v1/schools`  
**Auth:** Required

---

### `GET /api/v1/schools/me`

**Roles:** Admin roles  
Get the current school's profile.

**Response `200`**
```json
{
  "status": "success",
  "school": {
    "_id":                "...",
    "name":               "Sunrise Academy",
    "email":              "info@sunrise.ac.ke",
    "phone":              "+254700000001",
    "county":             "Nairobi",
    "registrationNumber": "MOE/123/2024",
    "address":            "123 Main St",
    "subscriptionStatus": "trial",
    "planTier":           "trial",
    "trialExpiry":        "2026-05-12T00:00:00.000Z",
    "isActive":           true
  }
}
```

---

### `PATCH /api/v1/schools/me`

**Roles:** Admin roles  
Update the current school's profile.

**Request Body** (all optional)

| Field | Type |
|---|---|
| `name` | string |
| `phone` | string |
| `county` | string |
| `registrationNumber` | string |
| `address` | string |

---

### `GET /api/v1/schools` *(superadmin only)*

List all schools on the platform.

**Query Parameters:** `page`, `limit`, `status` (subscription status filter)

---

### `POST /api/v1/schools` *(superadmin only)*

Create a school programmatically (without self-registration).

**Request Body** — same shape as the `/register` school fields.

---

### `GET /api/v1/schools/:id` *(superadmin only)*

Get any school by ID.

---

### `PATCH /api/v1/schools/:id` *(superadmin only)*

Update any school (name, email, phone, county, registrationNumber, address, isActive).

---

### `PATCH /api/v1/schools/:id/subscription` *(superadmin only)*

Update a school's subscription status and plan tier.

**Request Body**

| Field | Type | Rules |
|---|---|---|
| `subscriptionStatus` | string | `trial` · `active` · `suspended` · `expired` |
| `planTier` | string | `trial` · `basic` · `standard` · `premium` |
| `trialExpiry` | string (ISO date) | optional |

---

## Classes

**Base path:** `/api/v1/classes`  
**Auth:** Required — admin roles

---

### `POST /api/v1/classes`

**Request Body**

| Field | Type | Required | Rules |
|---|---|---|---|
| `name` | string | ✅ | e.g. "Grade 4" |
| `levelCategory` | string | ✅ | CBC level category enum |
| `academicYear` | string | ✅ | 4-digit year, e.g. `"2026"` |
| `term` | string | ✅ | `Term 1` · `Term 2` · `Term 3` |
| `stream` | string | — | e.g. "North", "A" |
| `classTeacherId` | string (ObjectId) | — | teacher user ID |

```json
{
  "name":          "Grade 4",
  "levelCategory": "Upper Primary",
  "academicYear":  "2026",
  "term":          "Term 1",
  "stream":        "North",
  "classTeacherId": "abc123"
}
```

**Response `201`**
```json
{
  "status": "success",
  "class": {
    "_id":           "...",
    "name":          "Grade 4",
    "stream":        "North",
    "levelCategory": "Upper Primary",
    "academicYear":  "2026",
    "term":          "Term 1",
    "classTeacherId": "abc123",
    "studentCount":  0,
    "isActive":      true
  }
}
```

---

### `GET /api/v1/classes`

List all classes in the school.

**Query Parameters:** `page`, `limit`, `academicYear`, `term`, `levelCategory`, `isActive`

---

### `GET /api/v1/classes/:id`

Get a single class.

---

### `PATCH /api/v1/classes/:id`

Update class fields (name, stream, classTeacherId, isActive). Academic year and term are immutable after creation.

---

### `DELETE /api/v1/classes/:id`

Delete a class. Fails if any students are assigned to it.

---

### `POST /api/v1/classes/:id/promote`

End-of-year bulk student promotion — moves all active students from this class to a target class.

**Request Body**

| Field | Type | Required |
|---|---|---|
| `targetClassId` | string (ObjectId) | ✅ |

```json
{ "targetClassId": "xyz789" }
```

**Response `200`**
```json
{
  "status":  "success",
  "message": "18 students promoted to Grade 5 North.",
  "count":   18
}
```

---

## Students

**Base path:** `/api/v1/students`  
**Auth:** Required — admin roles

---

### `POST /api/v1/students`

Enroll a new student.

**Request Body**

| Field | Type | Required | Rules |
|---|---|---|---|
| `firstName` | string | ✅ | — |
| `lastName` | string | ✅ | — |
| `admissionNumber` | string | ✅ | unique per school |
| `gender` | string | ✅ | `male` · `female` |
| `classId` | string (ObjectId) | ✅ | must belong to school |
| `dateOfBirth` | string (ISO date) | — | e.g. `"2015-03-12"` |
| `parentIds` | string[] | — | parent user IDs |

```json
{
  "firstName":       "Emma",
  "lastName":        "Njeri",
  "admissionNumber": "ADM2026001",
  "gender":          "female",
  "classId":         "abc123",
  "dateOfBirth":     "2015-03-12"
}
```

**Response `201`**
```json
{
  "status":  "success",
  "student": {
    "_id":             "...",
    "firstName":       "Emma",
    "lastName":        "Njeri",
    "admissionNumber": "ADM2026001",
    "gender":          "female",
    "classId":         "abc123",
    "status":          "active",
    "parentIds":       []
  }
}
```

---

### `GET /api/v1/students`

List students.

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `classId` | ObjectId | Filter by class |
| `status` | string | `active` · `transferred` · `graduated` · `withdrawn` |
| `page` | integer | — |
| `limit` | integer | — |

---

### `GET /api/v1/students/:id`

Get student details.

---

### `PATCH /api/v1/students/:id`

Update student info (name, dateOfBirth, parentIds, photo). `admissionNumber`, `gender`, `classId` cannot be changed via PATCH.

---

### `POST /api/v1/students/:id/transfer`

Transfer a student to a different class (same school).

**Request Body**

| Field | Type | Required |
|---|---|---|
| `targetClassId` | string (ObjectId) | ✅ |
| `transferNote` | string | — |

---

### `POST /api/v1/students/:id/withdraw`

Mark a student as withdrawn.

**Request Body** (optional)
```json
{ "note": "Family relocated" }
```

---

### `POST /api/v1/students/import` *(feature-gated: `bulk_import`)*

Bulk import students via CSV file upload.

**Content-Type:** `multipart/form-data`  
**Field:** `file` — `.csv` file

CSV columns: `firstName`, `lastName`, `admissionNumber`, `gender`, `classId`, `dateOfBirth` (optional)

**Response `202`**
```json
{ "status": "success", "jobId": "import-job-abc123" }
```

---

### `GET /api/v1/students/import/:jobId/status`

Poll the status of a bulk import job.

**Response `200`**
```json
{
  "status":   "success",
  "jobStatus": "completed",
  "progress":  { "total": 50, "processed": 50, "errors": 2 },
  "errors":    [ { "row": 5, "message": "Duplicate admission number" } ]
}
```

---

## Subjects

**Base path:** `/api/v1/subjects`  
**Auth:** Required — admin roles

---

### `POST /api/v1/subjects`

**Request Body**

| Field | Type | Required | Rules |
|---|---|---|---|
| `name` | string | ✅ | e.g. "Mathematics" |
| `classId` | string (ObjectId) | ✅ | must belong to school |
| `code` | string | — | e.g. "MATH" (uppercased) |
| `teacherId` | string (ObjectId) | — | assigned teacher |

```json
{
  "name":      "Mathematics",
  "classId":   "abc123",
  "code":      "MATH",
  "teacherId": "xyz789"
}
```

**Response `201`**
```json
{
  "status":  "success",
  "subject": { "_id": "...", "name": "Mathematics", "code": "MATH", "classId": "...", "isActive": true }
}
```

---

### `GET /api/v1/subjects`

**Query Parameters:** `classId` (filter), `page`, `limit`, `isActive`

---

### `GET /api/v1/subjects/:id`

---

### `PATCH /api/v1/subjects/:id`

Update name, code, or isActive.

---

### `DELETE /api/v1/subjects/:id`

---

### `PATCH /api/v1/subjects/:id/teacher`

Assign or unassign the teacher for a subject.

**Request Body**

| Field | Type | Description |
|---|---|---|
| `teacherId` | string (ObjectId) \| null | Pass `null` to unassign |

```json
{ "teacherId": "teacher-id-here" }
```

---

## Attendance

**Base path:** `/api/v1/attendance`  
**Auth:** Required — admin roles

---

### `POST /api/v1/attendance/registers`

Create a new daily attendance register.

**Request Body**

| Field | Type | Required | Rules |
|---|---|---|---|
| `classId` | string (ObjectId) | ✅ | — |
| `date` | string | ✅ | `YYYY-MM-DD` format |
| `entries` | array | — | attendance entry objects |
| `substituteTeacherId` | string (ObjectId) | — | — |
| `substituteNote` | string | — | max 300 chars |

**Entry Object:**

| Field | Type | Required | Rules |
|---|---|---|---|
| `studentId` | string (ObjectId) | ✅ | — |
| `status` | string | ✅ | `present` · `absent` · `late` · `excused` |
| `note` | string | — | max 300 chars |

```json
{
  "classId": "abc123",
  "date":    "2026-04-12",
  "entries": [
    { "studentId": "s1", "status": "present" },
    { "studentId": "s2", "status": "absent", "note": "Sick" }
  ]
}
```

**Response `201`**
```json
{
  "status":   "success",
  "register": {
    "_id":         "...",
    "classId":     "abc123",
    "date":        "2026-04-12T00:00:00.000Z",
    "academicYear":"2026",
    "term":        "Term 1",
    "status":      "draft",
    "entries":     [ ... ],
    "takenByUserId": "...",
    "isSubstitute": false
  }
}
```

> **Note:** `academicYear` and `term` are derived automatically from the school's settings.

---

### `GET /api/v1/attendance/registers`

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `classId` | ObjectId | Filter by class |
| `date` | string (YYYY-MM-DD) | Filter by exact date |
| `startDate` | string (YYYY-MM-DD) | Date range start |
| `endDate` | string (YYYY-MM-DD) | Date range end |
| `status` | string | `draft` · `submitted` |
| `page` | integer | — |
| `limit` | integer | — |

---

### `GET /api/v1/attendance/registers/:id`

---

### `PATCH /api/v1/attendance/registers/:id`

Update entries or substitute info. Only works on `draft` registers.

**Request Body** (all optional)

| Field | Type |
|---|---|
| `entries` | array of entry objects |
| `substituteTeacherId` | string (ObjectId) \| null |
| `substituteNote` | string \| null |

---

### `POST /api/v1/attendance/registers/:id/submit`

Submit (lock) a draft register. Submitted registers cannot be edited.

**Response `200`**
```json
{
  "status":   "success",
  "register": { "...", "status": "submitted", "submittedAt": "2026-04-12T10:30:00.000Z" }
}
```

---

## Exams

**Base path:** `/api/v1/exams`  
**Auth:** Required — admin roles

---

### `POST /api/v1/exams`

**Request Body**

| Field | Type | Required | Rules |
|---|---|---|---|
| `name` | string | ✅ | e.g. "Midterm Mathematics" |
| `classId` | string (ObjectId) | ✅ | — |
| `subjectId` | string (ObjectId) | ✅ | — |
| `type` | string | ✅ | `opener` · `midterm` · `endterm` · `sba` |
| `term` | string | ✅ | `Term 1` · `Term 2` · `Term 3` |
| `academicYear` | string | ✅ | 4-digit year |
| `levelCategory` | string | ✅ | CBC level category |
| `totalMarks` | number | ✅ | min 1 |

```json
{
  "name":          "Midterm Mathematics",
  "classId":       "class-id",
  "subjectId":     "subject-id",
  "type":          "midterm",
  "term":          "Term 1",
  "academicYear":  "2026",
  "levelCategory": "Upper Primary",
  "totalMarks":    100
}
```

**Response `201`**
```json
{
  "status": "success",
  "exam": { "_id": "...", "name": "Midterm Mathematics", "type": "midterm", "totalMarks": 100, "isPublished": false, ... }
}
```

---

### `GET /api/v1/exams`

**Query Parameters:** `classId`, `subjectId`, `term`, `academicYear`, `type`, `isPublished`, `page`, `limit`

---

### `GET /api/v1/exams/:id`

---

### `PATCH /api/v1/exams/:id`

Update name, totalMarks, or isPublished.

---

### `DELETE /api/v1/exams/:id`

Deletes the exam and all associated results.

---

## Results

**Base path:** `/api/v1/results`  
**Auth:** Required — admin roles

---

### `POST /api/v1/results/bulk`

Bulk create or update marks for an entire class. Uses upsert — safe to re-submit if marks change.

**Request Body**

| Field | Type | Required |
|---|---|---|
| `examId` | string (ObjectId) | ✅ |
| `results` | array of result objects | ✅ |

**Result Object:**

| Field | Type | Required | Rules |
|---|---|---|---|
| `studentId` | string (ObjectId) | ✅ | — |
| `marks` | number | ✅ | 0 – totalMarks |

```json
{
  "examId": "exam-id",
  "results": [
    { "studentId": "s1", "marks": 78 },
    { "studentId": "s2", "marks": 55 }
  ]
}
```

**Response `200`**
```json
{
  "status":  "success",
  "message": "30 result(s) saved.",
  "count":   30
}
```

> `percentage`, `grade`, and `points` are computed automatically based on the exam's `levelCategory`.

---

### `GET /api/v1/results`

**Query Parameters:** `examId`, `classId`, `studentId`, `term`, `academicYear`, `subjectId`, `page`, `limit`

---

### `GET /api/v1/results/:id`

---

### `PATCH /api/v1/results/:id`

Update a single result's marks.

**Request Body**
```json
{ "marks": 82 }
```

---

## Fees

**Base path:** `/api/v1/fees`  
**Auth:** Required — admin roles

---

### `POST /api/v1/fees/structures`

Create a fee structure for a class/term/year.

**Request Body**

| Field | Type | Required | Rules |
|---|---|---|---|
| `classId` | string (ObjectId) | ✅ | — |
| `academicYear` | string | ✅ | 4-digit year |
| `term` | string | ✅ | Term enum |
| `items` | array | ✅ | min 1 item |

**Item Object:**

| Field | Type | Required |
|---|---|---|
| `name` | string | ✅ |
| `amount` | number | ✅ (min 0) |

```json
{
  "classId":      "class-id",
  "academicYear": "2026",
  "term":         "Term 1",
  "items": [
    { "name": "Tuition",   "amount": 15000 },
    { "name": "Activity",  "amount": 2000 },
    { "name": "Transport", "amount": 3000 }
  ]
}
```

**Response `201`**
```json
{
  "status": "success",
  "feeStructure": {
    "_id":         "...",
    "classId":     "...",
    "academicYear":"2026",
    "term":        "Term 1",
    "items":       [ { "name": "Tuition", "amount": 15000 }, ... ],
    "totalAmount": 20000
  }
}
```

---

### `GET /api/v1/fees/structures`

**Query Parameters:** `classId`, `academicYear`, `term`, `page`, `limit`

---

### `GET /api/v1/fees/structures/:id`

---

### `PATCH /api/v1/fees/structures/:id`

Update fee items or amounts.

---

### `DELETE /api/v1/fees/structures/:id`

---

### `POST /api/v1/fees/payments`

Record a payment for a student.

**Request Body**

| Field | Type | Required | Rules |
|---|---|---|---|
| `studentId` | string (ObjectId) | ✅ | — |
| `classId` | string (ObjectId) | ✅ | — |
| `academicYear` | string | ✅ | 4-digit year |
| `term` | string | ✅ | Term enum |
| `amount` | number | ✅ | min 1 |
| `method` | string | ✅ | `cash` · `mpesa` · `bank` |
| `reference` | string | — | receipt/transaction number |
| `notes` | string | — | — |

```json
{
  "studentId":    "student-id",
  "classId":      "class-id",
  "academicYear": "2026",
  "term":         "Term 1",
  "amount":       15000,
  "method":       "mpesa",
  "reference":    "QJB8T2XPNQ"
}
```

**Response `201`**
```json
{
  "status":  "success",
  "payment": {
    "_id":            "...",
    "studentId":      "...",
    "amount":         15000,
    "method":         "mpesa",
    "reference":      "QJB8T2XPNQ",
    "status":         "completed",
    "recordedByUserId": "...",
    "receiptUrl":     null,
    "createdAt":      "2026-04-12T10:00:00.000Z"
  }
}
```

> A PDF receipt is generated asynchronously via BullMQ. `receiptUrl` is populated when ready.

---

### `GET /api/v1/fees/payments`

**Query Parameters:** `studentId`, `classId`, `academicYear`, `term`, `method`, `status`, `page`, `limit`

---

### `GET /api/v1/fees/payments/:id`

---

### `POST /api/v1/fees/payments/:id/reverse`

Reverse a completed payment.

**Request Body**

| Field | Type | Required |
|---|---|---|
| `reason` | string | ✅ |

```json
{ "reason": "Duplicate payment recorded in error" }
```

**Response `200`**
```json
{
  "status":  "success",
  "payment": { "...", "status": "reversed", "reversalReason": "...", "reversedAt": "..." }
}
```

---

### `GET /api/v1/fees/balance`

Get the outstanding balance for a student in a term.

**Query Parameters**

| Param | Type | Required |
|---|---|---|
| `studentId` | ObjectId | ✅ |
| `academicYear` | string | ✅ |
| `term` | string | ✅ |

**Response `200`**
```json
{
  "status": "success",
  "balance": {
    "studentId":      "...",
    "academicYear":   "2026",
    "term":           "Term 1",
    "totalFees":      20000,
    "totalPaid":      15000,
    "balance":        5000,
    "overpayment":    0
  }
}
```

---

## Report Cards

**Base path:** `/api/v1/report-cards`  
**Auth:** Required — admin roles  
**Feature gate:** `report_cards`

---

### `POST /api/v1/report-cards/generate`

Generate a report card for a single student for a given term.

**Request Body**

| Field | Type | Required |
|---|---|---|
| `studentId` | string (ObjectId) | ✅ |
| `classId` | string (ObjectId) | ✅ |
| `academicYear` | string | ✅ |
| `term` | string | ✅ |

```json
{
  "studentId":    "student-id",
  "classId":      "class-id",
  "academicYear": "2026",
  "term":         "Term 1"
}
```

**Response `201`**
```json
{
  "status":     "success",
  "reportCard": {
    "_id":          "...",
    "studentId":    "...",
    "classId":      "...",
    "academicYear": "2026",
    "term":         "Term 1",
    "levelCategory":"Upper Primary",
    "subjects": [
      {
        "subjectId":         "...",
        "subjectName":       "Mathematics",
        "subjectCode":       "MATH",
        "exams": [
          { "examName": "Midterm", "examType": "midterm", "marks": 78, "totalMarks": 100, "percentage": 78, "grade": "ME" }
        ],
        "averagePercentage": 78,
        "grade":             "ME",
        "points":            3,
        "teacherRemark":     null
      }
    ],
    "totalPoints":       18,
    "averagePoints":     3.0,
    "overallGrade":      "ME",
    "attendanceSummary": { "totalDays": 60, "present": 58, "absent": 1, "late": 1, "excused": 0 },
    "teacherRemarks":    null,
    "principalRemarks":  null,
    "status":            "draft"
  }
}
```

---

### `POST /api/v1/report-cards/generate-class`

Generate report cards for every student in a class in one call.

**Request Body**

| Field | Type | Required |
|---|---|---|
| `classId` | string (ObjectId) | ✅ |
| `academicYear` | string | ✅ |
| `term` | string | ✅ |

**Response `201`**
```json
{
  "status":  "success",
  "message": "Report cards generated for 28 students.",
  "count":   28
}
```

---

### `GET /api/v1/report-cards`

**Query Parameters:** `classId`, `studentId`, `academicYear`, `term`, `status` (`draft`·`published`), `page`, `limit`

---

### `GET /api/v1/report-cards/annual-summary`

Get a student's aggregated annual performance across all terms.

**Query Parameters:** `studentId` (required), `academicYear` (required)

---

### `GET /api/v1/report-cards/:id`

---

### `PATCH /api/v1/report-cards/:id/remarks`

Update teacher and principal remarks.

**Request Body**

| Field | Type |
|---|---|
| `teacherRemarks` | string |
| `principalRemarks` | string |

---

### `PATCH /api/v1/report-cards/:id/subjects/:subjectId/remark`

Update the teacher's per-subject remark for one student.

**Request Body**
```json
{ "teacherRemark": "Excellent performance in algebra." }
```

---

### `POST /api/v1/report-cards/:id/publish`

Publish a report card (status: `draft` → `published`). Published cards are visible to parents.

**Response `200`**
```json
{
  "status":     "success",
  "reportCard": { "...", "status": "published", "publishedAt": "2026-04-12T..." }
}
```

---

## Timetable

**Base path:** `/api/v1/timetables`  
**Auth:** Required  
**Feature gate:** `timetable`  
**Read access:** All school staff · **Write access:** Admin roles only

---

### `POST /api/v1/timetables`

Create a timetable for a class/term/year.

**Request Body**

| Field | Type | Required |
|---|---|---|
| `classId` | string (ObjectId) | ✅ |
| `academicYear` | string | ✅ |
| `term` | string | ✅ |

**Response `201`**
```json
{ "status": "success", "timetable": { "_id": "...", "classId": "...", "slots": [] } }
```

---

### `GET /api/v1/timetables`

**Query Parameters:** `classId`, `academicYear`, `term`, `page`, `limit`

---

### `GET /api/v1/timetables/:id`

---

### `PUT /api/v1/timetables/:id/slots`

Replace the entire slots array for a timetable.

**Request Body**

| Field | Type | Required |
|---|---|---|
| `slots` | array | ✅ |

**Slot Object:**

| Field | Type | Required | Rules |
|---|---|---|---|
| `day` | string | ✅ | day of week enum |
| `period` | number | ✅ | 1–12 |
| `startTime` | string | ✅ | `HH:MM` format |
| `endTime` | string | ✅ | `HH:MM` format |
| `subjectId` | string (ObjectId) | — | — |
| `teacherId` | string (ObjectId) | — | — |
| `room` | string | — | — |

```json
{
  "slots": [
    { "day": "monday", "period": 1, "startTime": "07:30", "endTime": "08:30", "subjectId": "...", "teacherId": "..." },
    { "day": "monday", "period": 2, "startTime": "08:30", "endTime": "09:30", "subjectId": "...", "teacherId": "..." }
  ]
}
```

---

### `DELETE /api/v1/timetables/:id`

---

## Library

**Base path:** `/api/v1/library`  
**Auth:** Required  
**Feature gate:** `library`

---

### `POST /api/v1/library/books` *(admin only)*

Add a book to the catalogue.

**Request Body**

| Field | Type | Required | Rules |
|---|---|---|---|
| `title` | string | ✅ | — |
| `totalCopies` | number | ✅ | min 1 |
| `author` | string | — | — |
| `isbn` | string | — | unique per school |
| `category` | string | — | e.g. `"Textbook"` |

```json
{
  "title":       "Mathematics Grade 4",
  "author":      "KLB Publishers",
  "isbn":        "978-9966-01-123-4",
  "category":    "Textbook",
  "totalCopies": 30
}
```

**Response `201`**
```json
{
  "status": "success",
  "book": {
    "_id":            "...",
    "title":          "Mathematics Grade 4",
    "totalCopies":    30,
    "availableCopies": 30,
    "isActive":       true
  }
}
```

---

### `GET /api/v1/library/books`

**Query Parameters:** `category`, `isActive`, `search` (title/author), `page`, `limit`

---

### `GET /api/v1/library/books/:id`

---

### `PATCH /api/v1/library/books/:id` *(admin only)*

Update book details (title, author, isbn, category, totalCopies, isActive).

---

### `POST /api/v1/library/loans`

Issue a book to a student or staff member.

**Request Body**

| Field | Type | Required | Rules |
|---|---|---|---|
| `bookId` | string (ObjectId) | ✅ | — |
| `borrowerType` | string | ✅ | `student` · `staff` |
| `borrowerId` | string (ObjectId) | ✅ | student or user ID |
| `dueDate` | string (ISO date) | ✅ | future date |
| `notes` | string | — | — |

```json
{
  "bookId":       "book-id",
  "borrowerType": "student",
  "borrowerId":   "student-id",
  "dueDate":      "2026-05-12"
}
```

**Response `201`**
```json
{
  "status": "success",
  "loan": {
    "_id":          "...",
    "bookId":       "...",
    "borrowerType": "student",
    "borrowerId":   "...",
    "borrowerName": "Emma Njeri",
    "dueDate":      "2026-05-12T00:00:00.000Z",
    "status":       "active",
    "issuedByUserId": "..."
  }
}
```

---

### `GET /api/v1/library/loans`

**Query Parameters:** `bookId`, `borrowerId`, `status` (`active`·`returned`·`overdue`), `page`, `limit`

---

### `GET /api/v1/library/loans/:id`

---

### `POST /api/v1/library/loans/:id/return`

Return a book.

**Request Body** (optional)
```json
{ "notes": "Minor damage to cover" }
```

**Response `200`**
```json
{
  "status": "success",
  "loan": { "...", "status": "returned", "returnedAt": "2026-04-12T..." }
}
```

---

### `PATCH /api/v1/library/loans/:id/overdue` *(admin only)*

Mark an active loan as overdue.

---

## Transport

**Base path:** `/api/v1/transport`  
**Auth:** Required  
**Feature gate:** `transport`

---

### `POST /api/v1/transport/routes` *(admin only)*

Create a transport route.

**Request Body**

| Field | Type | Required | Rules |
|---|---|---|---|
| `name` | string | ✅ | unique per school |
| `description` | string | — | — |
| `vehicleReg` | string | — | e.g. `"KBZ 123A"` |
| `driverName` | string | — | — |
| `driverPhone` | string | — | — |
| `capacity` | number | — | min 1 |
| `morningDeparture` | string | — | `HH:MM` |
| `afternoonDeparture` | string | — | `HH:MM` |
| `stops` | array | — | stop objects |

**Stop Object:**

| Field | Type | Required |
|---|---|---|
| `name` | string | ✅ |
| `order` | number | ✅ (min 1) |
| `lat` | number | — |
| `lng` | number | — |

```json
{
  "name":              "Route A — Karen",
  "vehicleReg":        "KBZ 123A",
  "driverName":        "Peter Mwangi",
  "driverPhone":       "+254711000001",
  "capacity":          30,
  "morningDeparture":  "06:30",
  "afternoonDeparture":"15:30",
  "stops": [
    { "name": "Karen Roundabout", "order": 1 },
    { "name": "Hardy", "order": 2 }
  ]
}
```

---

### `GET /api/v1/transport/routes`

**Query Parameters:** `isActive`, `page`, `limit`

---

### `GET /api/v1/transport/routes/:id`

---

### `PATCH /api/v1/transport/routes/:id` *(admin only)*

---

### `DELETE /api/v1/transport/routes/:id` *(admin only)*

---

### `POST /api/v1/transport/routes/:id/assign` *(admin only)*

Assign students to a route.

**Request Body**
```json
{ "studentIds": ["student-id-1", "student-id-2"] }
```

**Response `200`**
```json
{ "status": "success", "message": "3 student(s) assigned to route." }
```

---

### `POST /api/v1/transport/routes/:id/unassign` *(admin only)*

Remove students from a route.

**Request Body**
```json
{ "studentIds": ["student-id-1"] }
```

---

## Settings

**Base path:** `/api/v1/settings`  
**Auth:** Required — admin roles

Settings are per-school. Each school has exactly one settings document created on registration.

---

### `GET /api/v1/settings`

Get the current school's settings.

**Response `200`**
```json
{
  "status": "success",
  "settings": {
    "_id":                "...",
    "schoolId":           "...",
    "currentAcademicYear": "2026",
    "terms": [
      { "name": "Term 1", "startDate": "2026-01-06T00:00:00.000Z", "endDate": "2026-04-04T00:00:00.000Z" },
      { "name": "Term 2", "startDate": "2026-05-05T00:00:00.000Z", "endDate": "2026-08-07T00:00:00.000Z" },
      { "name": "Term 3", "startDate": "2026-09-07T00:00:00.000Z", "endDate": "2026-11-06T00:00:00.000Z" }
    ],
    "holidays":    [],
    "workingDays": ["monday","tuesday","wednesday","thursday","friday"],
    "logo":          null,
    "motto":         null,
    "principalName": null,
    "physicalAddress": null
  }
}
```

---

### `PUT /api/v1/settings`

Replace (full update) the school's settings.

**Request Body** (all fields optional)

| Field | Type | Rules |
|---|---|---|
| `currentAcademicYear` | string | 4-digit year |
| `terms` | array | array of term date objects |
| `workingDays` | string[] | subset of day-of-week enum |
| `logo` | string | URL |
| `motto` | string | — |
| `principalName` | string | — |
| `physicalAddress` | string | — |

**Term Date Object:**

| Field | Type | Required |
|---|---|---|
| `name` | string | ✅ (`Term 1`/`Term 2`/`Term 3`) |
| `startDate` | string (ISO date) | ✅ |
| `endDate` | string (ISO date) | ✅ |

```json
{
  "currentAcademicYear": "2026",
  "terms": [
    { "name": "Term 1", "startDate": "2026-01-06", "endDate": "2026-04-04" },
    { "name": "Term 2", "startDate": "2026-05-05", "endDate": "2026-08-07" },
    { "name": "Term 3", "startDate": "2026-09-07", "endDate": "2026-11-06" }
  ],
  "workingDays": ["monday","tuesday","wednesday","thursday","friday"],
  "principalName": "Dr. Jane Otieno"
}
```

---

### `POST /api/v1/settings/holidays`

Add a school holiday.

**Request Body**

| Field | Type | Required |
|---|---|---|
| `name` | string | ✅ |
| `date` | string (ISO date) | ✅ |
| `description` | string | — |

```json
{
  "name":        "Jamhuri Day",
  "date":        "2026-12-12",
  "description": "National holiday"
}
```

**Response `201`**
```json
{
  "status":   "success",
  "settings": { "...", "holidays": [ { "_id": "...", "name": "Jamhuri Day", "date": "..." } ] }
}
```

---

### `DELETE /api/v1/settings/holidays/:holidayId`

Remove a holiday by its `_id`.

---

## Audit Logs

**Base path:** `/api/v1/audit-logs`  
**Auth:** Required — admin roles  
**Feature gate:** `audit_log`

---

### `GET /api/v1/audit-logs`

Retrieve the school's audit trail.

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `action` | string | Filter by action enum |
| `resource` | string | Filter by resource enum |
| `userId` | ObjectId | Filter by actor |
| `resourceId` | ObjectId | Filter by specific resource |
| `startDate` | string (ISO) | Date range start |
| `endDate` | string (ISO) | Date range end |
| `page` | integer | — |
| `limit` | integer | — |

**Response `200`**
```json
{
  "status": "success",
  "logs": [
    {
      "_id":        "...",
      "userId":     "...",
      "userRole":   "school_admin",
      "action":     "create",
      "resource":   "Payment",
      "resourceId": "...",
      "meta":       { "amount": 15000, "method": "mpesa" },
      "ip":         "102.0.10.1",
      "createdAt":  "2026-04-12T10:00:00.000Z"
    }
  ],
  "meta": { "total": 450, "page": 1, "limit": 20, "totalPages": 23 }
}
```

**Audit Actions:** `create` · `update` · `delete` · `publish` · `reverse` · `suspend` · `activate` · `transfer` · `withdraw` · `promote` · `issue` · `return`

**Audit Resources:** `Payment` · `Student` · `ReportCard` · `School` · `User` · `Book` · `BookLoan`

---

## Parent Portal

**Base path:** `/api/v1/parent`  
**Auth:** Required — `parent` role only  
**Feature gate:** `parent_portal`

Parents can only access their own linked children's data.

---

### `GET /api/v1/parent/children`

Get all students linked to the authenticated parent.

**Response `200`**
```json
{
  "status":   "success",
  "children": [
    { "_id": "...", "firstName": "Emma", "lastName": "Njeri", "admissionNumber": "ADM2026001", "classId": "..." }
  ]
}
```

---

### `GET /api/v1/parent/children/:studentId/fees`

Get fee balance and payment history for a child.

**Query Parameters:** `academicYear`, `term`

---

### `GET /api/v1/parent/children/:studentId/attendance`

Get attendance records for a child.

**Query Parameters:** `term`, `academicYear`, `startDate`, `endDate`

---

### `GET /api/v1/parent/children/:studentId/results`

Get exam results for a child.

**Query Parameters:** `term`, `academicYear`, `subjectId`

---

### `GET /api/v1/parent/children/:studentId/report-cards`

Get published report cards for a child.

**Query Parameters:** `academicYear`, `term`

> Only `published` report cards are returned. Draft cards are hidden from parents.

---

## Data Models Reference

### User Object (returned in responses)

```json
{
  "_id":              "ObjectId",
  "firstName":        "string",
  "lastName":         "string",
  "email":            "string",
  "phone":            "string | null",
  "staffId":          "string | null",
  "tscNumber":        "string | null",
  "role":             "role enum",
  "schoolId":         "ObjectId | null",
  "classId":          "ObjectId | null",
  "children":         ["ObjectId"],
  "mustChangePassword": "boolean",
  "invitePending":    "boolean",
  "isActive":         "boolean",
  "lastLoginAt":      "ISO datetime | null",
  "createdAt":        "ISO datetime",
  "updatedAt":        "ISO datetime"
}
```

> `password`, `passwordResetToken`, `passwordResetExpiry`, `inviteToken`, `inviteTokenExpiry` are **never** returned in API responses.

---

### School Object

```json
{
  "_id":                "ObjectId",
  "name":               "string",
  "email":              "string",
  "phone":              "string",
  "county":             "string",
  "registrationNumber": "string | null",
  "address":            "string | null",
  "subscriptionStatus": "trial | active | suspended | expired",
  "planTier":           "trial | basic | standard | premium",
  "trialExpiry":        "ISO datetime",
  "isActive":           "boolean",
  "createdAt":          "ISO datetime",
  "updatedAt":          "ISO datetime"
}
```

---

### Student Object

```json
{
  "_id":             "ObjectId",
  "schoolId":        "ObjectId",
  "classId":         "ObjectId",
  "admissionNumber": "string",
  "firstName":       "string",
  "lastName":        "string",
  "gender":          "male | female",
  "dateOfBirth":     "ISO date | null",
  "parentIds":       ["ObjectId"],
  "status":          "active | transferred | graduated | withdrawn",
  "transferNote":    "string | null",
  "routeId":         "ObjectId | null",
  "photo":           "string (URL) | null",
  "createdAt":       "ISO datetime"
}
```

---

### Kenyan Phone Format

Accepted formats: `+254XXXXXXXXX`, `07XXXXXXXX`, `01XXXXXXXX`, `254XXXXXXXXX`  
All phone numbers are normalised to `+254XXXXXXXXX` before storage.

---

*Generated: 2026-04-12 | Diraschool API v1.0*
