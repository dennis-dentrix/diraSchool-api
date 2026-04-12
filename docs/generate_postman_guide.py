"""
Generates: diraschool-postman-guide.pdf
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.platypus.flowables import Flowable
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

# ── Colour palette ────────────────────────────────────────────────────────────
NAVY      = colors.HexColor("#1e3a5f")
BLUE_MID  = colors.HexColor("#2c5282")
BLUE_LITE = colors.HexColor("#ebf4ff")
TEAL      = colors.HexColor("#2b6cb0")
CODE_BG   = colors.HexColor("#f0f4f8")
CODE_FG   = colors.HexColor("#1a202c")
BORDER    = colors.HexColor("#bee3f8")
WHITE     = colors.white
GREY_LT   = colors.HexColor("#f7fafc")
GREY_MID  = colors.HexColor("#e2e8f0")
GREY_TXT  = colors.HexColor("#4a5568")
GREEN     = colors.HexColor("#276749")
RED       = colors.HexColor("#9b2335")
ORANGE    = colors.HexColor("#c05621")

W, H = A4

# ── Styles ────────────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

def make_style(name, **kw):
    return ParagraphStyle(name, **kw)

H1 = make_style("H1", fontSize=20, textColor=NAVY, spaceAfter=6,
                fontName="Helvetica-Bold", leading=26)
H2 = make_style("H2", fontSize=14, textColor=NAVY, spaceBefore=14, spaceAfter=5,
                fontName="Helvetica-Bold", leading=18, borderPad=3)
H3 = make_style("H3", fontSize=11, textColor=BLUE_MID, spaceBefore=10, spaceAfter=3,
                fontName="Helvetica-Bold", leading=15)
H4 = make_style("H4", fontSize=10, textColor=NAVY, spaceBefore=8, spaceAfter=2,
                fontName="Helvetica-Bold", leading=13)
BODY = make_style("BODY", fontSize=9, textColor=CODE_FG, spaceAfter=4,
                  fontName="Helvetica", leading=13)
BODY_SM = make_style("BODY_SM", fontSize=8.5, textColor=GREY_TXT, spaceAfter=3,
                     fontName="Helvetica", leading=12)
CODE = make_style("CODE", fontSize=8, textColor=CODE_FG, spaceAfter=0,
                  fontName="Courier", leading=11, leftIndent=0)
BADGE_GET  = make_style("BADGE_GET",  fontSize=8, textColor=WHITE, fontName="Helvetica-Bold", leading=10)
BADGE_POST = make_style("BADGE_POST", fontSize=8, textColor=WHITE, fontName="Helvetica-Bold", leading=10)
URL_STYLE  = make_style("URL",  fontSize=9, textColor=NAVY, fontName="Courier-Bold", leading=12)
NOTE = make_style("NOTE", fontSize=8.5, textColor=ORANGE, fontName="Helvetica-Oblique",
                  spaceAfter=3, leading=12)
CENTER = make_style("CENTER", fontSize=9, alignment=TA_CENTER, fontName="Helvetica", leading=12)


# ── Custom flowables ──────────────────────────────────────────────────────────
class ColorBar(Flowable):
    def __init__(self, height=2, color=NAVY):
        super().__init__()
        self.height = height
        self.color  = color
        self.width  = W - 40*mm

    def draw(self):
        self.canv.setFillColor(self.color)
        self.canv.rect(0, 0, self.width, self.height, fill=1, stroke=0)


class CodeBlock(Flowable):
    """Renders a monospace code block with a background."""
    def __init__(self, text, available_width=None):
        super().__init__()
        self.text = text
        self.aw   = available_width or (W - 50*mm)
        self.pad  = 6
        lines     = text.split("\n")
        self.line_h = 10.5
        self.height = len(lines) * self.line_h + self.pad * 2
        self.width  = self.aw

    def draw(self):
        c = self.canv
        # background
        c.setFillColor(CODE_BG)
        c.setStrokeColor(BORDER)
        c.roundRect(0, 0, self.width, self.height, 4, fill=1, stroke=1)
        # left accent bar
        c.setFillColor(TEAL)
        c.rect(0, 0, 3, self.height, fill=1, stroke=0)
        # text
        c.setFillColor(CODE_FG)
        c.setFont("Courier", 7.8)
        lines = self.text.split("\n")
        y = self.height - self.pad - 8
        for line in lines:
            c.drawString(self.pad + 4, y, line)
            y -= self.line_h


class MethodBadge(Flowable):
    METHOD_COLORS = {
        "GET":    colors.HexColor("#276749"),
        "POST":   colors.HexColor("#2b6cb0"),
        "PATCH":  colors.HexColor("#c05621"),
        "PUT":    colors.HexColor("#553c9a"),
        "DELETE": colors.HexColor("#9b2335"),
    }

    def __init__(self, method, url, width=None):
        super().__init__()
        self.method = method
        self.url    = url
        self.width  = width or (W - 50*mm)
        self.height = 18

    def draw(self):
        c   = self.canv
        col = self.METHOD_COLORS.get(self.method, NAVY)
        # badge pill
        c.setFillColor(col)
        c.roundRect(0, 2, 42, 14, 4, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(21, 7, self.method)
        # url
        c.setFillColor(NAVY)
        c.setFont("Courier-Bold", 8.5)
        c.drawString(48, 7, self.url)


def section_header(title, subtitle=None):
    """Returns a navy banner for section headings."""
    elems = []
    elems.append(Spacer(1, 6))
    data = [[Paragraph(title, make_style("SH", fontSize=13, textColor=WHITE,
                                         fontName="Helvetica-Bold", leading=16))]]
    t = Table(data, colWidths=[W - 50*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("TOPPADDING",    (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("ROUNDEDCORNERS", [4]),
    ]))
    elems.append(t)
    if subtitle:
        elems.append(Paragraph(subtitle, BODY_SM))
    elems.append(Spacer(1, 4))
    return elems


def info_box(text, color=BLUE_LITE, border=TEAL):
    data = [[Paragraph(text, BODY_SM)]]
    t = Table(data, colWidths=[W - 50*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), color),
        ("LINEAFTER",     (0, 0), (0, -1), 3, border),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
    ]))
    return t


def make_table(headers, rows, col_widths=None):
    data = [headers] + rows
    cw   = col_widths or []
    t    = Table(data, colWidths=cw if cw else None, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR",     (0, 0), (-1, 0), WHITE),
        ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, 0), 8),
        ("TOPPADDING",    (0, 0), (-1, 0), 6),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
        ("FONTNAME",      (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE",      (0, 1), (-1, -1), 8),
        ("TOPPADDING",    (0, 1), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 4),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, GREY_LT]),
        ("GRID",           (0, 0), (-1, -1), 0.4, GREY_MID),
        ("LINEBELOW",      (0, 0), (-1, 0), 1.5, TEAL),
        ("VALIGN",         (0, 0), (-1, -1), "TOP"),
    ]))
    return t


def endpoint(method, path, body_json=None, expected=None, verify=None,
             script=None, note=None, base="{{base_url}}"):
    """Returns a list of flowables for one endpoint entry."""
    elems = []
    elems.append(MethodBadge(method, f"{base}{path}"))
    elems.append(Spacer(1, 4))

    if note:
        elems.append(Paragraph(f"<i>{note}</i>", NOTE))

    if body_json:
        elems.append(Paragraph("Request body (JSON):", BODY_SM))
        elems.append(CodeBlock(body_json))
        elems.append(Spacer(1, 3))

    info_rows = []
    if expected: info_rows.append(["Expected status:", expected])
    if verify:   info_rows.append(["Verify:", verify])

    if info_rows:
        t = Table(info_rows, colWidths=[85, W - 50*mm - 85])
        t.setStyle(TableStyle([
            ("FONTNAME",  (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTNAME",  (1, 0), (1, -1), "Helvetica"),
            ("FONTSIZE",  (0, 0), (-1, -1), 8),
            ("TEXTCOLOR", (0, 0), (0, -1), GREY_TXT),
            ("TOPPADDING",    (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ]))
        elems.append(t)

    if script:
        elems.append(Paragraph("Auto-save script (Tests tab):", BODY_SM))
        elems.append(CodeBlock(script))

    elems.append(Spacer(1, 8))
    elems.append(HRFlowable(width="100%", thickness=0.5, color=GREY_MID))
    elems.append(Spacer(1, 4))
    return elems


def ep_title(num, title):
    return [Paragraph(f"{num}  {title}", H4)]


# ── Cover page ────────────────────────────────────────────────────────────────
def cover(story):
    story.append(Spacer(1, 30*mm))

    # Big navy block
    data = [[
        Paragraph("DIRASCHOOL API", make_style("CV1", fontSize=28, textColor=WHITE,
                   fontName="Helvetica-Bold", alignment=TA_CENTER, leading=34)),
        ],[
        Paragraph("Postman Testing Guide", make_style("CV2", fontSize=16, textColor=BLUE_LITE,
                   fontName="Helvetica", alignment=TA_CENTER, leading=20)),
        ],[
        Paragraph("Complete endpoint verification for all 17 feature modules",
                  make_style("CV3", fontSize=11, textColor=GREY_MID,
                             fontName="Helvetica-Oblique", alignment=TA_CENTER, leading=15)),
    ]]
    t = Table(data, colWidths=[W - 40*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), NAVY),
        ("TOPPADDING",    (0, 0), (-1, 0), 22),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
        ("TOPPADDING",    (0, 1), (-1, 1), 6),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 6),
        ("TOPPADDING",    (0, 2), (-1, 2), 6),
        ("BOTTOMPADDING", (0, 2), (-1, 2), 22),
        ("LEFTPADDING",   (0, 0), (-1, -1), 18),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 18),
    ]))
    story.append(t)
    story.append(Spacer(1, 10*mm))

    # Stats strip
    stats = [["85+", "Endpoints", "17", "Modules", "3", "User Roles"]]
    st = Table(stats, colWidths=[(W - 40*mm)/6]*6)
    st.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), BLUE_LITE),
        ("FONTNAME",      (0, 0), (0, 0),  "Helvetica-Bold"),
        ("FONTNAME",      (2, 0), (2, 0),  "Helvetica-Bold"),
        ("FONTNAME",      (4, 0), (4, 0),  "Helvetica-Bold"),
        ("FONTNAME",      (1, 0), (1, 0),  "Helvetica"),
        ("FONTNAME",      (3, 0), (3, 0),  "Helvetica"),
        ("FONTNAME",      (5, 0), (5, 0),  "Helvetica"),
        ("FONTSIZE",      (0, 0), (0, 0),  16),
        ("FONTSIZE",      (2, 0), (2, 0),  16),
        ("FONTSIZE",      (4, 0), (4, 0),  16),
        ("FONTSIZE",      (1, 0), (1, 0),  9),
        ("FONTSIZE",      (3, 0), (3, 0),  9),
        ("FONTSIZE",      (5, 0), (5, 0),  9),
        ("TEXTCOLOR",     (0, 0), (0, 0),  NAVY),
        ("TEXTCOLOR",     (2, 0), (2, 0),  NAVY),
        ("TEXTCOLOR",     (4, 0), (4, 0),  NAVY),
        ("TEXTCOLOR",     (1, 0), (1, 0),  GREY_TXT),
        ("TEXTCOLOR",     (3, 0), (3, 0),  GREY_TXT),
        ("TEXTCOLOR",     (5, 0), (5, 0),  GREY_TXT),
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("LINEAFTER",     (0, 0), (0, 0), 1, GREY_MID),
        ("LINEAFTER",     (1, 0), (1, 0), 1, GREY_MID),
        ("LINEAFTER",     (2, 0), (2, 0), 1, GREY_MID),
        ("LINEAFTER",     (3, 0), (3, 0), 1, GREY_MID),
        ("LINEAFTER",     (4, 0), (4, 0), 1, GREY_MID),
    ]))
    story.append(st)
    story.append(Spacer(1, 8*mm))

    meta = Table([
        ["Version:", "1.0"],
        ["Date:",    "April 2026"],
        ["Stack:",   "Node.js 20 · Express · MongoDB 7 · Redis (Upstash) · BullMQ"],
        ["Base URL (dev):", "http://localhost:3000"],
    ], colWidths=[70, W - 40*mm - 70])
    meta.setStyle(TableStyle([
        ("FONTNAME",  (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME",  (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE",  (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), GREY_TXT),
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(meta)
    story.append(PageBreak())


# ── Table of Contents ─────────────────────────────────────────────────────────
def toc(story):
    story += section_header("Table of Contents")
    toc_items = [
        ("1", "Environment Setup",            "Postman variables, auth, pre-request scripts"),
        ("2", "Testing Order",                "Dependency flow — run requests in this sequence"),
        ("3", "Health Check",                 "Server liveness probe"),
        ("4", "Auth  /api/v1/auth",           "Register, Login, Me, Change Password, Logout"),
        ("5", "Users  /api/v1/users",         "Create, List, Update, Reset Password"),
        ("6", "Classes  /api/v1/classes",     "CRUD + Promote"),
        ("7", "Students  /api/v1/students",   "Enroll, Transfer, Withdraw, Import"),
        ("8", "Subjects  /api/v1/subjects",   "CRUD + Assign Teacher"),
        ("9", "Attendance  /api/v1/attendance","Registers — Create, Update, Submit"),
        ("10","Exams  /api/v1/exams",         "CRUD"),
        ("11","Results  /api/v1/results",     "Bulk Upsert, List, Update"),
        ("12","Fees  /api/v1/fees",           "Structures, Payments, Balance, Reverse"),
        ("13","Report Cards  /api/v1/report-cards","Generate, Remarks, Publish, Annual Summary"),
        ("14","Settings  /api/v1/settings",   "School config, Terms, Holidays"),
        ("15","Timetable  /api/v1/timetables","Create, Slots, Role access"),
        ("16","Library  /api/v1/library",     "Books, Loans, Return, Overdue"),
        ("17","Transport  /api/v1/transport", "Routes, Assign/Unassign Students"),
        ("18","Parent Portal  /api/v1/parent","Children, Fees, Attendance, Results, Report Cards"),
        ("19","Audit Logs  /api/v1/audit-logs","Filter by resource, action, user, date"),
        ("20","Superadmin  /api/v1/schools",  "Multi-tenant school management, Subscriptions"),
        ("21","Error Cases",                  "Expected failure scenarios and status codes"),
        ("22","Collection Structure",         "Recommended Postman folder layout"),
        ("23","Railway Production Testing",   "Smoke test sequence for live deployment"),
    ]
    rows = [[Paragraph(n, BODY_SM), Paragraph(t, BODY), Paragraph(d, BODY_SM)]
            for n, t, d in toc_items]
    t = Table(rows, colWidths=[18, 145, W - 40*mm - 163])
    t.setStyle(TableStyle([
        ("FONTSIZE",      (0, 0), (-1, -1), 8.5),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 4),
        ("ROWBACKGROUNDS",(0, 0), (-1, -1), [WHITE, GREY_LT]),
        ("GRID",          (0, 0), (-1, -1), 0.3, GREY_MID),
        ("TEXTCOLOR",     (0, 0), (0, -1), TEAL),
        ("FONTNAME",      (0, 0), (0, -1), "Helvetica-Bold"),
    ]))
    story.append(t)
    story.append(PageBreak())


# ── Section 1: Environment Setup ──────────────────────────────────────────────
def s1_env(story):
    story += section_header("Section 1 — Environment Setup",
                            "Configure Postman before running any requests")

    story.append(Paragraph("Step 1: Create a new Environment", H3))
    story.append(Paragraph(
        "In Postman click <b>Environments → +</b> and name it <b>Diraschool Dev</b>. "
        "Add each variable below. Variables marked <i>auto-filled</i> are populated by "
        "test scripts on the relevant requests — leave their initial values empty.", BODY))
    story.append(Spacer(1, 4))

    env_rows = [
        [Paragraph(v, make_style("VN", fontName="Courier", fontSize=8, textColor=TEAL, leading=11)),
         Paragraph(iv, BODY_SM),
         Paragraph(d,  BODY_SM)]
        for v, iv, d in [
            ("base_url",       "http://localhost:3000", "Switch to Railway URL for prod testing"),
            ("token",          "(empty)",               "Auto-filled by Login / Register"),
            ("parentToken",    "(empty)",               "Auto-filled when logging in as parent"),
            ("superToken",     "(empty)",               "Auto-filled when logging in as superadmin"),
            ("schoolId",       "(empty)",               "Auto-filled by Register School"),
            ("adminId",        "(empty)",               "Auto-filled by Register School"),
            ("userId",         "(empty)",               "Auto-filled by Create Teacher"),
            ("classId",        "(empty)",               "Auto-filled by Create Class"),
            ("targetClassId",  "(empty)",               "Auto-filled by Create Second Class"),
            ("studentId",      "(empty)",               "Auto-filled by Enroll Student"),
            ("studentId2",     "(empty)",               "Auto-filled by Enroll Second Student"),
            ("subjectId",      "(empty)",               "Auto-filled by Create Subject"),
            ("subjectId2",     "(empty)",               "Auto-filled by Create Second Subject"),
            ("examId",         "(empty)",               "Auto-filled by Create Exam"),
            ("registerId",     "(empty)",               "Auto-filled by Create Attendance Register"),
            ("resultId",       "(empty)",               "Auto-filled by Bulk Upsert Results"),
            ("feeStructureId", "(empty)",               "Auto-filled by Create Fee Structure"),
            ("paymentId",      "(empty)",               "Auto-filled by Record Payment"),
            ("reportCardId",   "(empty)",               "Auto-filled by Generate Report Card"),
            ("timetableId",    "(empty)",               "Auto-filled by Create Timetable"),
            ("bookId",         "(empty)",               "Auto-filled by Add Book"),
            ("loanId",         "(empty)",               "Auto-filled by Issue Loan"),
            ("routeId",        "(empty)",               "Auto-filled by Create Route"),
            ("holidayId",      "(empty)",               "Auto-filled by Add Holiday"),
        ]
    ]
    hdrs = [Paragraph(h, make_style("TH", fontName="Helvetica-Bold", fontSize=8,
                                     textColor=WHITE, leading=11))
            for h in ["Variable", "Initial Value", "Description"]]
    t = make_table(hdrs, env_rows, [90, 70, W - 40*mm - 160])
    story.append(t)
    story.append(Spacer(1, 8))

    story.append(Paragraph("Step 2: Set Collection-level Authorization", H3))
    story.append(Paragraph(
        "Open the Collection → <b>Authorization</b> tab → Type: <b>Bearer Token</b> → "
        "Token: <code>{{token}}</code>. All requests inherit this automatically. "
        "For parent/superadmin tests, override at the request level.", BODY))
    story.append(Spacer(1, 6))

    story.append(Paragraph("Step 3: Collection-level Pre-request Script", H3))
    story.append(Paragraph("Not required — ID saving is done per-request in the Tests tab (see scripts below).", BODY))
    story.append(Spacer(1, 4))

    story.append(Paragraph("Standard auto-save pattern (paste in Tests tab of each relevant request):", BODY_SM))
    story.append(CodeBlock(
        'const res = pm.response.json();\n'
        '// Replace the keys below with what the response actually returns:\n'
        'if (res.token)   pm.environment.set("token",   res.token);\n'
        'if (res.school)  pm.environment.set("schoolId",res.school._id);\n'
        'if (res.user)    pm.environment.set("adminId", res.user._id);'
    ))
    story.append(Spacer(1, 6))

    story.append(info_box(
        "<b>Tip:</b> Use the Postman Runner (Collection Runner) with the requests in order to "
        "execute all tests automatically and see pass/fail results in one view."
    ))
    story.append(PageBreak())


# ── Section 2: Testing Order ──────────────────────────────────────────────────
def s2_order(story):
    story += section_header("Section 2 — Testing Order",
                            "Run requests in this exact sequence — later tests depend on IDs from earlier ones")

    story.append(Paragraph(
        "Each request stores IDs (schoolId, classId, studentId …) into the Postman environment "
        "via the Tests tab script. If you skip a step, the variables it sets will be empty and "
        "downstream requests will fail with 404 or validation errors.", BODY))
    story.append(Spacer(1, 6))

    order_rows = [
        ["0",  "Health Check",              "Confirm server, MongoDB, Redis are all up"],
        ["1",  "Register School",           "Creates school + admin. Saves token, schoolId, adminId"],
        ["2",  "Login",                     "Re-authenticates. Refreshes token"],
        ["3",  "Get Settings",              "Auto-creates default school settings"],
        ["4",  "Update Settings",           "Configure terms, working days, school times"],
        ["5",  "Create Class (Grade 4)",    "Saves classId"],
        ["6",  "Create Class (Grade 5)",    "Saves targetClassId — used for promote & transfer"],
        ["7",  "Create Teacher User",       "Saves userId"],
        ["8",  "Create Accountant User",    "Secondary staff member"],
        ["9",  "Create Subject (Maths)",    "Saves subjectId"],
        ["10", "Create Subject (English)",  "Saves subjectId2"],
        ["11", "Assign Teacher to Subject", "Links userId to subjectId"],
        ["12", "Enroll Student (Alice)",    "Saves studentId"],
        ["13", "Enroll Student (Brian)",    "Saves studentId2"],
        ["14", "Create Exam",               "Saves examId"],
        ["15", "Create Attendance Register","Saves registerId"],
        ["16", "Submit Attendance",         "Locks the register"],
        ["17", "Bulk Upsert Results",       "Saves resultId"],
        ["18", "Create Fee Structure",      "Saves feeStructureId"],
        ["19", "Record Payment",            "Saves paymentId"],
        ["20", "Generate Report Card",      "Saves reportCardId"],
        ["21", "Publish Report Card",       "Makes visible to parent"],
        ["22", "Create Timetable",          "Saves timetableId"],
        ["23", "Update Timetable Slots",    "Fills in the weekly schedule"],
        ["24", "Add Book to Library",       "Saves bookId"],
        ["25", "Issue Book Loan",           "Saves loanId"],
        ["26", "Return Book",               "Restores availableCopies"],
        ["27", "Create Transport Route",    "Saves routeId"],
        ["28", "Assign Student to Route",   "Links studentId to routeId"],
        ["29", "Create Parent User",        "Must have linkedStudentIds set"],
        ["30", "Login as Parent",           "Save token as parentToken manually"],
        ["31", "Parent Portal tests",       "Verify read-only child access"],
        ["32", "Audit Log queries",         "Review trail of all above actions"],
        ["33", "Superadmin routes",         "Requires SUPERADMIN role — see Section 20"],
        ["34", "Error cases",               "Negative tests — wrong passwords, 403s, 422s"],
    ]
    rows = [[Paragraph(n, make_style("ON", fontName="Helvetica-Bold", fontSize=8,
                                     textColor=WHITE, leading=11, alignment=TA_CENTER)),
             Paragraph(t, BODY),
             Paragraph(d, BODY_SM)]
            for n, t, d in order_rows]

    # colour-code the step number cells
    t = Table(rows, colWidths=[20, 130, W - 40*mm - 150], repeatRows=0)
    cell_styles = [
        ("BACKGROUND",    (0, 0), (0, -1), TEAL),
        ("ALIGN",         (0, 0), (0, -1), "CENTER"),
        ("FONTNAME",      (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE",      (0, 0), (-1, -1), 8),
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING",   (0, 0), (-1, -1), 5),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 5),
        ("ROWBACKGROUNDS",(1, 0), (-1, -1), [WHITE, GREY_LT]),
        ("GRID",          (0, 0), (-1, -1), 0.3, GREY_MID),
    ]
    t.setStyle(TableStyle(cell_styles))
    story.append(t)
    story.append(PageBreak())


# ── Helper: endpoint group header ─────────────────────────────────────────────
def grp(story, num, title, mount, description):
    story.append(Spacer(1, 4))
    data = [[
        Paragraph(f"{num}. {title}", make_style("GH", fontSize=12, textColor=WHITE,
                   fontName="Helvetica-Bold", leading=15)),
        Paragraph(mount, make_style("GM", fontSize=9, textColor=BLUE_LITE,
                   fontName="Courier", leading=12, alignment=TA_RIGHT)),
    ]]
    t = Table(data, colWidths=[W*0.55 - 25*mm, W*0.45 - 25*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), BLUE_MID),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(t)
    story.append(Paragraph(description, BODY_SM))
    story.append(Spacer(1, 4))


# ═══════════════════════════════════════════════════════════════════════════════
# Section 3 — All Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

def s3_health(story):
    story += section_header("Section 3 — Endpoints & Tests")
    grp(story, "0", "Health Check", "GET /health",
        "Always run this first. Confirms API, MongoDB, and Redis are reachable.")
    story += ep_title("0.1", "Server Health")
    story += endpoint("GET", "/health",
        expected="200 OK",
        verify='{ "status": "ok", "services": { "api": "up", "mongodb": "up", "redis": "up|degraded" } }')


def s3_auth(story):
    grp(story, "1", "Auth", "/api/v1/auth",
        "Rate-limited (20 req / 15 min). Registration creates the school + first admin atomically.")

    story += ep_title("1.1", "Register School — creates school + SCHOOL_ADMIN user")
    story += endpoint("POST", "/api/v1/auth/register",
        body_json=(
            '{\n'
            '  "schoolName":    "Sunrise Academy",\n'
            '  "schoolEmail":   "admin@sunrise.ac.ke",\n'
            '  "schoolPhone":   "+254700000001",\n'
            '  "county":        "Nairobi",\n'
            '  "adminName":     "John Kamau",\n'
            '  "adminEmail":    "john@sunrise.ac.ke",\n'
            '  "adminPassword": "Admin@1234!",\n'
            '  "adminPhone":    "+254700000002"\n'
            '}'
        ),
        expected="201 Created",
        verify="Response contains token, school._id, user._id",
        script=(
            'const res = pm.response.json();\n'
            'pm.environment.set("token",    res.token);\n'
            'pm.environment.set("schoolId", res.school._id);\n'
            'pm.environment.set("adminId",  res.user._id);'
        ))

    story += ep_title("1.2", "Login")
    story += endpoint("POST", "/api/v1/auth/login",
        body_json='{\n  "email":    "john@sunrise.ac.ke",\n  "password": "Admin@1234!"\n}',
        expected="200 OK",
        verify="token returned in response body",
        script='const res = pm.response.json();\npm.environment.set("token", res.token);')

    story += ep_title("1.3", "Get Current User")
    story += endpoint("GET", "/api/v1/auth/me",
        expected="200 OK",
        verify="user.role === SCHOOL_ADMIN, schoolId matches {{schoolId}}")

    story += ep_title("1.4", "Change Password")
    story += endpoint("POST", "/api/v1/auth/change-password",
        body_json='{\n  "currentPassword": "Admin@1234!",\n  "newPassword":     "Admin@5678!"\n}',
        expected="200 OK",
        verify="Success message. Re-login with new password to confirm.",
        note="After changing password, update your login body and re-run 1.2 to refresh the token.")

    story += ep_title("1.5", "Logout")
    story += endpoint("POST", "/api/v1/auth/logout",
        expected="200 OK",
        verify="Clears httpOnly cookie (check response headers)")

    story += ep_title("1.6", "Wrong Password (negative test)")
    story += endpoint("POST", "/api/v1/auth/login",
        body_json='{\n  "email":    "john@sunrise.ac.ke",\n  "password": "wrongpassword"\n}',
        expected="401 Unauthorized",
        verify='{ "message": "Invalid credentials" }')

    story += ep_title("1.7", "Rate Limit Test")
    story += endpoint("POST", "/api/v1/auth/login",
        note="Send this request 21 times in quick succession (use Postman Runner with 21 iterations).",
        expected="429 Too Many Requests on the 21st attempt",
        verify="Retry-After header present")


def s3_users(story):
    grp(story, "2", "Users", "/api/v1/users",
        "Admin-only. All roles: SCHOOL_ADMIN, DIRECTOR, HEADTEACHER, DEPUTY_HEADTEACHER, "
        "TEACHER, SECRETARY, ACCOUNTANT, PARENT. New users get a temp password.")

    story += ep_title("2.1", "Create Teacher User")
    story += endpoint("POST", "/api/v1/users",
        body_json=(
            '{\n'
            '  "name":    "Mary Wanjiku",\n'
            '  "email":   "mary@sunrise.ac.ke",\n'
            '  "phone":   "+254711000001",\n'
            '  "role":    "TEACHER",\n'
            '  "staffId": "TCH-001"\n'
            '}'
        ),
        expected="201 Created",
        verify="user._id present, mustChangePassword: true",
        script='pm.environment.set("userId", pm.response.json().user._id);')

    story += ep_title("2.2", "Create Accountant User")
    story += endpoint("POST", "/api/v1/users",
        body_json=(
            '{\n'
            '  "name":    "Peter Otieno",\n'
            '  "email":   "peter@sunrise.ac.ke",\n'
            '  "phone":   "+254711000002",\n'
            '  "role":    "ACCOUNTANT",\n'
            '  "staffId": "ACC-001"\n'
            '}'
        ),
        expected="201 Created",
        verify="temporaryPassword returned — share with the user to log in for the first time")

    story += ep_title("2.3", "List Users")
    story += endpoint("GET", "/api/v1/users",
        expected="200 OK",
        verify="Array contains admin + teacher + accountant")

    story += ep_title("2.4", "Get Single User")
    story += endpoint("GET", "/api/v1/users/{{userId}}",
        expected="200 OK", verify="user.role === TEACHER")

    story += ep_title("2.5", "Update User")
    story += endpoint("PATCH", "/api/v1/users/{{userId}}",
        body_json='{\n  "name":  "Mary Wanjiku Ngugi",\n  "phone": "+254711000099"\n}',
        expected="200 OK", verify="updated name reflected in response")

    story += ep_title("2.6", "Reset User Password (admin)")
    story += endpoint("POST", "/api/v1/users/{{userId}}/reset-password",
        expected="200 OK", verify="New temporaryPassword returned")

    story += ep_title("2.7", "Role Guard — Teacher Cannot List Users")
    story += endpoint("GET", "/api/v1/users",
        note="First login as mary@sunrise.ac.ke (use her temp password), save her token. Then send this with her token in Authorization.",
        expected="403 Forbidden",
        verify='{ "message": "Forbidden" }')


def s3_classes(story):
    grp(story, "3", "Classes", "/api/v1/classes",
        "Admin-only CRUD. academicYear is a string (e.g. '2026'). "
        "Promote moves all enrolled students to another class.")

    story += ep_title("3.1", "Create Class (Grade 4)")
    story += endpoint("POST", "/api/v1/classes",
        body_json=(
            '{\n'
            '  "name":         "Grade 4 North",\n'
            '  "grade":        "Grade 4",\n'
            '  "stream":       "North",\n'
            '  "capacity":     40,\n'
            '  "academicYear": "2026"\n'
            '}'
        ),
        expected="201 Created",
        script='pm.environment.set("classId", pm.response.json().class._id);')

    story += ep_title("3.2", "Create Class (Grade 5 — promote target)")
    story += endpoint("POST", "/api/v1/classes",
        body_json='{\n  "name": "Grade 5 North", "grade": "Grade 5",\n  "stream": "North", "capacity": 40, "academicYear": "2027"\n}',
        expected="201 Created",
        script='pm.environment.set("targetClassId", pm.response.json().class._id);')

    story += ep_title("3.3", "List Classes")
    story += endpoint("GET", "/api/v1/classes", expected="200 OK",
        verify="Array of 2 classes")

    story += ep_title("3.4", "List with Filters")
    story += endpoint("GET", "/api/v1/classes?grade=Grade%204&academicYear=2026",
        expected="200 OK", verify="Only Grade 4 class returned")

    story += ep_title("3.5", "Get Single Class")
    story += endpoint("GET", "/api/v1/classes/{{classId}}", expected="200 OK")

    story += ep_title("3.6", "Update Class")
    story += endpoint("PATCH", "/api/v1/classes/{{classId}}",
        body_json='{\n  "capacity": 45\n}', expected="200 OK")

    story += ep_title("3.7", "Promote Class")
    story += endpoint("POST", "/api/v1/classes/{{classId}}/promote",
        body_json='{\n  "targetClassId": "{{targetClassId}}"\n}',
        expected="200 OK",
        verify="Students in classId are now moved to targetClassId")


def s3_students(story):
    grp(story, "4", "Students", "/api/v1/students",
        "Enrollment is per-class. admissionNumber must be unique within the school. "
        "Withdraw and Transfer change student status.")

    story += ep_title("4.1", "Enroll Student — Alice Mutua")
    story += endpoint("POST", "/api/v1/students",
        body_json=(
            '{\n'
            '  "firstName":            "Alice",\n'
            '  "lastName":             "Mutua",\n'
            '  "admissionNumber":      "ADM-001",\n'
            '  "dateOfBirth":          "2016-03-15",\n'
            '  "gender":               "female",\n'
            '  "classId":              "{{classId}}",\n'
            '  "guardianName":         "Grace Mutua",\n'
            '  "guardianPhone":        "+254722000001",\n'
            '  "guardianRelationship": "mother"\n'
            '}'
        ),
        expected="201 Created",
        script='pm.environment.set("studentId", pm.response.json().student._id);')

    story += ep_title("4.2", "Enroll Student — Brian Ochieng")
    story += endpoint("POST", "/api/v1/students",
        body_json=(
            '{\n'
            '  "firstName":            "Brian",\n'
            '  "lastName":             "Ochieng",\n'
            '  "admissionNumber":      "ADM-002",\n'
            '  "dateOfBirth":          "2016-07-22",\n'
            '  "gender":               "male",\n'
            '  "classId":              "{{classId}}",\n'
            '  "guardianName":         "John Ochieng",\n'
            '  "guardianPhone":        "+254733000001",\n'
            '  "guardianRelationship": "father"\n'
            '}'
        ),
        expected="201 Created",
        script='pm.environment.set("studentId2", pm.response.json().student._id);')

    story += ep_title("4.3", "List Students")
    story += endpoint("GET", "/api/v1/students", expected="200 OK")

    story += ep_title("4.4", "Filter by Class")
    story += endpoint("GET", "/api/v1/students?classId={{classId}}", expected="200 OK",
        verify="Only students in Grade 4 North returned")

    story += ep_title("4.5", "Get Student")
    story += endpoint("GET", "/api/v1/students/{{studentId}}", expected="200 OK")

    story += ep_title("4.6", "Update Student")
    story += endpoint("PATCH", "/api/v1/students/{{studentId}}",
        body_json='{\n  "guardianPhone": "+254722000099"\n}', expected="200 OK")

    story += ep_title("4.7", "Transfer Student to Another Class")
    story += endpoint("POST", "/api/v1/students/{{studentId2}}/transfer",
        body_json='{\n  "classId": "{{targetClassId}}",\n  "reason":  "Stream reassignment"\n}',
        expected="200 OK",
        verify="student.classId updated to targetClassId")

    story += ep_title("4.8", "Withdraw Student")
    story += endpoint("POST", "/api/v1/students/{{studentId2}}/withdraw",
        body_json='{\n  "reason": "Family relocation"\n}',
        expected="200 OK",
        verify="student.status === withdrawn")

    story += ep_title("4.9", "Duplicate Admission Number (negative)")
    story += endpoint("POST", "/api/v1/students",
        body_json='{\n  "admissionNumber": "ADM-001",  "firstName": "Test", ...\n}',
        expected="409 Conflict",
        verify='"Admission number already exists"')


def s3_subjects(story):
    grp(story, "5", "Subjects", "/api/v1/subjects",
        "Subjects belong to a class. A teacher can be assigned to handle a subject.")

    story += ep_title("5.1", "Create Subject — Mathematics")
    story += endpoint("POST", "/api/v1/subjects",
        body_json='{\n  "name": "Mathematics", "code": "MATH",\n  "classId": "{{classId}}", "isCompulsory": true\n}',
        expected="201 Created",
        script='pm.environment.set("subjectId", pm.response.json().subject._id);')

    story += ep_title("5.2", "Create Subject — English")
    story += endpoint("POST", "/api/v1/subjects",
        body_json='{\n  "name": "English", "code": "ENG",\n  "classId": "{{classId}}", "isCompulsory": true\n}',
        expected="201 Created",
        script='pm.environment.set("subjectId2", pm.response.json().subject._id);')

    story += ep_title("5.3", "Assign Teacher to Subject")
    story += endpoint("PATCH", "/api/v1/subjects/{{subjectId}}/teacher",
        body_json='{\n  "teacherId": "{{userId}}"\n}',
        expected="200 OK", verify="subject.teacherId === userId")

    story += ep_title("5.4", "List Subjects (filtered by class)")
    story += endpoint("GET", "/api/v1/subjects?classId={{classId}}", expected="200 OK")

    story += ep_title("5.5", "Get Subject")
    story += endpoint("GET", "/api/v1/subjects/{{subjectId}}", expected="200 OK")

    story += ep_title("5.6", "Update Subject")
    story += endpoint("PATCH", "/api/v1/subjects/{{subjectId}}",
        body_json='{\n  "name": "Mathematics & Numeracy"\n}', expected="200 OK")


def s3_attendance(story):
    grp(story, "6", "Attendance", "/api/v1/attendance",
        "A Register covers one class, one date, one session. Submitted registers are locked.")

    story += ep_title("6.1", "Create Attendance Register")
    story += endpoint("POST", "/api/v1/attendance/registers",
        body_json=(
            '{\n'
            '  "classId": "{{classId}}",\n'
            '  "date":    "2026-04-14",\n'
            '  "session": "morning",\n'
            '  "records": [\n'
            '    { "studentId": "{{studentId}}",  "status": "present" },\n'
            '    { "studentId": "{{studentId2}}", "status": "absent", "note": "Sick" }\n'
            '  ]\n'
            '}'
        ),
        expected="201 Created",
        script='pm.environment.set("registerId", pm.response.json().register._id);')

    story += ep_title("6.2", "Get Register")
    story += endpoint("GET", "/api/v1/attendance/registers/{{registerId}}", expected="200 OK")

    story += ep_title("6.3", "Update Register (correct a record)")
    story += endpoint("PATCH", "/api/v1/attendance/registers/{{registerId}}",
        body_json=(
            '{\n'
            '  "records": [\n'
            '    { "studentId": "{{studentId}}",  "status": "present" },\n'
            '    { "studentId": "{{studentId2}}", "status": "late", "note": "Arrived 9:30am" }\n'
            '  ]\n'
            '}'
        ),
        expected="200 OK")

    story += ep_title("6.4", "Submit Register (locks it)")
    story += endpoint("POST", "/api/v1/attendance/registers/{{registerId}}/submit",
        expected="200 OK",
        verify="register.submitted === true; further PATCH attempts should return 400")

    story += ep_title("6.5", "List Registers")
    story += endpoint("GET", "/api/v1/attendance/registers?classId={{classId}}&from=2026-04-01&to=2026-04-30",
        expected="200 OK")


def s3_exams(story):
    grp(story, "7", "Exams", "/api/v1/exams",
        "Exams span one or more classes. Results are linked to an examId.")

    story += ep_title("7.1", "Create Exam")
    story += endpoint("POST", "/api/v1/exams",
        body_json=(
            '{\n'
            '  "name":         "Term 1 Mid-Term Exam",\n'
            '  "term":         "Term 1",\n'
            '  "academicYear": "2026",\n'
            '  "startDate":    "2026-04-20",\n'
            '  "endDate":      "2026-04-25",\n'
            '  "classIds":     ["{{classId}}"]\n'
            '}'
        ),
        expected="201 Created",
        script='pm.environment.set("examId", pm.response.json().exam._id);')

    story += ep_title("7.2", "List Exams")
    story += endpoint("GET", "/api/v1/exams?academicYear=2026", expected="200 OK")

    story += ep_title("7.3", "Get Exam")
    story += endpoint("GET", "/api/v1/exams/{{examId}}", expected="200 OK")

    story += ep_title("7.4", "Update Exam")
    story += endpoint("PATCH", "/api/v1/exams/{{examId}}",
        body_json='{\n  "name": "Term 1 Mid-Term Examinations"\n}', expected="200 OK")

    story += ep_title("7.5", "Delete Exam")
    story += endpoint("DELETE", "/api/v1/exams/{{examId}}",
        note="Only delete if no results are linked. Re-create (7.1) if you delete here.",
        expected="200 OK")


def s3_results(story):
    grp(story, "8", "Results", "/api/v1/results",
        "Bulk upsert is idempotent — same (studentId + subjectId + examId) updates, never duplicates.")

    story += ep_title("8.1", "Bulk Upsert Results")
    story += endpoint("POST", "/api/v1/results/bulk",
        body_json=(
            '{\n'
            '  "examId": "{{examId}}",\n'
            '  "results": [\n'
            '    {\n'
            '      "studentId": "{{studentId}}",\n'
            '      "subjectId": "{{subjectId}}",\n'
            '      "marks":     85,\n'
            '      "maxMarks":  100,\n'
            '      "grade":     "A",\n'
            '      "remarks":   "Excellent work"\n'
            '    },\n'
            '    {\n'
            '      "studentId": "{{studentId}}",\n'
            '      "subjectId": "{{subjectId2}}",\n'
            '      "marks":     72,\n'
            '      "maxMarks":  100,\n'
            '      "grade":     "B",\n'
            '      "remarks":   "Good effort"\n'
            '    }\n'
            '  ]\n'
            '}'
        ),
        expected="200 OK",
        script='pm.environment.set("resultId", pm.response.json().results[0]._id);')

    story += ep_title("8.2", "List Results (filtered)")
    story += endpoint("GET", "/api/v1/results?studentId={{studentId}}&examId={{examId}}",
        expected="200 OK", verify="2 results for Alice")

    story += ep_title("8.3", "Get Single Result")
    story += endpoint("GET", "/api/v1/results/{{resultId}}", expected="200 OK")

    story += ep_title("8.4", "Update Result")
    story += endpoint("PATCH", "/api/v1/results/{{resultId}}",
        body_json='{\n  "marks": 87, "remarks": "Reviewed — excellent work"\n}',
        expected="200 OK")

    story += ep_title("8.5", "Idempotency Check — Re-run Bulk Upsert")
    story += endpoint("POST", "/api/v1/results/bulk",
        note="Send the same body as 8.1 with marks changed to 90. Verify no new documents created — the existing ones should be updated.",
        body_json='{\n  "examId": "{{examId}}",\n  "results": [{ "studentId": "{{studentId}}", "subjectId": "{{subjectId}}", "marks": 90, "grade": "A" }]\n}',
        expected="200 OK",
        verify="GET /results?studentId=... still returns 2 docs (not 3)")


def s3_fees(story):
    grp(story, "9", "Fees", "/api/v1/fees",
        "Fee Structures define what is charged per class per term. "
        "Payments record actual money received. Balance endpoint computes the outstanding amount.")

    story += ep_title("9.1", "Create Fee Structure")
    story += endpoint("POST", "/api/v1/fees/structures",
        body_json=(
            '{\n'
            '  "name":         "Grade 4 Term 1 2026",\n'
            '  "classId":      "{{classId}}",\n'
            '  "term":         "Term 1",\n'
            '  "academicYear": "2026",\n'
            '  "items": [\n'
            '    { "name": "Tuition",  "amount": 15000 },\n'
            '    { "name": "Lunch",    "amount":  5000 },\n'
            '    { "name": "Activity", "amount":  2000 }\n'
            '  ]\n'
            '}'
        ),
        expected="201 Created",
        script='pm.environment.set("feeStructureId", pm.response.json().structure._id);')

    story += ep_title("9.2", "List Fee Structures")
    story += endpoint("GET", "/api/v1/fees/structures?classId={{classId}}", expected="200 OK")

    story += ep_title("9.3", "Get Fee Structure")
    story += endpoint("GET", "/api/v1/fees/structures/{{feeStructureId}}", expected="200 OK",
        verify="totalAmount = 22000 (sum of items)")

    story += ep_title("9.4", "Update Fee Structure")
    story += endpoint("PATCH", "/api/v1/fees/structures/{{feeStructureId}}",
        body_json='{\n  "items": [\n    { "name": "Tuition", "amount": 16000 },\n    { "name": "Lunch", "amount": 5000 },\n    { "name": "Activity", "amount": 2000 }\n  ]\n}',
        expected="200 OK")

    story += ep_title("9.5", "Record Payment (M-Pesa)")
    story += endpoint("POST", "/api/v1/fees/payments",
        body_json=(
            '{\n'
            '  "studentId":      "{{studentId}}",\n'
            '  "feeStructureId": "{{feeStructureId}}",\n'
            '  "amount":         10000,\n'
            '  "method":         "mpesa",\n'
            '  "reference":      "QWE123456",\n'
            '  "notes":          "First instalment"\n'
            '}'
        ),
        expected="201 Created",
        script='pm.environment.set("paymentId", pm.response.json().payment._id);')

    story += ep_title("9.6", "Record Second Payment (Bank)")
    story += endpoint("POST", "/api/v1/fees/payments",
        body_json='{\n  "studentId": "{{studentId}}", "feeStructureId": "{{feeStructureId}}",\n  "amount": 6000, "method": "bank", "reference": "BNK789012"\n}',
        expected="201 Created")

    story += ep_title("9.7", "List Payments for Student")
    story += endpoint("GET", "/api/v1/fees/payments?studentId={{studentId}}",
        expected="200 OK", verify="2 payment records")

    story += ep_title("9.8", "Get Payment")
    story += endpoint("GET", "/api/v1/fees/payments/{{paymentId}}", expected="200 OK")

    story += ep_title("9.9", "Check Balance")
    story += endpoint("GET", "/api/v1/fees/balance?studentId={{studentId}}&feeStructureId={{feeStructureId}}",
        expected="200 OK",
        verify="totalCharged: 23000, totalPaid: 16000, balance: 7000")

    story += ep_title("9.10", "Reverse Payment")
    story += endpoint("POST", "/api/v1/fees/payments/{{paymentId}}/reverse",
        body_json='{\n  "reason": "Duplicate entry error"\n}',
        expected="200 OK",
        verify="payment.reversed === true, balance updated")


def s3_reportcards(story):
    grp(story, "10", "Report Cards", "/api/v1/report-cards",
        "Requires REPORT_CARDS feature flag. Results must exist before generating. "
        "Only published report cards are visible to parents.")

    story += ep_title("10.1", "Generate for Single Student")
    story += endpoint("POST", "/api/v1/report-cards/generate",
        body_json='{\n  "studentId": "{{studentId}}",\n  "examId":    "{{examId}}"\n}',
        expected="201 Created",
        script='pm.environment.set("reportCardId", pm.response.json().reportCard._id);')

    story += ep_title("10.2", "Generate for Whole Class")
    story += endpoint("POST", "/api/v1/report-cards/generate-class",
        body_json='{\n  "classId": "{{classId}}",\n  "examId":  "{{examId}}"\n}',
        expected="200 OK",
        verify="jobId returned if async, or array of report card IDs if synchronous")

    story += ep_title("10.3", "List Report Cards")
    story += endpoint("GET", "/api/v1/report-cards?classId={{classId}}&examId={{examId}}",
        expected="200 OK")

    story += ep_title("10.4", "Get Report Card")
    story += endpoint("GET", "/api/v1/report-cards/{{reportCardId}}",
        expected="200 OK",
        verify="Contains student info + array of subject results with marks/grades")

    story += ep_title("10.5", "Add Teacher & Headteacher Remarks")
    story += endpoint("PATCH", "/api/v1/report-cards/{{reportCardId}}/remarks",
        body_json=(
            '{\n'
            '  "classTeacherRemark":  "Alice is a dedicated student who consistently performs well.",\n'
            '  "headteacherRemark":   "Excellent performance. Keep it up!"\n'
            '}'
        ),
        expected="200 OK")

    story += ep_title("10.6", "Add Subject-Level Remark")
    story += endpoint("PATCH", "/api/v1/report-cards/{{reportCardId}}/subjects/{{subjectId}}/remark",
        body_json='{\n  "remark": "Shows great aptitude for numbers."\n}',
        expected="200 OK")

    story += ep_title("10.7", "Publish Report Card (parent can now see it)")
    story += endpoint("POST", "/api/v1/report-cards/{{reportCardId}}/publish",
        expected="200 OK",
        verify="reportCard.published === true")

    story += ep_title("10.8", "Get Annual Summary")
    story += endpoint("GET", "/api/v1/report-cards/annual-summary?studentId={{studentId}}&academicYear=2026",
        expected="200 OK",
        verify="Aggregated view across all terms/exams for the student")


def s3_settings(story):
    grp(story, "11", "School Settings", "/api/v1/settings",
        "Upserted on first GET — always returns a document. Cached in Redis for 30 min. "
        "Holidays are sub-documents with their own IDs.")

    story += ep_title("11.1", "Get Settings (auto-creates defaults)")
    story += endpoint("GET", "/api/v1/settings",
        expected="200 OK",
        verify="Settings document with schoolId matching {{schoolId}}")

    story += ep_title("11.2", "Update Settings")
    story += endpoint("PUT", "/api/v1/settings",
        body_json=(
            '{\n'
            '  "schoolMotto":     "Excellence in Education",\n'
            '  "gradingSystem":   "CBC",\n'
            '  "terms": [\n'
            '    { "name": "Term 1", "startDate": "2026-01-06", "endDate": "2026-04-03" },\n'
            '    { "name": "Term 2", "startDate": "2026-05-04", "endDate": "2026-08-07" },\n'
            '    { "name": "Term 3", "startDate": "2026-09-07", "endDate": "2026-11-20" }\n'
            '  ],\n'
            '  "workingDays":     ["Monday","Tuesday","Wednesday","Thursday","Friday"],\n'
            '  "schoolStartTime": "07:30",\n'
            '  "schoolEndTime":   "16:30"\n'
            '}'
        ),
        expected="200 OK")

    story += ep_title("11.3", "Add Holiday")
    story += endpoint("POST", "/api/v1/settings/holidays",
        body_json='{\n  "name": "Madaraka Day",\n  "date": "2026-06-01",\n  "description": "National holiday"\n}',
        expected="201 Created",
        script='pm.environment.set("holidayId", pm.response.json().holiday._id);')

    story += ep_title("11.4", "Delete Holiday")
    story += endpoint("DELETE", "/api/v1/settings/holidays/{{holidayId}}",
        expected="200 OK",
        verify="GET /settings no longer includes the deleted holiday")


def s3_timetable(story):
    grp(story, "12", "Timetable", "/api/v1/timetables",
        "Requires TIMETABLE feature flag. Slots are updated in bulk (replaces all). "
        "Teachers, Directors, Headteachers can read. Only admins can write.")

    story += ep_title("12.1", "Create Timetable")
    story += endpoint("POST", "/api/v1/timetables",
        body_json=(
            '{\n'
            '  "classId":      "{{classId}}",\n'
            '  "academicYear": "2026",\n'
            '  "term":         "Term 1",\n'
            '  "name":         "Grade 4 North - Term 1 2026"\n'
            '}'
        ),
        expected="201 Created",
        script='pm.environment.set("timetableId", pm.response.json().timetable._id);')

    story += ep_title("12.2", "Update Slots (replace entire schedule)")
    story += endpoint("PUT", "/api/v1/timetables/{{timetableId}}/slots",
        body_json=(
            '{\n'
            '  "slots": [\n'
            '    { "day": "Monday",  "period": 1, "startTime": "08:00", "endTime": "08:40",\n'
            '      "subjectId": "{{subjectId}}",  "teacherId": "{{userId}}" },\n'
            '    { "day": "Monday",  "period": 2, "startTime": "08:40", "endTime": "09:20",\n'
            '      "subjectId": "{{subjectId2}}", "teacherId": "{{userId}}" },\n'
            '    { "day": "Tuesday", "period": 1, "startTime": "08:00", "endTime": "08:40",\n'
            '      "subjectId": "{{subjectId}}",  "teacherId": "{{userId}}" }\n'
            '  ]\n'
            '}'
        ),
        expected="200 OK",
        verify="timetable.slots has 3 entries")

    story += ep_title("12.3", "List Timetables")
    story += endpoint("GET", "/api/v1/timetables?classId={{classId}}", expected="200 OK")

    story += ep_title("12.4", "Get Timetable (populated)")
    story += endpoint("GET", "/api/v1/timetables/{{timetableId}}",
        expected="200 OK",
        verify="slots array with subject and teacher names populated")

    story += ep_title("12.5", "Teacher Can Read Timetable")
    story += endpoint("GET", "/api/v1/timetables/{{timetableId}}",
        note="Switch Authorization to teacher's token before sending.",
        expected="200 OK")

    story += ep_title("12.6", "Teacher Cannot Delete Timetable (negative)")
    story += endpoint("DELETE", "/api/v1/timetables/{{timetableId}}",
        note="Send with teacher's token.",
        expected="403 Forbidden")


def s3_library(story):
    grp(story, "13", "Library", "/api/v1/library",
        "Requires LIBRARY feature flag. Loans use MongoDB transactions to atomically "
        "decrement/increment availableCopies. Student and Staff can borrow books.")

    story += ep_title("13.1", "Add Book")
    story += endpoint("POST", "/api/v1/library/books",
        body_json=(
            '{\n'
            '  "title":         "Oxford Primary Mathematics Book 4",\n'
            '  "author":        "Oxford University Press",\n'
            '  "isbn":          "978-0-19-838456-9",\n'
            '  "category":      "Textbook",\n'
            '  "totalCopies":   3,\n'
            '  "publishedYear": 2022,\n'
            '  "location":      "Shelf A3"\n'
            '}'
        ),
        expected="201 Created",
        script='pm.environment.set("bookId", pm.response.json().book._id);')

    story += ep_title("13.2", "List Books")
    story += endpoint("GET", "/api/v1/library/books", expected="200 OK")

    story += ep_title("13.3", "Get Book")
    story += endpoint("GET", "/api/v1/library/books/{{bookId}}",
        expected="200 OK",
        verify="availableCopies === totalCopies (no loans yet)")

    story += ep_title("13.4", "Update Book")
    story += endpoint("PATCH", "/api/v1/library/books/{{bookId}}",
        body_json='{\n  "location": "Shelf A4"\n}', expected="200 OK")

    story += ep_title("13.5", "Issue Loan — to Student")
    story += endpoint("POST", "/api/v1/library/loans",
        body_json=(
            '{\n'
            '  "bookId":       "{{bookId}}",\n'
            '  "borrowerType": "student",\n'
            '  "borrowerId":   "{{studentId}}",\n'
            '  "dueDate":      "2026-04-28"\n'
            '}'
        ),
        expected="201 Created",
        verify="book availableCopies is now totalCopies - 1",
        script='pm.environment.set("loanId", pm.response.json().loan._id);')

    story += ep_title("13.6", "Issue Loan — to Staff")
    story += endpoint("POST", "/api/v1/library/loans",
        body_json='{\n  "bookId": "{{bookId}}", "borrowerType": "staff",\n  "borrowerId": "{{userId}}", "dueDate": "2026-05-15"\n}',
        expected="201 Created")

    story += ep_title("13.7", "List Active Loans")
    story += endpoint("GET", "/api/v1/library/loans?status=active",
        expected="200 OK", verify="2 active loans")

    story += ep_title("13.8", "Get Loan")
    story += endpoint("GET", "/api/v1/library/loans/{{loanId}}", expected="200 OK")

    story += ep_title("13.9", "Return Book")
    story += endpoint("POST", "/api/v1/library/loans/{{loanId}}/return",
        body_json='{\n  "condition": "good"\n}',
        expected="200 OK",
        verify="loan.status === returned; availableCopies incremented back")

    story += ep_title("13.10", "Exhaust Copies then Try to Issue (negative)")
    story += endpoint("POST", "/api/v1/library/loans",
        note="Issue all 3 copies (totalCopies=3). 2 issued above. Issue 1 more. Then try a 4th.",
        body_json='{\n  "bookId": "{{bookId}}", "borrowerType": "student",\n  "borrowerId": "{{studentId}}", "dueDate": "2026-04-30"\n}',
        expected="400 on the 4th attempt — No available copies")

    story += ep_title("13.11", "Mark Loan Overdue")
    story += endpoint("PATCH", "/api/v1/library/loans/{{loanId}}/overdue",
        expected="200 OK",
        verify="loan.status === overdue")


def s3_transport(story):
    grp(story, "14", "Transport", "/api/v1/transport",
        "Requires TRANSPORT feature flag. Routes can have stops and a driver. "
        "Students are assigned to routes (stored as routeId on student doc). "
        "Cannot delete a route with assigned students.")

    story += ep_title("14.1", "Create Route")
    story += endpoint("POST", "/api/v1/transport/routes",
        body_json=(
            '{\n'
            '  "name":        "Westlands Route",\n'
            '  "description": "Covers Westlands, Parklands, Muthaiga areas",\n'
            '  "fare":         3500,\n'
            '  "vehicleReg":  "KCA 123A",\n'
            '  "driverName":  "James Mwangi",\n'
            '  "driverPhone": "+254700111222",\n'
            '  "stops":       ["Westlands", "Parklands", "Museum Hill", "School"]\n'
            '}'
        ),
        expected="201 Created",
        script='pm.environment.set("routeId", pm.response.json().route._id);')

    story += ep_title("14.2", "List Routes")
    story += endpoint("GET", "/api/v1/transport/routes", expected="200 OK")

    story += ep_title("14.3", "Get Route")
    story += endpoint("GET", "/api/v1/transport/routes/{{routeId}}", expected="200 OK")

    story += ep_title("14.4", "Update Route")
    story += endpoint("PATCH", "/api/v1/transport/routes/{{routeId}}",
        body_json='{\n  "fare": 3800\n}', expected="200 OK")

    story += ep_title("14.5", "Assign Students to Route")
    story += endpoint("POST", "/api/v1/transport/routes/{{routeId}}/assign",
        body_json='{\n  "studentIds": ["{{studentId}}"]\n}',
        expected="200 OK",
        verify="GET /students/{{studentId}} now shows routeId field")

    story += ep_title("14.6", "Get Route — verify students listed")
    story += endpoint("GET", "/api/v1/transport/routes/{{routeId}}",
        expected="200 OK",
        verify="response.students array includes Alice Mutua")

    story += ep_title("14.7", "Delete Route with Students (negative)")
    story += endpoint("DELETE", "/api/v1/transport/routes/{{routeId}}",
        note="Student is still assigned. This should be blocked.",
        expected="400 Bad Request — Cannot delete route with assigned students")

    story += ep_title("14.8", "Unassign Students")
    story += endpoint("POST", "/api/v1/transport/routes/{{routeId}}/unassign",
        body_json='{\n  "studentIds": ["{{studentId}}"]\n}',
        expected="200 OK")

    story += ep_title("14.9", "Delete Empty Route")
    story += endpoint("DELETE", "/api/v1/transport/routes/{{routeId}}",
        expected="200 OK")


def s3_parent(story):
    grp(story, "15", "Parent Portal", "/api/v1/parent",
        "Requires PARENT_PORTAL feature flag. Parents can only read data for their own "
        "linked children. Accessing another student's data returns 403.")

    story.append(info_box(
        "<b>Setup:</b> Create a PARENT user via POST /api/v1/users with the admin token. "
        "Then login as that parent and save the token as {{parentToken}}. "
        "Use {{parentToken}} in the Authorization header for all tests in this section. "
        "Make sure the report card is published (test 10.7) before running 15.5."
    ))
    story.append(Spacer(1, 4))

    story += ep_title("15.0", "Create Parent User (run as admin)")
    story += endpoint("POST", "/api/v1/users",
        body_json=(
            '{\n'
            '  "name":             "Grace Mutua",\n'
            '  "email":            "grace@example.com",\n'
            '  "phone":            "+254722000001",\n'
            '  "role":             "PARENT",\n'
            '  "linkedStudentIds": ["{{studentId}}"]\n'
            '}'
        ),
        expected="201 Created",
        note="Save the temporaryPassword. Login as Grace to get parentToken.")

    story += ep_title("15.1", "Get My Children")
    story += endpoint("GET", "/api/v1/parent/children",
        note="Use parentToken in Authorization.",
        expected="200 OK",
        verify="Array contains Alice Mutua (studentId)")

    story += ep_title("15.2", "Get Child Fees")
    story += endpoint("GET", "/api/v1/parent/children/{{studentId}}/fees",
        expected="200 OK",
        verify="fee balance + list of payments for Alice")

    story += ep_title("15.3", "Get Child Attendance")
    story += endpoint("GET", "/api/v1/parent/children/{{studentId}}/attendance",
        expected="200 OK")

    story += ep_title("15.4", "Get Child Results")
    story += endpoint("GET", "/api/v1/parent/children/{{studentId}}/results",
        expected="200 OK")

    story += ep_title("15.5", "Get Child Report Cards (published only)")
    story += endpoint("GET", "/api/v1/parent/children/{{studentId}}/report-cards",
        expected="200 OK",
        verify="Only cards with published: true are returned")

    story += ep_title("15.6", "Access Another Student (negative)")
    story += endpoint("GET", "/api/v1/parent/children/{{studentId2}}/fees",
        note="studentId2 is Brian — not linked to Grace's account.",
        expected="403 Forbidden")


def s3_audit(story):
    grp(story, "16", "Audit Logs", "/api/v1/audit-logs",
        "Requires AUDIT_LOG feature flag + admin role. Every create/update/delete "
        "action performed above should appear here.")

    story += ep_title("16.1", "List All Logs")
    story += endpoint("GET", "/api/v1/audit-logs",
        expected="200 OK",
        verify="Long list of all actions performed during testing")

    story += ep_title("16.2", "Filter by Resource")
    story += endpoint("GET", "/api/v1/audit-logs?resource=student",
        expected="200 OK",
        verify="Only enroll, update, transfer, withdraw actions on students")

    story += ep_title("16.3", "Filter by Action")
    story += endpoint("GET", "/api/v1/audit-logs?action=create",
        expected="200 OK",
        verify="Only creation events")

    story += ep_title("16.4", "Filter by Date Range")
    story += endpoint("GET", "/api/v1/audit-logs?from=2026-04-01&to=2026-04-30",
        expected="200 OK")

    story += ep_title("16.5", "Filter by UserId")
    story += endpoint("GET", "/api/v1/audit-logs?userId={{adminId}}",
        expected="200 OK",
        verify="Only actions performed by the admin account")


def s3_schools(story):
    grp(story, "17", "Superadmin — Schools", "/api/v1/schools",
        "SUPERADMIN-only routes. The superadmin account spans all schools "
        "(no schoolId scoping). Create the account directly in MongoDB Atlas.")

    story.append(info_box(
        "<b>Create Superadmin in MongoDB Atlas:</b> Open Atlas → Browse Collections → users. "
        "Insert one document with role: 'SUPERADMIN'. Then login to get {{superToken}}. "
        "Use {{superToken}} in Authorization for all tests below."
    ))
    story.append(Spacer(1, 4))

    story += ep_title("17.1", "List All Schools")
    story += endpoint("GET", "/api/v1/schools",
        note="Use superToken in Authorization.",
        expected="200 OK",
        verify="Array of all schools on the platform")

    story += ep_title("17.2", "Get School")
    story += endpoint("GET", "/api/v1/schools/{{schoolId}}",
        expected="200 OK")

    story += ep_title("17.3", "Create School (from superadmin)")
    story += endpoint("POST", "/api/v1/schools",
        body_json=(
            '{\n'
            '  "name":    "Greenfield Academy",\n'
            '  "email":   "admin@greenfield.ac.ke",\n'
            '  "phone":   "+254700999888",\n'
            '  "county":  "Mombasa"\n'
            '}'
        ),
        expected="201 Created")

    story += ep_title("17.4", "Update School")
    story += endpoint("PATCH", "/api/v1/schools/{{schoolId}}",
        body_json='{\n  "county": "Kajiado", "isActive": true\n}',
        expected="200 OK")

    story += ep_title("17.5", "Update Subscription Plan")
    story += endpoint("PATCH", "/api/v1/schools/{{schoolId}}/subscription",
        body_json='{\n  "planTier":           "standard",\n  "subscriptionStatus": "active",\n  "trialExpiry":        null\n}',
        expected="200 OK",
        verify="school.planTier === standard, subscriptionStatus === active")

    story += ep_title("17.6", "Admin Cannot Access Superadmin Routes (negative)")
    story += endpoint("GET", "/api/v1/schools",
        note="Switch back to admin token ({{token}}).",
        expected="403 Forbidden")


# ── Error Cases table ─────────────────────────────────────────────────────────
def s_errors(story):
    story += section_header("Section 21 — Error Cases Reference",
                            "Expected failures — verify your error handling is correct")

    rows = [
        [Paragraph(s, BODY), Paragraph(c, make_style("SC", fontName="Helvetica-Bold", fontSize=8,
                                                       textColor=RED if c.startswith("4") else ORANGE,
                                                       leading=11)),
         Paragraph(m, BODY_SM)]
        for s, c, m in [
            ("Login with wrong password",                       "401", '"Invalid credentials"'),
            ("Access protected route without Authorization",    "401", '"Not authenticated"'),
            ("Expired / tampered JWT",                         "401", '"Token invalid or expired"'),
            ("TEACHER accesses GET /users",                    "403", '"Forbidden"'),
            ("TEACHER accesses DELETE /timetables/:id",        "403", '"Forbidden"'),
            ("PARENT accesses /api/v1/users",                  "403", '"Forbidden"'),
            ("PARENT accesses another student's data",         "403", '"Forbidden"'),
            ("Missing required field in body",                 "422", "Zod error with field name"),
            ("Invalid email format",                           "422", "Zod error — invalid email"),
            ("Password shorter than 8 chars",                  "422", "Zod error — too short"),
            ("Duplicate admission number",                     "409", '"Admission number already exists"'),
            ("Non-existent resource (bad ID)",                 "404", '"Not found"'),
            ("Invalid MongoDB ObjectId format",                "400", '"Invalid ID format"'),
            ("Issue loan with 0 available copies",             "400", '"No available copies"'),
            ("Delete route with assigned students",            "400", '"Cannot delete route with assigned students"'),
            ("Withdraw already-withdrawn student",             "400", "Business rule error"),
            ("Auth rate limit exceeded (>20/15 min)",         "429", "Retry-After header present"),
            ("PATCH submitted attendance register",           "400", '"Register already submitted"'),
        ]
    ]
    hdrs = [Paragraph(h, make_style("TH", fontName="Helvetica-Bold", fontSize=8,
                                     textColor=WHITE, leading=11))
            for h in ["Scenario", "HTTP Status", "Message / Verify"]]
    t = make_table(hdrs, rows, [180, 55, W - 40*mm - 235])
    story.append(t)
    story.append(PageBreak())


# ── Collection Structure ──────────────────────────────────────────────────────
def s_collection(story):
    story += section_header("Section 22 — Recommended Postman Collection Structure")
    story.append(CodeBlock(
        "Diraschool API\n"
        "  00 - Health Check\n"
        "  01 - Auth\n"
        "       Register School\n"
        "       Login (Admin)\n"
        "       Get Me\n"
        "       Change Password\n"
        "       Logout\n"
        "       [Negative] Wrong Password\n"
        "  02 - Users\n"
        "  03 - Classes\n"
        "  04 - Students\n"
        "  05 - Subjects\n"
        "  06 - Attendance\n"
        "  07 - Exams\n"
        "  08 - Results\n"
        "  09 - Fees\n"
        "       Structures\n"
        "       Payments\n"
        "  10 - Report Cards\n"
        "  11 - Settings\n"
        "  12 - Timetable\n"
        "  13 - Library\n"
        "       Books\n"
        "       Loans\n"
        "  14 - Transport\n"
        "  15 - Parent Portal\n"
        "  16 - Audit Logs\n"
        "  17 - Superadmin\n"
        "  ZZ - Error Cases"
    ))
    story.append(Spacer(1, 8))
    story.append(info_box(
        "<b>Pro tip:</b> Export the completed collection (right-click → Export → Collection v2.1) "
        "and commit it to your repo under <code>docs/diraschool.postman_collection.json</code>. "
        "This lets team members or CI pipelines import and run the full suite."
    ))
    story.append(PageBreak())


# ── Railway smoke test ────────────────────────────────────────────────────────
def s_railway(story):
    story += section_header("Section 23 — Railway Production Testing",
                            "Create a second Postman Environment: Diraschool Railway")

    story.append(Paragraph(
        "Duplicate the <b>Diraschool Dev</b> environment and name it <b>Diraschool Railway</b>. "
        "Change only <code>base_url</code> to your Railway deployment URL "
        "(e.g. <code>https://diraschool-api-production.up.railway.app</code>). "
        "All other variables are the same. Switch environments using the dropdown in the top-right of Postman.", BODY))
    story.append(Spacer(1, 6))

    story.append(Paragraph("Minimum Smoke Test Sequence (run in order):", H3))
    smoke_rows = [
        ["1", "GET  /health",                   "200 — api: up, mongodb: up"],
        ["2", "POST /api/v1/auth/register",      "201 — saves token + schoolId"],
        ["3", "POST /api/v1/auth/login",         "200 — refreshes token"],
        ["4", "GET  /api/v1/auth/me",            "200 — correct user returned"],
        ["5", "POST /api/v1/classes",            "201 — confirms DB writes work"],
        ["6", "POST /api/v1/students",           "201 — multi-collection write"],
        ["7", "POST /api/v1/fees/payments",      "201 — confirms feeStructure + payment"],
        ["8", "GET  /api/v1/audit-logs",         "200 — confirms audit trail"],
    ]
    hdrs2 = [Paragraph(h, make_style("TH", fontName="Helvetica-Bold", fontSize=8,
                                      textColor=WHITE, leading=11))
             for h in ["#", "Request", "Pass Condition"]]
    rows2 = [[Paragraph(n, CENTER), Paragraph(r, CODE), Paragraph(p, BODY_SM)]
             for n, r, p in smoke_rows]
    t = make_table(hdrs2, rows2, [18, 160, W - 40*mm - 178])
    story.append(t)
    story.append(Spacer(1, 8))

    story.append(Paragraph("Reading Railway Logs:", H3))
    story.append(CodeBlock(
        "# In Railway dashboard: your-service > Deployments > View Logs\n"
        "# Look for these on a healthy boot:\n"
        "[info] MongoDB connected\n"
        "[info] [Redis] Connected\n"
        "[info] API server running on port 3000"
    ))
    story.append(Spacer(1, 6))

    story.append(info_box(
        "<b>REDIS_URL check:</b> If you see ECONNRESET in Railway logs, verify your "
        "REDIS_URL env var starts with <code>rediss://</code> (with the extra 's'). "
        "Upstash requires TLS. Using <code>redis://</code> causes immediate disconnects."
    ))


# ── Page header / footer ──────────────────────────────────────────────────────
def on_page(canvas, doc):
    canvas.saveState()
    # Header
    canvas.setFillColor(NAVY)
    canvas.rect(20*mm, H - 18*mm, W - 40*mm, 8*mm, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(22*mm, H - 13.5*mm, "DIRASCHOOL API — POSTMAN TESTING GUIDE")
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(W - 21*mm, H - 13.5*mm, "April 2026")
    # Footer
    canvas.setFillColor(GREY_MID)
    canvas.rect(20*mm, 12*mm, W - 40*mm, 0.5*mm, fill=1, stroke=0)
    canvas.setFillColor(GREY_TXT)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(22*mm, 8*mm, "Diraschool — Multi-Tenant CBC School Management SaaS")
    canvas.drawRightString(W - 21*mm, 8*mm, f"Page {doc.page}")
    canvas.restoreState()


def on_first_page(canvas, doc):
    canvas.saveState()
    canvas.restoreState()


# ── Build ─────────────────────────────────────────────────────────────────────
def build():
    out = "/Users/mac/projects/edusass/docs/diraschool-postman-guide.pdf"
    doc = SimpleDocTemplate(
        out,
        pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=22*mm, bottomMargin=20*mm,
        title="Diraschool API - Postman Testing Guide",
        author="Diraschool",
    )

    story = []

    cover(story)
    toc(story)
    s1_env(story)
    s2_order(story)

    # Section 3 endpoints
    s3_health(story)
    story.append(Spacer(1, 6))
    s3_auth(story)
    s3_users(story)
    s3_classes(story)
    s3_students(story)
    story.append(PageBreak())
    s3_subjects(story)
    s3_attendance(story)
    s3_exams(story)
    s3_results(story)
    story.append(PageBreak())
    s3_fees(story)
    s3_reportcards(story)
    story.append(PageBreak())
    s3_settings(story)
    s3_timetable(story)
    story.append(PageBreak())
    s3_library(story)
    story.append(PageBreak())
    s3_transport(story)
    s3_parent(story)
    story.append(PageBreak())
    s3_audit(story)
    s3_schools(story)
    story.append(PageBreak())

    s_errors(story)
    s_collection(story)
    s_railway(story)

    doc.build(story, onFirstPage=on_first_page, onLaterPages=on_page)
    print(f"PDF written to: {out}")


if __name__ == "__main__":
    build()
