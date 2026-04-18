"""
DiraSchool Business Brief — PDF Generator
Uses reportlab Platypus for professional document layout.
Run: python3 generate_brief.py
Output: diraschool-business-brief.pdf
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.platypus.flowables import HRFlowable
from reportlab.lib.colors import HexColor
import os

OUTPUT = os.path.join(os.path.dirname(__file__), "diraschool-business-brief.pdf")

# ── Colour palette ────────────────────────────────────────────────────────────
NAVY    = HexColor("#1e3a5f")
TEAL    = HexColor("#0d6e6e")
LIGHT   = HexColor("#f0f4f8")
MID     = HexColor("#dce6f0")
ACCENT  = HexColor("#e8f5f0")
WHITE   = colors.white
BLACK   = colors.black
GREY    = HexColor("#6b7280")
DARKGREY= HexColor("#374151")

PAGE_W, PAGE_H = A4

# ── Styles ────────────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

def S(name, **kw):
    """Create a named ParagraphStyle extending Normal."""
    return ParagraphStyle(name, parent=styles["Normal"], **kw)

cover_title = S("CoverTitle",
    fontSize=28, leading=34, textColor=WHITE,
    fontName="Helvetica-Bold", alignment=TA_LEFT, spaceAfter=6)

cover_sub = S("CoverSub",
    fontSize=13, leading=18, textColor=HexColor("#c8ddf0"),
    fontName="Helvetica", alignment=TA_LEFT, spaceAfter=4)

cover_meta = S("CoverMeta",
    fontSize=10, leading=14, textColor=HexColor("#90b8d8"),
    fontName="Helvetica", alignment=TA_LEFT)

h1 = S("H1",
    fontSize=15, leading=20, textColor=NAVY,
    fontName="Helvetica-Bold", spaceBefore=18, spaceAfter=6)

h2 = S("H2",
    fontSize=12, leading=16, textColor=TEAL,
    fontName="Helvetica-Bold", spaceBefore=12, spaceAfter=4)

h3 = S("H3",
    fontSize=10.5, leading=14, textColor=DARKGREY,
    fontName="Helvetica-Bold", spaceBefore=8, spaceAfter=3)

body = S("Body",
    fontSize=9.5, leading=14.5, textColor=DARKGREY,
    fontName="Helvetica", alignment=TA_JUSTIFY, spaceAfter=5)

body_left = S("BodyLeft",
    fontSize=9.5, leading=14.5, textColor=DARKGREY,
    fontName="Helvetica", alignment=TA_LEFT, spaceAfter=4)

bullet = S("Bullet",
    fontSize=9.5, leading=14, textColor=DARKGREY,
    fontName="Helvetica", leftIndent=14, spaceAfter=2)

callout = S("Callout",
    fontSize=10, leading=15, textColor=NAVY,
    fontName="Helvetica-BoldOblique", alignment=TA_JUSTIFY,
    leftIndent=12, rightIndent=12, spaceAfter=6, spaceBefore=6)

footer_style = S("Footer",
    fontSize=8, textColor=GREY, alignment=TA_CENTER)

label = S("Label",
    fontSize=8.5, textColor=GREY, fontName="Helvetica-Bold",
    alignment=TA_CENTER)

# ── Table style builders ──────────────────────────────────────────────────────

def header_table_style(col_count, header_rows=1):
    return TableStyle([
        # Header row
        ("BACKGROUND",  (0, 0), (-1, header_rows - 1), NAVY),
        ("TEXTCOLOR",   (0, 0), (-1, header_rows - 1), WHITE),
        ("FONTNAME",    (0, 0), (-1, header_rows - 1), "Helvetica-Bold"),
        ("FONTSIZE",    (0, 0), (-1, header_rows - 1), 8.5),
        ("ALIGN",       (0, 0), (-1, header_rows - 1), "LEFT"),
        ("TOPPADDING",  (0, 0), (-1, header_rows - 1), 6),
        ("BOTTOMPADDING",(0,0), (-1, header_rows - 1), 6),
        # Body rows
        ("FONTNAME",    (0, header_rows), (-1, -1), "Helvetica"),
        ("FONTSIZE",    (0, header_rows), (-1, -1), 8.5),
        ("TEXTCOLOR",   (0, header_rows), (-1, -1), DARKGREY),
        ("TOPPADDING",  (0, header_rows), (-1, -1), 5),
        ("BOTTOMPADDING",(0,header_rows), (-1, -1), 5),
        ("ROWBACKGROUNDS", (0, header_rows), (-1, -1), [WHITE, LIGHT]),
        ("GRID",        (0, 0), (-1, -1), 0.4, HexColor("#c8d6e5")),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING",(0, 0), (-1, -1), 7),
        ("VALIGN",      (0, 0), (-1, -1), "MIDDLE"),
    ])

def highlight_last_row(ts):
    """Bold + light-blue background on last row (used for totals/overall rows)."""
    ts.add("BACKGROUND", (0, -1), (-1, -1), MID)
    ts.add("FONTNAME",   (0, -1), (-1, -1), "Helvetica-Bold")
    return ts

def p(text, style=body):
    return Paragraph(text, style)

def b(text):
    return Paragraph(f"&#x2022;&nbsp;&nbsp;{text}", bullet)

def hr(color=MID, thickness=1):
    return HRFlowable(width="100%", thickness=thickness, color=color, spaceAfter=4, spaceBefore=4)

def space(h=6):
    return Spacer(1, h)

def section_rule():
    return HRFlowable(width="100%", thickness=1.5, color=NAVY, spaceAfter=8, spaceBefore=2)

# ── Page template (header / footer) ──────────────────────────────────────────

def on_page(canvas, doc):
    canvas.saveState()
    w, h = A4

    if doc.page > 1:
        # Top rule
        canvas.setStrokeColor(NAVY)
        canvas.setLineWidth(0.5)
        canvas.line(15*mm, h - 12*mm, w - 15*mm, h - 12*mm)
        # Header text
        canvas.setFont("Helvetica-Bold", 7.5)
        canvas.setFillColor(NAVY)
        canvas.drawString(15*mm, h - 10*mm, "DIRASCHOOL")
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(GREY)
        canvas.drawRightString(w - 15*mm, h - 10*mm, "Business Brief · Confidential · April 2026")

        # Footer rule
        canvas.setStrokeColor(MID)
        canvas.setLineWidth(0.5)
        canvas.line(15*mm, 12*mm, w - 15*mm, 12*mm)
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(GREY)
        canvas.drawCentredString(w / 2, 8*mm, f"Page {doc.page}")

    canvas.restoreState()

# ── Cover page ────────────────────────────────────────────────────────────────

def cover_page():
    w, h = A4
    elements = []

    # We'll draw the cover as a table that fills the page
    cover_data = [[""]]
    cover_table = Table(cover_data, colWidths=[w - 30*mm], rowHeights=[h - 30*mm])
    cover_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("LEFTPADDING",  (0,0), (-1,-1), 20*mm),
        ("RIGHTPADDING", (0,0), (-1,-1), 20*mm),
        ("TOPPADDING",   (0,0), (-1,-1), 40*mm),
        ("BOTTOMPADDING",(0,0), (-1,-1), 20*mm),
    ]))

    elements.append(cover_table)

    # Build the cover content as a nested story drawn inside a frame
    # Instead, we'll fake the cover with a coloured Table + overlaid text

    # Simpler: just return a coloured block then overlay text via a different approach.
    # Use KeepTogether with coloured table cells for the cover.
    elements = []

    # Cover block
    cover_inner = [
        [Paragraph("DIRASCHOOL", S("ct1", fontSize=9, fontName="Helvetica-Bold",
            textColor=HexColor("#90b8d8")))],
        [Paragraph("Business Brief", S("ct2", fontSize=32, fontName="Helvetica-Bold",
            textColor=WHITE, leading=38))],
        [Spacer(1, 6)],
        [Paragraph("School Management Information System", S("ct3", fontSize=14,
            fontName="Helvetica", textColor=HexColor("#c8ddf0"), leading=20))],
        [Spacer(1, 8)],
        [Paragraph("─────────────────────", S("divline", fontSize=10, textColor=TEAL))],
        [Spacer(1, 10)],
        [Paragraph("Purpose-built for the Kenyan Competency-Based Curriculum (CBC).",
            S("ct4", fontSize=11, fontName="Helvetica", textColor=HexColor("#a8c8e0"),
              leading=17, alignment=TA_LEFT))],
        [Spacer(1, 4)],
        [Paragraph("A production-ready, multi-tenant SaaS platform serving primary,\njunior secondary, and secondary schools across Kenya.",
            S("ct5", fontSize=10, fontName="Helvetica", textColor=HexColor("#8ab0cc"),
              leading=15, alignment=TA_LEFT))],
        [Spacer(1, 50)],
        [Paragraph("Confidential &nbsp;·&nbsp; April 2026",
            S("ct6", fontSize=9, fontName="Helvetica", textColor=HexColor("#6090b0")))],
        [Paragraph("For pricing strategy, investor conversations, and partnership discussions.",
            S("ct7", fontSize=8.5, fontName="Helvetica", textColor=HexColor("#507090")))],
    ]

    cover_t = Table(
        cover_inner,
        colWidths=[A4[0] - 30*mm],
    )
    cover_t.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), NAVY),
        ("LEFTPADDING",  (0, 0), (-1, -1), 22*mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 22*mm),
        ("TOPPADDING",   (0, 0), (0,  0),  38*mm),
        ("TOPPADDING",   (0, 1), (-1, -1), 2),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 2),
        ("BOTTOMPADDING",(0,-1), (-1, -1), 22*mm),
        ("VALIGN",       (0, 0), (-1, -1), "TOP"),
    ]))

    elements.append(cover_t)
    elements.append(PageBreak())
    return elements

# ── Helper: coloured section header ──────────────────────────────────────────

def section_header(number, title):
    data = [[
        Paragraph(number, S("sn", fontSize=10, fontName="Helvetica-Bold", textColor=WHITE)),
        Paragraph(title,  S("st", fontSize=12, fontName="Helvetica-Bold", textColor=WHITE)),
    ]]
    t = Table(data, colWidths=[12*mm, 148*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), NAVY),
        ("LEFTPADDING",  (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING",   (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 7),
        ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return [space(10), t, space(6)]

def subsection(title):
    return [p(title, h2)]

def subsubsection(title):
    return [p(title, h3)]

# ── Document builder ──────────────────────────────────────────────────────────

def build():
    doc = SimpleDocTemplate(
        OUTPUT,
        pagesize=A4,
        leftMargin=15*mm, rightMargin=15*mm,
        topMargin=18*mm, bottomMargin=18*mm,
        title="DiraSchool Business Brief",
        author="DiraSchool",
        subject="School Management SaaS — Kenya",
    )

    story = []

    # ── Cover ─────────────────────────────────────────────────────────────────
    story += cover_page()

    # ── 1. Executive Summary ──────────────────────────────────────────────────
    story += section_header("1", "Executive Summary")
    story.append(p(
        "<b>DiraSchool</b> is a cloud-based School Management Information System (SMIS) "
        "purpose-built for Kenyan schools operating under the Competency-Based Curriculum (CBC). "
        "It digitises and centralises every operational and academic function a school runs — "
        "from student admission through CBC report card generation — delivered as a multi-tenant "
        "Software-as-a-Service (SaaS) platform accessible from any browser, on any device, "
        "without installation."
    ))
    story.append(p(
        "The system is <b>production-ready, fully functional, and deployed on live cloud "
        "infrastructure</b>. It is not a prototype. Every module described in this brief "
        "exists and operates end-to-end today."
    ))

    # Callout box
    callout_data = [[Paragraph(
        "The business model is SaaS subscription, billed per school term — aligned to the "
        "Kenyan school calendar and school budget cycles, invoiced exactly when schools have money.",
        S("cb", fontSize=10, fontName="Helvetica-Bold", textColor=NAVY,
          alignment=TA_JUSTIFY, leading=15)
    )]]
    ct = Table(callout_data, colWidths=[160*mm])
    ct.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (-1,-1), ACCENT),
        ("LEFTPADDING",  (0,0), (-1,-1), 14),
        ("RIGHTPADDING", (0,0), (-1,-1), 14),
        ("TOPPADDING",   (0,0), (-1,-1), 10),
        ("BOTTOMPADDING",(0,0), (-1,-1), 10),
        ("LINEAFTER",    (0,0), (0,-1),   3, TEAL),
    ]))
    story.append(space(4))
    story.append(ct)
    story.append(space(6))

    # ── 2. The Problem ────────────────────────────────────────────────────────
    story += section_header("2", "The Problem Being Solved")
    story.append(p(
        "Kenyan schools — an estimated <b>35,000+ registered institutions</b> across primary, "
        "junior secondary (JSS), and secondary levels — manage their operations through:"
    ))
    for item in [
        "Physical registers and paper records",
        "Disconnected Microsoft Excel spreadsheets",
        "WhatsApp groups for staff communication",
        "Manual handwritten CBC report cards — a significant administrative burden given the "
        "4-level rubric across multiple strands",
        "No parent visibility into fees owed, attendance, or results",
    ]:
        story.append(b(item))

    story.append(space(6))
    story.append(p(
        "The transition to CBC has made this worse, not better. CBC requires tracking competency "
        "levels (EE / ME / AE / BE) per subject per exam per student, generating narrative-style "
        "progress reports, and maintaining strand-level assessments — none of which Excel handles "
        "at scale. The consequences:"
    ))
    for item in [
        "Headteachers spending entire weekends on report card compilation",
        "Fee defaulters going undetected until term-end",
        "Attendance records lost or fabricated retrospectively",
        "No audit trail for administrative actions",
        "Parent complaints about lack of communication",
    ]:
        story.append(b(item))

    story.append(space(4))
    story.append(p("DiraSchool eliminates all of these with one integrated platform.", body_left))

    # ── 3. Target Market ──────────────────────────────────────────────────────
    story += section_header("3", "Target Market")

    story += subsubsection("Primary Market")
    story.append(p(
        "Private and semi-private primary and junior secondary schools in Kenya with 75–1,500 "
        "students, a functioning bursar/accountant, and teaching staff of 5–40. Urban and "
        "peri-urban schools in counties with reliable internet: <b>Nairobi, Mombasa, Kisumu, "
        "Nakuru, Eldoret, Thika, Nyeri, Meru</b>."
    ))

    story += subsubsection("Secondary Market")
    for item in [
        "County government secondary schools seeking digital records compliance",
        "School chains and franchises (multi-campus operators) needing consolidated visibility",
        "Early Childhood Development Centres (ECDEs) as entry-level customers",
    ]:
        story.append(b(item))

    story.append(space(6))
    story += subsubsection("Market Size (Conservative Estimate)")
    mkt_data = [
        ["Segment", "Estimated Count"],
        ["Public primary schools", "~23,000"],
        ["Private primary schools", "~8,000"],
        ["Secondary schools (all types)", "~4,000+"],
        ["Addressable initial market\n(private primary + JSS, urban/peri-urban)", "~4,000–6,000 schools"],
    ]
    ts = header_table_style(2)
    ts.add("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold")
    ts.add("BACKGROUND", (0, -1), (-1, -1), MID)
    mkt_t = Table(mkt_data, colWidths=[115*mm, 45*mm])
    mkt_t.setStyle(ts)
    story.append(mkt_t)
    story.append(space(4))
    story.append(p(
        "At an average of KES 22,000/term across the addressable market, the total addressable "
        "market (TAM) per term is <b>KES 88M–132M</b>."
    ))

    # ── 4. Modules ────────────────────────────────────────────────────────────
    story += section_header("4", "What the System Does — Modules")

    modules = [
        ("4.1", "Multi-Tenant School Onboarding",
         "Each school on the platform is a fully isolated tenant. Data from School A is never "
         "visible to School B. A school is registered with its full legal details and assigned a "
         "subscription tier. A system superadmin manages all schools from a separate portal."),
        ("4.2", "Role-Based Staff Management",
         "Eight distinct user roles with carefully scoped permissions. Staff are invited by email "
         "with a secure one-time link. Admins can reset passwords, suspend or reactivate accounts "
         "without developer involvement."),
        ("4.3", "Student Records Management",
         "Complete student lifecycle: admission with full demographic capture, class assignment, "
         "status tracking (Active / Transferred / Withdrawn / Graduated), transfer history, "
         "bulk CSV import for migrating existing records, and full edit capability with audit trail."),
        ("4.4", "Class Management",
         "Class creation with name, stream, level category (Lower Primary / Upper Primary / JSS), "
         "and academic year. Class teacher and subject assignment. Year-end class promotion "
         "bulk-moves all students to the next class."),
        ("4.5", "Attendance Management",
         "Daily registers per class, auto-populated with all active students. Status per student: "
         "Present / Absent / Late / Excused. Draft-to-submitted workflow locks registers against "
         "retrospective changes. Data feeds directly into report card generation."),
        ("4.6", "Subject & Examination Management",
         "Subject creation, class assignment, and teacher assignment with HOD designation. "
         "Exam creation (Opener / Midterm / Endterm / SBA) with direct navigation to results entry."),
        ("4.7", "Results Entry & CBC Grading",
         "Bulk results entry per exam. Live CBC grade calculation as marks are typed — "
         "EE/ME/AE/BE for primary; EE1 through BE2 (8-point scale) for JSS. Pre-population "
         "of previously saved scores. Class statistics live as you type."),
        ("4.8", "CBC Report Card Generation",
         "Single student or entire class generation in one action. System automatically pulls "
         "results, computes weighted-average percentages per subject, derives CBC grades, "
         "aggregates overall grade, and summarises attendance. Per-subject and overall remarks "
         "editable before publication. Publication locks the card permanently. "
         "Print template: A4-formatted page with school header, student details, subject table, "
         "attendance summary, CBC grading key, remarks, and three-party signature lines — "
         "auto-triggers browser print/PDF dialog."),
        ("4.9", "Fee Management",
         "Named fee structures per academic year and term with line items and auto-computed totals. "
         "Payment recording with method tracking (cash, M-Pesa, bank, cheque). Running balance "
         "per student. Payment reversal with reason. Accountant-only access to financial operations."),
        ("4.10", "Timetable, Library & Transport",
         "Weekly timetable grids per class with teacher and room assignment. Book catalogue, "
         "loan issuance, return recording, and overdue tracking. Transport route management "
         "with student assignment."),
        ("4.11", "Audit Logging",
         "Every significant action logged: who, what, which resource, when, and what changed. "
         "School admins review their own logs. Superadmin views logs across all schools — "
         "critical for compliance, dispute resolution, and fraud detection."),
        ("4.12", "Parent Portal",
         "Read-only portal scoped to the parent's own children: profile, fee balance and "
         "payment history, attendance, exam results, and published report cards."),
        ("4.13", "Superadmin Portal",
         "Separate management interface for DiraSchool operators: school listing with student "
         "and staff counts, subscription management (plan tier, status, trial expiry), "
         "and system-wide audit log viewer with filters."),
    ]

    for num, title, desc in modules:
        story.append(KeepTogether([
            p(f"<b>{num} &nbsp; {title}</b>", h3),
            p(desc),
            space(2),
        ]))

    # Roles table
    story.append(space(4))
    story += subsubsection("Staff Role Matrix")
    role_data = [
        ["Role", "Access Level"],
        ["School Admin", "Full access to all modules"],
        ["Director", "Full access"],
        ["Head Teacher", "Full access including audit logs"],
        ["Deputy Head Teacher", "Academic and operational access"],
        ["Teacher", "Students, attendance, results, timetable"],
        ["Secretary", "Students, attendance, classes, fee view"],
        ["Accountant", "Fee structures, payments, financial reports"],
        ["Parent", "Read-only portal: own child's data only"],
    ]
    role_t = Table(role_data, colWidths=[60*mm, 100*mm])
    role_t.setStyle(header_table_style(2))
    story.append(role_t)

    # ── 5. How It's Built ─────────────────────────────────────────────────────
    story += section_header("5", "How the System Is Built")

    story += subsection("5.1 Technical Architecture")
    story.append(p(
        "DiraSchool is a decoupled full-stack SaaS application with a REST API backend and a "
        "React frontend, deployed independently on DigitalOcean cloud infrastructure. Both "
        "servers are managed with <b>Nginx</b> as the reverse proxy and <b>PM2</b> as the "
        "Node.js process manager — a production-grade setup providing SSL termination, "
        "process auto-restart, zero-downtime reloads, and cluster-mode CPU utilisation."
    ))

    story += subsection("5.2 Backend Stack")
    be_data = [
        ["Component", "Technology", "Purpose"],
        ["Runtime", "Node.js 20 LTS", "Server runtime"],
        ["Framework", "Express.js", "HTTP routing and middleware"],
        ["Database", "MongoDB (Mongoose ODM)", "Primary data store — 14 collections"],
        ["Authentication", "JWT (HTTP-only cookies)", "Session management"],
        ["Email Queue", "BullMQ + Redis", "Async email delivery"],
        ["Email Service", "ZeptoMail (Zoho)", "Transactional email — invites, resets, notifications"],
        ["Validation", "Zod", "Request schema validation — rejects malformed input"],
        ["Password Hashing", "bcrypt (cost factor 12)", "Credential security"],
        ["File Handling", "Multer", "CSV import for bulk student upload"],
        ["Audit Logging", "Custom middleware", "Action tracking across all modules"],
    ]
    be_t = Table(be_data, colWidths=[42*mm, 52*mm, 66*mm])
    be_t.setStyle(header_table_style(3))
    story.append(be_t)

    story += subsection("5.3 Frontend Stack")
    fe_data = [
        ["Component", "Technology", "Purpose"],
        ["Framework", "Next.js 15 (App Router)", "React framework, file-based routing"],
        ["Language", "JavaScript (JSX)", "Component development"],
        ["Styling", "Tailwind CSS", "Utility-first CSS"],
        ["Component Library", "shadcn/ui", "Accessible, composable UI components"],
        ["Data Fetching", "TanStack Query v5", "Server state, caching, background refetch"],
        ["Forms", "React Hook Form + Zod", "Client-side validation"],
        ["Auth State", "Zustand", "Lightweight client state store"],
        ["Notifications", "Sonner", "Toast notification system"],
    ]
    fe_t = Table(fe_data, colWidths=[42*mm, 52*mm, 66*mm])
    fe_t.setStyle(header_table_style(3))
    story.append(fe_t)

    story += subsection("5.4 Infrastructure (DigitalOcean Droplets)")
    story.append(p(
        "Both servers run on DigitalOcean Droplets with <b>Nginx</b> as the reverse proxy "
        "and <b>PM2</b> as the process manager. Nginx handles SSL/TLS termination via "
        "Let's Encrypt (Certbot), reverse-proxies requests to Node.js, serves static assets "
        "directly, enforces rate limiting, and manages HTTP-to-HTTPS redirects. PM2 manages "
        "the Node.js process lifecycle — auto-restart on crash, cluster mode across CPU cores, "
        "log rotation, and zero-downtime deploys via <i>pm2 reload</i>."
    ))

    infra_data = [
        ["Component", "Service", "Specification", "Monthly (USD)"],
        ["API Server", "DO Droplet", "2GB RAM / 1vCPU / 50GB SSD", "$12"],
        ["Web Server", "DO Droplet", "1GB RAM / 1vCPU / 25GB SSD", "$6"],
        ["Database", "MongoDB Atlas Flex", "Scales with usage, managed", "$0–$58"],
        ["Object Storage", "DO Spaces", "S3-compatible, 250GB included", "$5"],
        ["Backups", "DO Snapshots", "Weekly automated droplet snapshots", "$2–$4"],
        ["Email", "ZeptoMail", "Transactional, pay-per-use credits", "~$2–$5"],
        ["SSL / HTTPS", "Let's Encrypt (Certbot)", "Managed via Nginx, auto-renews", "Free"],
        ["Total (early stage)", "", "", "~$27–$40/month"],
        ["Total (50+ schools)", "", "", "~$100–$180/month"],
    ]
    ts_infra = header_table_style(4)
    ts_infra.add("FONTNAME",   (0, -2), (-1, -1), "Helvetica-Bold")
    ts_infra.add("BACKGROUND", (0, -2), (-1, -1), MID)
    infra_t = Table(infra_data, colWidths=[35*mm, 40*mm, 58*mm, 27*mm])
    infra_t.setStyle(ts_infra)
    story.append(infra_t)

    story += subsection("5.5 Email Service: ZeptoMail")
    story.append(p(
        "<b>ZeptoMail</b> (by Zoho) is the recommended transactional email provider. "
        "It is purpose-built exclusively for transactional email — not shared with "
        "marketing campaigns — keeping IP reputation high and ensuring inbox delivery "
        "for critical messages: staff invites, password resets, and parent notifications."
    ))
    email_data = [
        ["Attribute", "Detail"],
        ["Provider", "ZeptoMail by Zoho"],
        ["Use cases", "Staff invites, password resets, email verification, parent notifications"],
        ["Free tier", "10,000 emails (one-time, sufficient for early onboarding)"],
        ["Paid pricing", "~$2.50 per 10,000 email credits"],
        ["Integration", "REST API and SMTP relay — Node.js via Nodemailer transport"],
        ["Deliverability", "High — dedicated transactional infrastructure"],
        ["Alternative", "Resend — modern API, 3,000 free emails/month, excellent DX"],
        ["Est. annual cost (Year 1)", "Below KES 500/month"],
    ]
    email_t = Table(email_data, colWidths=[55*mm, 105*mm])
    email_t.setStyle(header_table_style(2))
    story.append(email_t)

    story += subsection("5.6 Security Architecture")
    sec_data = [
        ["Layer", "Implementation"],
        ["Session tokens", "HTTP-only cookies — not accessible to JavaScript; eliminates XSS token theft"],
        ["Passwords", "bcrypt hashed at cost factor 12"],
        ["Route protection", "Role-based middleware on every protected endpoint"],
        ["Tenant isolation", "schoolId scoped on every DB query — tenants cannot access each other's data"],
        ["Input validation", "Zod schema validation on all API inputs — rejects malformed/unexpected data"],
        ["Password reset", "Time-limited secure tokens, single-use"],
        ["Audit trail", "Every significant action logged with actor, timestamp, and change metadata"],
        ["Transport", "HTTPS enforced via Nginx; HTTP redirects to HTTPS automatically"],
    ]
    sec_t = Table(sec_data, colWidths=[48*mm, 112*mm])
    sec_t.setStyle(header_table_style(2))
    story.append(sec_t)

    # ── 6. Competitive Landscape ──────────────────────────────────────────────
    story += section_header("6", "Competitive Landscape in Kenya")

    comp_data = [
        ["Competitor", "Strengths", "Weakness vs. DiraSchool"],
        ["Zeraki", "4,000+ schools, brand recognition, analytics", "Heavy, expensive, not CBC-native from ground up"],
        ["Schoolap", "Parent communication focus", "Weak academic and fee management"],
        ["Shule Pro", "Basic attendance and fees", "No CBC report cards, limited modules"],
        ["Elimu", "Government-adjacent", "Limited private school features"],
        ["Excel + paper", "Free, familiar", "The status quo being replaced — not a real competitor"],
    ]
    comp_t = Table(comp_data, colWidths=[32*mm, 62*mm, 66*mm])
    comp_t.setStyle(header_table_style(3))
    story.append(comp_t)

    story.append(space(8))
    story += subsubsection("DiraSchool's Key Differentiators")
    diff_items = [
        "<b>CBC-native from day one</b> — grading logic, report cards, and terminology built around CBC, not retrofitted onto an older system.",
        "<b>Per-term billing</b> — aligned to when schools actually have money, not a monthly invoice during the school holidays.",
        "<b>One platform, all modules</b> — no integration headaches, one login, one support contact for the whole school.",
        "<b>Parent portal included at no extra charge</b> — most competitors charge extra for parent access.",
        "<b>Transparent audit trail</b> — every action logged; headteachers see exactly who did what and when.",
        "<b>Built entirely for Kenya</b> — KES currency, Kenyan school calendar, county fields, CBC rubric, local school terminology throughout.",
    ]
    for item in diff_items:
        story.append(b(item))

    # ── 7. Pricing ────────────────────────────────────────────────────────────
    story += section_header("7", "Pricing Structure")

    story.append(p(
        "All prices in Kenyan Shillings. <b>VAT at 16% applicable on all tiers.</b> "
        "Per-term billing is the primary model — aligned to school fee collection cycles. "
        "Monthly billing is available at a 20% premium. Annual billing offers approximately "
        "15% off (one term effectively free)."
    ))

    story += subsubsection("Per-Term Pricing (Primary Model)")
    price_data = [
        ["Plan", "Students", "Per Term\n(ex-VAT)", "Per Term\n(incl. VAT)", "Annual\n(ex-VAT)", "Annual\nSaving"],
        ["Dira Seed", "Up to 75",    "KES 6,500",  "KES 7,540",   "KES 16,500",  "~KES 3,000"],
        ["Dira Lite", "Up to 200",   "KES 12,500", "KES 14,500",  "KES 32,000",  "~KES 5,500"],
        ["Starter",   "Up to 400",   "KES 20,000", "KES 23,200",  "KES 51,000",  "~KES 9,000"],
        ["Growth",    "Up to 850",   "KES 45,000", "KES 52,200",  "KES 115,000", "~KES 20,000"],
        ["Professional","Up to 1,500","KES 75,000","KES 87,000",  "KES 190,000", "~KES 35,000"],
        ["Enterprise", "Unlimited",  "Custom",     "Custom",      "Custom",       "—"],
    ]
    ts_price = header_table_style(6)
    ts_price.add("BACKGROUND", (0, -1), (-1, -1), MID)
    ts_price.add("FONTNAME",   (0, -1), (-1, -1), "Helvetica-Bold")
    price_t = Table(price_data, colWidths=[28*mm, 24*mm, 26*mm, 27*mm, 27*mm, 28*mm])
    price_t.setStyle(ts_price)
    story.append(price_t)

    story.append(space(4))
    story.append(p(
        "<b>Trial:</b> 30 days free, up to 50 students, no credit card required. "
        "Schools upgrade to a paid plan when they are ready — no automatic billing."
    ))

    story += subsubsection("Cost Per Student Per Term")
    student_data = [
        ["Plan", "Students", "Cost per student / term", "Comparable cost"],
        ["Dira Seed",    "75",    "KES 87",  "2 exercise book pages"],
        ["Dira Lite",    "200",   "KES 63",  "Less than a biro pen"],
        ["Starter",      "400",   "KES 50",  "Less than a biro pen"],
        ["Growth",       "850",   "KES 53",  "Less than a biro pen"],
        ["Professional", "1,500", "KES 50",  "Less than a biro pen"],
    ]
    student_t = Table(student_data, colWidths=[32*mm, 28*mm, 50*mm, 50*mm])
    student_t.setStyle(header_table_style(4))
    story.append(student_t)

    story += subsubsection("DiraSchool as % of School Fee Income")
    pct_data = [
        ["Plan", "Students", "Est. Term Fee Income", "DiraSchool Cost", "As % of Income"],
        ["Dira Seed",    "75",    "KES 375K–1.1M",  "KES 6,500",  "0.6–1.7%"],
        ["Dira Lite",    "200",   "KES 1M–3M",      "KES 12,500", "0.4–1.3%"],
        ["Starter",      "400",   "KES 2M–6M",      "KES 20,000", "0.3–1.0%"],
        ["Growth",       "850",   "KES 4.25M–12.75M","KES 45,000","0.4–1.1%"],
        ["Professional", "1,500", "KES 7.5M–22.5M", "KES 75,000", "0.3–1.0%"],
    ]
    pct_t = Table(pct_data, colWidths=[28*mm, 24*mm, 44*mm, 28*mm, 36*mm])
    pct_t.setStyle(header_table_style(5))
    story.append(pct_t)
    story.append(p("* Fee income estimate: KES 5,000–15,000 per student per term depending on school type and location.",
        S("fn", fontSize=8, textColor=GREY, fontName="Helvetica")))

    # ── 8. Business Model ─────────────────────────────────────────────────────
    story += section_header("8", "Business Model Summary")

    biz_data = [
        ["Metric", "Detail"],
        ["Revenue model", "B2B SaaS, term-based subscription"],
        ["Primary billing cycle", "Per Kenyan school term (3 times per year)"],
        ["Secondary billing cycles", "Annual (15% discount) / Monthly (20% premium)"],
        ["Customer acquisition", "Direct outreach, head-teacher networks, KNUT/KUPPET, school expos"],
        ["Onboarding", "Self-service 30-day trial → sales-assisted conversion"],
        ["Support model", "WhatsApp + email support; in-app documentation (planned)"],
        ["Churn mitigation", "Term-aligned billing, sticky historical data, high switching cost"],
        ["Expansion revenue", "Automatic plan upgrades as school enrolment grows past tier limit"],
        ["Break-even point", "5–8 paying schools at Starter tier average"],
        ["Target Year 1", "30 paying schools"],
        ["Target Year 2", "100 paying schools"],
    ]
    biz_t = Table(biz_data, colWidths=[55*mm, 105*mm])
    biz_t.setStyle(header_table_style(2))
    story.append(biz_t)

    story.append(space(8))
    story += subsubsection("Revenue Projections")
    rev_data = [
        ["Schools", "Plan Mix", "Revenue / Term", "Infra / Term", "Net / Term", "Net / Year"],
        ["10",  "5 Lite + 3 Starter + 2 Growth",  "KES 218,500",   "KES 20,000",  "KES 198,500",   "KES 595,500"],
        ["20",  "Mixed across tiers",              "KES 490,000",   "KES 30,000",  "KES 460,000",   "KES 1.38M"],
        ["40",  "Mixed across tiers",              "KES 980,000",   "KES 55,000",  "KES 925,000",   "KES 2.775M"],
        ["80",  "Mixed across tiers",              "KES 1,960,000", "KES 100,000", "KES 1,860,000", "KES 5.58M"],
    ]
    ts_rev = header_table_style(6)
    ts_rev.add("BACKGROUND", (0,-1), (-1,-1), MID)
    ts_rev.add("FONTNAME",   (0,-1), (-1,-1), "Helvetica-Bold")
    rev_t = Table(rev_data, colWidths=[18*mm, 45*mm, 32*mm, 28*mm, 28*mm, 29*mm])
    rev_t.setStyle(ts_rev)
    story.append(rev_t)

    story.append(space(8))
    story += subsubsection("Invoice Timing Strategy")
    story.append(p(
        "Invoices sent two weeks before each term starts, payment due by the first day of term — "
        "when schools have just processed parent fee collections."
    ))
    inv_data = [
        ["Term", "Schools Open", "Invoice Send Date", "Payment Due"],
        ["Term 1", "~2nd week January",   "Late December",  "January 6"],
        ["Term 2", "~1st week May",        "Mid-April",      "April 28"],
        ["Term 3", "~1st week September",  "Mid-August",     "September 1"],
    ]
    inv_t = Table(inv_data, colWidths=[22*mm, 46*mm, 50*mm, 42*mm])
    inv_t.setStyle(header_table_style(4))
    story.append(inv_t)

    # ── 9. The Pitch ──────────────────────────────────────────────────────────
    story += section_header("9", "The One-Paragraph Pitch")

    pitch_data = [[Paragraph(
        "DiraSchool is the only school management system in Kenya designed from the ground up "
        "for CBC — not adapted from an older curriculum system, not a generic African school "
        "platform retrofitted with a CBC label. It handles everything a school runs: student "
        "records, daily attendance, CBC report cards with the correct 4-level and 8-point "
        "grading rubrics, fee collection, exam results, staff management, a parent portal, "
        "and a full audit trail — in one login, on any device, at a price that represents "
        "less than 1% of what the school earns in fees each term. It bills per school term "
        "because that is when schools have money, not monthly when they are in the middle of "
        "the holidays with no income.",
        S("pitch", fontSize=11, fontName="Helvetica-Bold", textColor=NAVY,
          leading=17, alignment=TA_JUSTIFY)
    )]]
    pitch_t = Table(pitch_data, colWidths=[160*mm])
    pitch_t.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (-1,-1), ACCENT),
        ("LEFTPADDING",  (0,0), (-1,-1), 16),
        ("RIGHTPADDING", (0,0), (-1,-1), 16),
        ("TOPPADDING",   (0,0), (-1,-1), 14),
        ("BOTTOMPADDING",(0,0), (-1,-1), 14),
        ("LINEAFTER",    (0,0), (0,-1),   4, TEAL),
    ]))
    story.append(pitch_t)

    # ── Final footer ──────────────────────────────────────────────────────────
    story.append(space(20))
    story.append(hr(NAVY, 1.5))
    story.append(space(4))
    story.append(p(
        "Document prepared by the DiraSchool founding team &nbsp;·&nbsp; April 2026 "
        "&nbsp;·&nbsp; Confidential",
        S("fin", fontSize=9, textColor=GREY, alignment=TA_CENTER, fontName="Helvetica")
    ))
    story.append(p(
        "For pricing strategy consultation, investor conversations, and partnership discussions.",
        S("fin2", fontSize=8.5, textColor=GREY, alignment=TA_CENTER, fontName="Helvetica")
    ))

    # ── Build ─────────────────────────────────────────────────────────────────
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f"PDF generated: {OUTPUT}")

if __name__ == "__main__":
    build()
