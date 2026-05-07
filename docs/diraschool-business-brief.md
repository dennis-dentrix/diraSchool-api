# DiraSchool — Business Brief
**Confidential · May 2026**

---

## 1. Executive Summary

**DiraSchool** is a cloud-based School Management Information System (SMIS) purpose-built for Kenyan schools operating under the Competency-Based Curriculum (CBC). It digitises and centralises every operational and academic function a school runs — from student admission through CBC report card generation — delivered as a multi-tenant Software-as-a-Service (SaaS) platform accessible from any browser, on any device, without installation.

The system is production-ready, fully functional, and deployed on live cloud infrastructure. It is not a prototype. Every module described in this brief exists and operates end-to-end today.

**The business model is SaaS subscription, billed per school term**, aligned to the Kenyan school calendar and school budget cycles. Schools subscribe and pay online via Paystack (card and mobile money), with automated subscription activation on payment confirmation.

DiraSchool is operated by **Dirant Technologies Ltd**, a Kenyan technology company focused on education infrastructure software.

---

## 2. The Problem Being Solved

Kenyan schools — an estimated **35,000+ registered institutions** across primary, junior secondary (JSS), and secondary levels — manage their operations through a combination of:

- Physical registers and paper records
- Disconnected Microsoft Excel spreadsheets
- WhatsApp groups for staff communication
- Manual handwritten CBC report cards (a significant administrative burden given the 4-level rubric across multiple strands)
- No parent visibility into fees owed, attendance, or results

The transition to CBC has made this worse, not better. CBC requires tracking competency levels (EE / ME / AE / BE) per subject per exam per student, generating narrative-style progress reports, and maintaining strand-level assessments — none of which Excel handles well, and none of which paper does at scale.

**The consequences for schools:**
- Headteachers spending entire weekends on report card compilation
- Fee defaulters going undetected until term-end
- Attendance records lost or fabricated retrospectively
- No audit trail for administrative actions
- Parent complaints about lack of communication

DiraSchool eliminates all of these with one integrated platform.

---

## 3. Target Market

### Primary Market
Private and semi-private primary and junior secondary schools in Kenya, particularly:
- Schools with 75–1,500 students
- Schools with a functioning bursar/accountant and teaching staff of 5–40
- Schools that collect fees directly from parents (not fully capitation-dependent)
- Urban and peri-urban schools in counties with reliable internet: Nairobi, Mombasa, Kisumu, Nakuru, Eldoret, Thika, Nyeri, Meru

### Secondary Market
- County government secondary schools seeking digital records compliance
- School chains and franchises (multi-campus operators) needing consolidated visibility — multi-campus billing groups are supported natively
- Early Childhood Development Centres (ECDEs) as entry-level customers

### Market Size (Conservative Estimate)

| Segment | Estimated Count |
|---|---|
| Public primary schools | ~23,000 |
| Private primary schools | ~8,000 |
| Secondary schools (all types) | ~4,000+ |
| Addressable initial market (private primary + JSS, urban/peri-urban) | **~4,000–6,000 schools** |

At an average of KES 22,000/term across the addressable market, the total addressable market (TAM) per term is **KES 88M–132M**.

---

## 4. What the System Does — Module by Module

### 4.1 Multi-Tenant School Onboarding
Each school on the platform is a fully isolated tenant. Data from School A is never visible to School B. A school is registered with its full legal details — name, registration number, county, contact information — and assigned a subscription tier and status that governs feature access. A system superadmin manages all schools from a separate administrative portal.

### 4.2 Role-Based Staff Management
The platform supports eight distinct user roles with carefully scoped permissions:

| Role | Access Level |
|---|---|
| School Admin | Full access to all modules |
| Director | Full access |
| Head Teacher | Full access including audit logs |
| Deputy Head Teacher | Academic and operational access |
| Teacher | Students, attendance, results, timetable |
| Secretary | Students, attendance, classes, fee view |
| Accountant | Fee structures, payments, financial reports |
| Parent | Read-only portal: own child's data only |

Staff are invited by email with a secure one-time link. Admins can reset passwords, suspend accounts, or reactivate them without developer involvement.

### 4.3 Student Records Management
Complete student lifecycle management: admission with full demographic capture, class assignment, status tracking (Active → Transferred → Withdrawn → Graduated), class-to-class transfer with history preservation, bulk CSV import for migrating existing records, and full edit capability with audit trail.

### 4.4 Class Management
Class creation with name, stream, level category (Lower Primary / Upper Primary / JSS), and academic year. Class teacher assignment, subject assignment, student roster management, and year-end class promotion that bulk-moves all students to the next class.

### 4.5 Attendance Management
Daily attendance registers per class, auto-populated with all active students on register creation. Status per student: Present / Absent / Late / Excused. Register submission workflow (draft → submitted; submitted registers lock to prevent retrospective changes). Attendance data feeds directly into CBC report card generation.

### 4.6 Subject Management
Subject creation with name, code, and description. Assignment to classes. Teacher-to-subject assignment with Head of Department designation. Teachers see only their own subjects on login.

### 4.7 Examination Management
Exam creation: name, type (Opener / Midterm / Endterm / SBA), subject, class, academic year, term, total marks, and exam date. Exams listed per class and term with direct navigation to results entry.

### 4.8 Results Entry and CBC Grading
Bulk results entry per exam — scores for all students in one screen. Live CBC grade calculation as marks are typed (EE / ME / AE / BE for primary; EE1 through BE2 for JSS — 8-point scale). Pre-population of previously saved scores. Class statistics live as you type: total students, entries filled, class average. Results saved via bulk upsert (create or update, never duplicate).

### 4.9 CBC Report Card Generation
The most technically complex module and a primary differentiator.

- Single student or entire class generation in one action
- System automatically: pulls all results for the selected term and year, groups by subject, computes weighted-average percentage across all exam types, derives CBC grade and points per subject, aggregates overall grade and average points, pulls attendance summary from submitted registers
- Per-subject teacher remarks, class teacher remarks, and principal remarks — all editable before publication
- Regeneration: draft cards can be regenerated without losing manually written remarks
- Publication: locks the card permanently — published cards cannot be edited or regenerated
- **Print template**: A4-formatted print page with school header, student details, subject performance table, attendance summary, CBC grading key, remarks sections, and three-party signature lines — auto-triggers browser print/PDF dialog

### 4.10 Fee Management
**Fee Structures:** Named fee structures per academic year and term with line items (Tuition, Activity Fee, Lunch, Uniform, etc.) and auto-computed totals. Assigned to classes.

**Payments:** Record payments per student against a fee structure. Payment method tracking (cash, M-Pesa, bank transfer, cheque). Running balance calculation (owed vs. paid). Payment reversal with reason. M-Pesa C2B integration with automatic payment matching by phone number. Accountant-only access to sensitive financial operations.

### 4.11 Timetable Management
Weekly timetable grids per class. Subject, teacher, and room assignment per time slot. View by class or by teacher. Teachers see only their personal timetable.

### 4.12 Library Management
Book catalogue with title, author, ISBN, and copies available. Loan issuance, return recording, overdue tracking, and loan history per student.

### 4.13 Transport Management
Route creation with assigned driver/vehicle details. Student assignment and un-assignment. Route passenger lists.

### 4.14 Bulk SMS Notifications
Integrated bulk SMS via Africa's Talking. School admins send SMS broadcasts to parents — attendance alerts, fee reminders, general announcements. Credits are purchased in packs directly on the platform (Paystack checkout). Delivery tracking and SMS history per school.

### 4.15 Multi-Campus School Groups
School chains and franchises operate as a billing group — a single subscription covers all branches. Enrolment across all campuses aggregates automatically for billing. The superadmin configures group membership.

### 4.16 Audit Logging
Every significant action is logged automatically: who (user + role), what (action type), which resource, when, and what changed. School admins review their own school's logs. The system superadmin views logs across all schools — critical for compliance, dispute resolution, and fraud detection.

### 4.17 School Settings
School profile (principal name, motto, address, academic year), term date windows, school holidays, and working days configuration.

### 4.18 Parent Portal
Read-only portal scoped strictly to the parent's own children: child profile and class, fee balance and payment history, attendance records, exam results, and published report cards. Parents cannot see any other student's data.

### 4.19 Superadmin Portal
Separate management interface for DiraSchool platform operators: school listing with student and staff counts, school detail view with staff breakdown by role, subscription management (plan tier, status, trial expiry), system-wide audit log viewer with resource and action filters.

### 4.20 Online Subscription Billing
Schools subscribe and renew directly through the platform. Paystack checkout handles card and mobile money payments. On confirmation, the school is activated instantly, an invoice is generated, and a confirmation email is dispatched automatically. A full payment history with printable invoices is accessible from the billing dashboard.

---

## 5. How the System is Built

### 5.1 Technical Architecture

DiraSchool is a decoupled full-stack SaaS application with a REST API backend and a React frontend, deployed independently on DigitalOcean cloud infrastructure.

```
┌──────────────────────┐     HTTPS / Nginx     ┌──────────────────────┐
│   Next.js Frontend   │ ──────────────────►   │  Express.js API      │
│   (Web App)          │                        │  (Node.js / PM2)     │
│   PM2 cluster mode   │ ◄────────────────────  │                      │
└──────────────────────┘     JSON + Cookies     └──────────┬───────────┘
                                                            │
                                               ┌────────────▼───────────┐
                                               │   MongoDB Database     │
                                               │   (16 Collections)     │
                                               └────────────┬───────────┘
                                                            │
                                               ┌────────────▼───────────┐
                                               │   BullMQ + Redis       │
                                               │   (Email / SMS Queue)  │
                                               └────────────────────────┘
```

### 5.2 Backend Stack

| Component | Technology | Purpose |
|---|---|---|
| Runtime | Node.js 20 LTS | Server runtime |
| Framework | Express.js | HTTP routing and middleware |
| Database | MongoDB (Mongoose ODM) | Primary data store |
| Authentication | JWT (HTTP-only cookies) | Session management |
| Email Queue | BullMQ + Redis | Async email delivery |
| Email Service | ZeptoMail (Zoho) | Transactional email |
| SMS | Africa's Talking | Bulk SMS to parents |
| Payments | Paystack | Subscription billing (card + M-Pesa) |
| M-Pesa C2B | Safaricom Daraja | Fee payment matching |
| Validation | Zod | Request schema validation |
| Password Hashing | bcrypt (cost factor 12) | Credential security |
| File Handling | Multer | CSV import |
| Object Storage | DigitalOcean Spaces (S3) | File storage |
| Audit Logging | Custom middleware | Action tracking across all modules |

**16 MongoDB Collections:** Users, Schools, SchoolSettings, Classes, Students, Subjects, Exams, Results, Attendance, ReportCards, FeeStructures, Payments, SubscriptionPayments, AuditLogs, TransportRoutes, LibraryBooks, LibraryLoans.

### 5.3 Frontend Stack

| Component | Technology | Purpose |
|---|---|---|
| Framework | Next.js 15 (App Router) | React framework, file-based routing |
| Language | JavaScript (JSX) | Component development |
| Styling | Tailwind CSS | Utility-first CSS |
| Component Library | shadcn/ui | Accessible, composable UI components |
| Data Fetching | TanStack Query v5 | Server state, caching, background refetch |
| Forms | React Hook Form + Zod | Client-side validation |
| Notifications | Sonner | Toast notification system |
| Icons | Lucide React | Consistent icon set |
| Date Handling | date-fns | Date formatting and manipulation |
| Auth State | Zustand | Lightweight client state store |

### 5.4 Infrastructure (DigitalOcean)

Both servers run on DigitalOcean Droplets, managed with **Nginx** as the reverse proxy and **PM2** as the Node.js process manager — a production-grade setup that provides SSL termination, process auto-restart, zero-downtime reloads, and cluster-mode utilisation of all CPU cores.

| Component | Service | Specification | Monthly Cost (USD) |
|---|---|---|---|
| API Server | DO Droplet | 2GB RAM / 1 vCPU / 50GB SSD | $12 |
| Web Server | DO Droplet | 1GB RAM / 1 vCPU / 25GB SSD | $6 |
| Database | MongoDB Atlas Flex | Scales with usage, managed | $0–$58 |
| Object Storage | DO Spaces | S3-compatible, 250GB included | $5 |
| Automated Backups | DO Snapshots | Weekly droplet snapshots | $2–$4 |
| Email | ZeptoMail | Transactional, pay-per-use | ~$2–$5 |
| SSL | Let's Encrypt (Certbot) | Managed via Nginx, auto-renews | Free |
| **Total (lean / early stage)** | | | **~$27–$40/month** |
| **Total (at 50+ active schools)** | | | **~$100–$180/month** |

### 5.5 Security Architecture

| Layer | Implementation |
|---|---|
| Session tokens | HTTP-only cookies — not accessible to JavaScript, eliminates XSS token theft |
| Passwords | bcrypt hashed at cost factor 12 |
| Route protection | Role-based middleware on every protected endpoint |
| Tenant isolation | `schoolId` scoped on every database query — tenants cannot access each other's data |
| Input validation | Zod schema validation on all API inputs — rejects malformed or unexpected data |
| Password reset | Time-limited secure tokens, single-use |
| Audit trail | Every significant action logged with actor, timestamp, and change metadata |
| Transport | HTTPS enforced via Nginx; HTTP redirects to HTTPS automatically |
| Webhook verification | HMAC-SHA512 signature check on all Paystack and M-Pesa callbacks |

### 5.6 Multi-Tenancy Model

The system uses a **shared database, tenant-scoped queries** architecture. Every document in every collection carries a `schoolId` field that is automatically applied and enforced by middleware. No query to any collection can return data from another school. This is the right architecture for this scale — simpler than schema-per-tenant, cheaper than database-per-tenant, and secure when consistently enforced via middleware (which it is).

---

## 6. Platform Completeness Summary

All core and advanced modules are production-ready as of May 2026.

| Feature | Status |
|---|---|
| Student, staff, class, subject management | **Live** |
| Attendance registers | **Live** |
| CBC report cards (primary + JSS 8-point scale) | **Live** |
| Fee structures and payment recording | **Live** |
| M-Pesa C2B automatic payment matching | **Live** |
| Bulk SMS to parents (Africa's Talking) | **Live** |
| Timetable management | **Live** |
| Library management | **Live** |
| Transport route management | **Live** |
| Multi-campus billing groups | **Live** |
| Online subscription via Paystack | **Live** |
| Printable invoices with VAT breakdown | **Live** |
| Parent portal | **Live** |
| Superadmin portal | **Live** |
| Audit logging | **Live** |
| Mobile app (iOS / Android) | Not built — browser is responsive on mobile |
| Custom report card logo upload | Not built — school name and motto only |
| Advanced analytics dashboards | Basic — not advanced |
| Online admissions portal | Not built |
| Lesson planning tools | Not built |
| HR / payroll for staff | Not built |

---

## 7. Competitive Landscape in Kenya

| Competitor | Strengths | Weakness vs. DiraSchool |
|---|---|---|
| **Zeraki** | 4,000+ schools, brand recognition, analytics | Heavy, expensive, not CBC-native from ground up |
| **Schoolap** | Parent communication focus | Weak academic and fee management |
| **Shule Pro** | Basic attendance and fees | No CBC report cards, limited modules |
| **Elimu** | Government-adjacent | Limited private school features |
| **Excel + paper** | Free, familiar | The status quo being replaced — not a real competitor |

### DiraSchool's Key Differentiators

1. **CBC-native from day one** — grading logic, report cards, and terminology are built around CBC, not retrofitted onto an older system
2. **Per-term billing aligned to school cash flow** — schools pay when they have money, not monthly during holidays
3. **One platform, all modules** — no integration headaches, one login, one support contact for the whole school
4. **M-Pesa C2B fee matching built in** — fee payments via M-Pesa are automatically reconciled per student
5. **Parent portal included at no extra charge** — most competitors charge extra for parent access
6. **Transparent audit trail** — every action logged; headteachers see exactly who did what and when
7. **Built entirely for Kenya** — KES currency, Kenyan school calendar, county fields, CBC rubric, local school terminology throughout
8. **Multi-campus native** — school chains manage all branches under one subscription and one dashboard

---

## 8. Pricing Structure

*All prices in Kenyan Shillings. VAT at 16% applicable.*

### Per-Term Billing (Primary Model)

Pricing is calculated dynamically based on the school's **actual enrolled student count** at the time of subscription.

| Component | Rate |
|---|---|
| Base platform fee | KES 12,000 / term |
| Per active student | KES 50 / student / term |
| Annual plan (3 terms) | Base × 2.70 (~10% saving vs. 3 separate terms) |
| 3-Year annual plan | Base × 2.55 (~15% saving per year) |
| VAT | 16% on all amounts |

**Example — 150-student school, per-term:**
- Base: KES 12,000
- Students: 150 × KES 50 = KES 7,500
- Subtotal: KES 19,500
- VAT: KES 3,120
- **Total: KES 22,620**

**Trial:** 30 days free, up to 50 students, all features unlocked. No credit card required.

### Cost Benchmarks

| Students | Per-Term (ex-VAT) | Cost per student / term |
|---|---|---|
| 75 | KES 15,750 | KES 210 |
| 150 | KES 19,500 | KES 130 |
| 300 | KES 27,000 | KES 90 |
| 500 | KES 37,000 | KES 74 |
| 850 | KES 54,500 | KES 64 |
| 1,200 | KES 72,000 | KES 60 |

At under KES 210 per student per term — less than the cost of two exercise books — the value-to-price ratio is objectively strong.

### DiraSchool as a Percentage of School Fee Income

| Students | Est. Term Fee Income | DiraSchool (incl. VAT) as % |
|---|---|---|
| 75 | KES 375K–1.1M | 1.7–5% |
| 150 | KES 750K–2.25M | 1.2–3% |
| 300 | KES 1.5M–4.5M | 0.7–2% |
| 500 | KES 2.5M–7.5M | 0.5–1.7% |
| 850 | KES 4.25M–12.75M | 0.5–1.5% |

*Fee income estimate: KES 5,000–15,000 per student per term depending on school type and location.*

---

## 9. Business Model Summary

| Metric | Value |
|---|---|
| Revenue model | B2B SaaS, term-based subscription |
| Primary billing cycle | Per Kenyan school term (3 times per year) |
| Secondary billing cycle | Annual (discounted ~10%) / 3-Year (discounted ~15%) |
| Payment processing | Paystack — card + mobile money (KES) |
| Customer acquisition | Direct outreach, head-teacher networks, KNUT/KUPPET connections, school expos |
| Onboarding | Self-service 30-day trial → sales-assisted conversion |
| Support model | WhatsApp + email support |
| Churn mitigation | Term-aligned billing, sticky historical data (student records, reports, fees), switching cost |
| Expansion revenue | Automatic cost increase as school enrolment grows |
| Break-even point (infrastructure + basic ops) | 3–5 paying schools at 200+ students |
| Target Year 1 | 30 paying schools |
| Target Year 2 | 100 paying schools |

### Revenue Projections

| Schools | Avg Students | Revenue / Term (incl. VAT) | Infra Cost / Term | Net / Term | Net / Year |
|---|---|---|---|---|---|
| 10 | 200 | ~KES 261,600 | KES 20,000 | **KES 241,600** | **KES 724,800** |
| 20 | 250 | ~KES 580,000 | KES 30,000 | **KES 550,000** | **KES 1,650,000** |
| 40 | 300 | ~KES 1,250,000 | KES 55,000 | **KES 1,195,000** | **KES 3,585,000** |
| 80 | 350 | ~KES 2,700,000 | KES 100,000 | **KES 2,600,000** | **KES 7,800,000** |

---

## 10. Invoice Timing Strategy

Send invoices two weeks before each term starts, with payment due by the first day of term. Schools will have just processed parent fee collection and budget approvals happen in that window.

| Term | Schools Open | Invoice Send Date | Payment Due |
|---|---|---|---|
| Term 1 | ~2nd week January | **Late December** | January 6 |
| Term 2 | ~1st week May | **Mid-April** | April 28 |
| Term 3 | ~1st week September | **Mid-August** | September 1 |

---

## 11. The One-Paragraph Pitch

> DiraSchool is the only school management system in Kenya designed from the ground up for CBC — not adapted from an older curriculum system, not a generic African school platform retrofitted with a CBC label. It handles everything a school runs: student records, daily attendance, CBC report cards with the correct 4-level and 8-point grading rubrics, fee collection with M-Pesa matching, exam results, staff management, bulk SMS to parents, a parent portal, and a full audit trail — in one login, on any device, at a price that represents less than 2% of what the school earns in fees each term. It bills per school term because that is when schools have money, not monthly when they are in the middle of the holidays with no income. Schools subscribe and pay online via card or M-Pesa and are activated in minutes. The target customer is any Kenyan school with 75 to 1,500 students that is tired of losing weekends to handwritten report cards and chasing parents with paper fee statements.

---

*Document prepared by Dirant Technologies Ltd — the company behind DiraSchool*
*May 2026 · Confidential*
*For pricing strategy consultation, investor conversations, and partnership discussions*
