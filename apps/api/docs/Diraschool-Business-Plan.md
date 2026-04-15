# Diraschool — Business Plan & Pricing Analysis
**Version 1.0 | April 2026 | Confidential**

---

## 1. Executive Summary

**Diraschool** is a multi-tenant, cloud-based school management SaaS built specifically for the Kenyan market under the CBC (Competency-Based Curriculum) framework. It serves private and low-cost private schools with tools for student management, attendance, exams, results, fee collection, report cards, timetables, transport, and library management.

**The opportunity:** Kenya has approximately 33,000+ registered schools. The majority of private schools (est. 17,000+) have no digital management system, relying on paper registers, Excel spreadsheets, and manual fee collection. CBC's introduction in 2017 (fully rolling out through 2025) increased administrative complexity — creating urgent demand for affordable, CBC-aware school software.

**Business model:** Termly SaaS subscription per school, priced by student count tier. One-time setup fee for onboarding.

---

## 2. Market Analysis

### 2.1 Kenya School Landscape

| Segment | Est. Count | Diraschool Target? |
|---|---|---|
| Public primary schools | ~22,000 | No (gov-funded, procurement-heavy) |
| Public secondary schools | ~4,500 | No (same) |
| Private primary schools | ~10,000 | ✅ Primary market |
| Private secondary schools | ~4,000 | ✅ Primary market |
| Low-cost private schools (LCPS) | ~8,000 | ✅ High-volume target |
| International schools | ~200 | Later stage (different needs) |

**Total addressable market (TAM):** ~22,000 private schools
**Serviceable addressable market (SAM, Year 1–2):** ~5,000 schools in Nairobi, Kiambu, Nakuru, Mombasa, Kisumu
**Serviceable obtainable market (SOM, Year 1):** 200–500 schools

### 2.2 Typical Private School Profile (Kenya)

| Category | Low-Cost Private | Mid-Tier Private | Premium Private |
|---|---|---|---|
| Students | 80–300 | 300–800 | 800–2,000 |
| Annual school fees (per student) | KES 15,000–40,000 | KES 50,000–120,000 | KES 150,000–400,000 |
| Monthly revenue | KES 100k–400k | KES 500k–2M | KES 2M–10M |
| IT budget willingness | Very low | Low–Medium | Medium–High |
| Decision maker | Head teacher / owner | Board / principal | Board |
| Key pain point | Fees tracking, registers | All of the above + timetable | Integration, analytics |

### 2.3 Competitor Landscape

| Competitor | Model | Price (est.) | Weakness |
|---|---|---|---|
| **Zeraki** | Per-student/term | KES 30–50/student/term | Expensive for small schools; sales-heavy |
| **Edukodi** | Per-school/month | KES 2,000–5,000/month | Limited CBC support |
| **School Hero** | Per-school/term | KES 5,000–8,000/term | Outdated UI, poor mobile experience |
| **Elimu Dashboard** | Per-school/year | KES 15,000–25,000/year | Limited features |
| **Excel / WhatsApp** | Free | KES 0 | Not scalable, error-prone |
| **Custom systems** | One-time | KES 80,000–300,000 | No updates, no support |

**Zeraki is the market leader** with significant VC backing and ~1,800+ schools. Their per-student model favors large schools. **Diraschool's advantage:** flat per-tier pricing means small schools (80–300 students) pay the same or less, AND get a better feature set designed for CBC from day one.

---

## 3. Infrastructure Cost Analysis

### 3.1 Monthly Technical Costs

| Item | Provider | Free Tier | Paid (est.) | Notes |
|---|---|---|---|---|
| **App hosting** | DigitalOcean (App Platform) | No | $12–$25/mo | 1 dyno, scales up |
| **Database** | MongoDB Atlas | M0 (512 MB) free | $9/mo (M2) or $57/mo (M10) | M0 handles ~200 schools; M2 handles ~1,000 |
| **Redis (cache + queues)** | Upstash | 10k commands/day free | $10–$20/mo | Needed for rate limiting + BullMQ |
| **Email (primary)** | Resend | 3,000/month free | $20/mo (50k emails) | Transactional only |
| **Email (fallback)** | ZeptoMail | 10,000 one-time | ~$2.50/10k emails | Pay-as-you-go |
| **SMS** | Africa's Talking | Sandbox free | KES 0.8–1.2/SMS | ~KES 1/SMS for AT |
| **Domain** | Namecheap/Safaricom | — | ~$15/year (~KES 2,000) | |
| **SSL** | Let's Encrypt | Free | Free | |
| **CDN/DDoS** | Cloudflare | Free tier | Free | |
| **File storage** | Cloudinary | 25 GB free | $89/mo (later) | PDF report cards |
| **Monitoring** | Sentry | 5k events free | $26/mo | Optional |

### 3.2 Cost at Different Scale Points

| Schools | Students (avg 250) | MongoDB | Redis | Email | Hosting | **Total/month** |
|---|---|---|---|---|---|---|
| 0–50 | 0–12,500 | M0 (free) | Free | Free | $12 | **~KES 1,600** |
| 50–200 | 12,500–50,000 | M2 ($9) | $10 | $20 | $25 | **~KES 8,300** |
| 200–500 | 50,000–125,000 | M10 ($57) | $20 | $20 | $50 | **~KES 19,200** |
| 500–1,000 | 125,000–250,000 | M20 ($189) | $40 | $40 | $100 | **~KES 49,000** |
| 1,000–2,000 | 250,000–500,000 | M30 ($360) | $80 | $80 | $200 | **~KES 93,000** |

*Exchange rate assumption: 1 USD = KES 130*

### 3.3 Per-School Infrastructure Cost

| Scale | Monthly infra cost | Schools | **Cost per school/month** | **Cost per school/term** |
|---|---|---|---|---|
| Early (50 schools) | KES 1,600 | 50 | KES 32 | KES 96 |
| Growth (200 schools) | KES 8,300 | 200 | KES 42 | KES 125 |
| Scaled (500 schools) | KES 19,200 | 500 | KES 38 | KES 115 |
| Mature (1,000 schools) | KES 49,000 | 1,000 | KES 49 | KES 147 |

**Key insight:** Infrastructure cost per school is KES 96–147 per term. This is remarkably low — even a KES 3,000/term price point yields 20–30× margin on infrastructure alone.

---

## 4. Pricing Model Options

### Option A: Flat Per-Tier (Recommended ✅)

Simple, predictable for schools. No surprise bills when enrolment grows within tier.

| Plan | Student Limit | Price/Term | Price/Year (15% disc.) | Setup Fee |
|---|---|---|---|---|
| **Starter** | Up to 300 | KES 9,900 | KES 25,245 | KES 10,000 |
| **Growth** | Up to 800 | KES 15,000 | KES 38,250 | KES 15,000 |
| **Professional** | Up to 2,000 | KES 25,000 | KES 63,750 | KES 20,000 |
| **Enterprise** | Unlimited | Custom | Custom | Custom |

*One academic year = 3 terms. Annual price = (price/term × 3) × 0.85*

### Option B: Per-Student (Zeraki model)

| Tier | Price per student/term | School of 200 | School of 500 | School of 1,000 |
|---|---|---|---|---|
| Starter | KES 35/student | KES 7,000 | KES 17,500 | KES 35,000 |
| Growth | KES 30/student | KES 6,000 | KES 15,000 | KES 30,000 |
| Volume (500+) | KES 25/student | — | KES 12,500 | KES 25,000 |

**Problem with Option B:** Penalises growing schools. A school that grows from 300 to 301 students suddenly costs more. Creates friction at key moments.

### Option C: Hybrid (flat base + per-student overage)

Base fee per tier + KES 15/student above the tier limit. Captures upside without punishing schools below the ceiling.

---

## 5. Recommended Pricing (Option A — Flat Tier)

### 5.1 Final Pricing Table

| Plan | Students | Term | Year | Setup | Monthly equiv. |
|---|---|---|---|---|---|
| **Starter** | ≤ 300 | **KES 9,900** | KES 25,245 | KES 10,000 | ~KES 3,300 |
| **Growth** | ≤ 800 | **KES 15,000** | KES 38,250 | KES 15,000 | ~KES 5,000 |
| **Professional** | ≤ 2,000 | **KES 25,000** | KES 63,750 | KES 20,000 | ~KES 8,333 |

### 5.2 Pricing Rationale

**Starter (KES 9,900/term):**
- Targets low-cost private primaries (the largest segment)
- KES 9,900 ÷ 250 students = **KES 39.6/student/term** — matches Zeraki's market rate
- Monthly equivalent: KES 3,300 — less than a part-time admin's daily wage
- Break-even at this price needs just **2 Starter schools** to cover all infrastructure

**Growth (KES 15,000/term):**
- Targets mid-tier schools (growing academies, secondary schools)
- KES 15,000 ÷ 550 avg students = **KES 27/student/term** — CHEAPER than Zeraki for same size
- Positioning: "More features than Zeraki, lower cost per student"

**Professional (KES 25,000/term):**
- Targets established schools (800–2,000 students)
- KES 25,000 ÷ 1,200 avg = **KES 20.8/student/term** — well below Zeraki at scale
- These schools have IT budgets; KES 25k/term is a rounding error vs. their monthly revenue

### 5.3 Setup Fee Justification

The setup fee covers:
- CSV student data import (manual effort)
- Class and grade structure configuration
- Fee structure setup per class/term
- Staff account creation and onboarding call (30–60 min)
- 30-day support during transition

**This is not optional.** Without a setup fee, you'd spend unpaid hours onboarding schools. KES 10,000–20,000 is reasonable — competitors charge similar or more.

---

## 6. Revenue Projections

### 6.1 Conservative Scenario (Year 1)

Target: **120 paying schools** by end of Year 1
- Starter (70%): 84 schools
- Growth (25%): 30 schools
- Professional (5%): 6 schools

| Plan | Schools | Term Revenue | Annual Revenue (3 terms) | Setup (one-time) |
|---|---|---|---|---|
| Starter | 84 | KES 831,600 | KES 2,494,800 | KES 840,000 |
| Growth | 30 | KES 450,000 | KES 1,350,000 | KES 450,000 |
| Professional | 6 | KES 150,000 | KES 450,000 | KES 120,000 |
| **Total** | **120** | **KES 1,431,600** | **KES 4,294,800** | **KES 1,410,000** |

**Year 1 gross revenue: ~KES 5,704,800 (~KES 5.7M)**
**Year 1 infrastructure cost: ~KES 100,000 (~KES 100k)**
**Gross margin: ~98%** *(before salaries, marketing, support)*

### 6.2 Growth Scenario (Year 2)

Target: **400 paying schools**

| Plan | Schools | Annual Revenue | Setup (new schools only, est. 280) |
|---|---|---|---|
| Starter (65%) | 260 | KES 7,722,000 | KES 1,820,000 |
| Growth (28%) | 112 | KES 5,040,000 | KES 1,680,000 |
| Professional (7%) | 28 | KES 2,100,000 | KES 560,000 |
| **Total** | **400** | **KES 14,862,000** | **KES 4,060,000** |

**Year 2 gross revenue: ~KES 18.9M**
**Year 2 infrastructure cost: ~KES 230,000**
**Gross margin: ~98.8%**

### 6.3 Break-Even Analysis

| Scenario | Monthly infra cost | Monthly revenue needed to break even |
|---|---|---|
| Solo founder, no salary | KES 8,300 | **2–3 Starter schools** |
| 1 developer salary (KES 120k/mo) | KES 128,300 | **14 Starter schools** |
| 2 staff (KES 240k/mo) | KES 248,300 | **26 Starter schools** |
| Full team of 5 (KES 600k/mo) | KES 608,300 | **62 Starter schools** |

**You reach infrastructure break-even at 2 schools.** Salary break-even scales with your burn rate, but the unit economics are strong enough to support a small team at 30–50 schools.

---

## 7. Go-To-Market Strategy

### 7.1 Customer Acquisition

**Phase 1 — Direct Sales (0–50 schools, Year 1 H1)**
- Cold outreach to school owners/principals via WhatsApp
- Demo days at private school associations (KPSA, KEPSHA events)
- Referral network: use early schools as case studies
- Cost: Mainly your time + transport (KES 5,000–15,000/month)

**Phase 2 — Word of Mouth + Content (50–200 schools, Year 1 H2)**
- Every happy school refers 2–3 others in same area
- WhatsApp group marketing within school owner networks
- Blog: "How to set up CBC report cards in 10 minutes" — SEO
- Cost: KES 10,000–30,000/month

**Phase 3 — Partnerships (200+ schools, Year 2)**
- Partner with CBC training organizations
- Education county offices as distribution channels
- Agent network (commission: 10–15% of first-year revenue)

### 7.2 Sales Cycle

Typical private school decision timeline:
1. **Demo** → 30-minute Zoom/in-person (Day 0)
2. **14-day free trial** → school admin uses it with test data
3. **Decision** → usually by end of trial (Day 14)
4. **Setup** → 2–3 days of onboarding
5. **Go live** → before next term starts

**Best sales timing:** 4–6 weeks before term opening (January, May, September)

### 7.3 Trial Strategy

- **30-day free trial**, full features, no credit card required
- After trial: pay or export your data (no lock-in threat)
- Trial-to-paid conversion target: 60–70%

---

## 8. Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Zeraki cuts prices aggressively | Medium | High | Compete on CBC-specific features, better UX, local support |
| School fails to renew after setup | Medium | Medium | Annual prepay discount, SMS reminders before renewal |
| Infrastructure costs spike (USD/KES) | Low | Medium | Most costs fixed in USD but customer base in KES; raise prices or hedge |
| Churn due to poor support | Medium | High | Dedicated WhatsApp support number, 24-hour SLA |
| Data breach / compliance | Low | Very High | GDPR-adjacent data handling, regular backups, data agreements |
| CBC curriculum changes | Low | Medium | Modular codebase allows quick CBC report card updates |
| Single-founder bus factor | High (initially) | High | Document everything, hire early, open-source non-core parts |

---

## 9. Key Metrics to Track

| Metric | Target (Year 1) | Target (Year 2) |
|---|---|---|
| Schools onboarded | 120 | 400 |
| Monthly Recurring Revenue (MRR) | KES 477,200 | KES 1,590,000 |
| Annual Recurring Revenue (ARR) | KES 5.7M | KES 19M |
| Churn rate (per term) | < 5% | < 3% |
| Trial-to-paid conversion | > 55% | > 65% |
| Customer Acquisition Cost (CAC) | < KES 5,000 | < KES 3,000 |
| Lifetime Value (LTV) | KES 120,000+ | KES 150,000+ |
| LTV:CAC ratio | > 24:1 | > 50:1 |
| Net Promoter Score (NPS) | > 40 | > 60 |
| Infra cost as % of revenue | < 2% | < 1.5% |

---

## 10. Summary & Recommendation

### Recommended pricing for launch:

| Plan | Term | Year | Setup |
|---|---|---|---|
| **Starter** (≤300 students) | **KES 9,900** | KES 25,245 | KES 10,000 |
| **Growth** (≤800 students) | **KES 15,000** | KES 38,250 | KES 15,000 |
| **Professional** (≤2,000 students) | **KES 25,000** | KES 63,750 | KES 20,000 |

### Why this pricing works:
1. **Below Zeraki on a per-student basis** — easy "we're cheaper AND better" sales pitch
2. **Above the psychological "too cheap = untrusted" threshold** — KES 9,900 feels like a real product
3. **Setup fee pays for your onboarding time** and filters out non-serious leads
4. **Annual prepay discount (15%)** smooths your cash flow and reduces churn
5. **Infrastructure margin is 98%+** — you can reinvest heavily in product and sales

### First 90 days action plan:
1. Onboard **5 pilot schools free** → get testimonials and case studies
2. Price the next **20 schools at 50% discount** → accelerate word of mouth
3. Go **full price at school 26+** → use the case studies to justify value
4. Target **1 new school per week** through direct WhatsApp outreach
5. By Day 90: 25+ paying schools, MRR > KES 100,000

---

*Document prepared for internal use. Figures are estimates based on market research and should be validated against actual operating experience.*
