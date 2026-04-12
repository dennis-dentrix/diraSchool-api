#!/usr/bin/env python3
"""
Diraschool API Documentation PDF Generator
Converts API.md into a polished, styled PDF using reportlab.
"""

import re
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether, Preformatted
)
from reportlab.platypus.flowables import Flowable
from reportlab.lib.colors import HexColor, white, black

# ── Colour Palette ────────────────────────────────────────────────────────────
BLUE       = HexColor('#1a56db')
BLUE_LIGHT = HexColor('#e8f0fe')
BLUE_MID   = HexColor('#3b6fd4')
GRAY_BG    = HexColor('#f4f6f9')
GRAY_DARK  = HexColor('#374151')
GRAY_MID   = HexColor('#6b7280')
GRAY_LIGHT = HexColor('#e5e7eb')
GRAY_ALT   = HexColor('#f9fafb')
BORDER     = HexColor('#d1d5db')
CODE_BORDER= HexColor('#d1d5db')

# HTTP method badge colours
METHOD_COLORS = {
    'GET':    (HexColor('#dcfce7'), HexColor('#166534')),   # green bg, dark green text
    'POST':   (HexColor('#dbeafe'), HexColor('#1e40af')),   # blue bg, dark blue text
    'PATCH':  (HexColor('#ffedd5'), HexColor('#9a3412')),   # orange bg, dark orange text
    'DELETE': (HexColor('#fee2e2'), HexColor('#991b1b')),   # red bg, dark red text
    'PUT':    (HexColor('#f3e8ff'), HexColor('#6b21a8')),   # purple bg, dark purple text
}

PAGE_W, PAGE_H = A4
MARGIN_LEFT  = 18 * mm
MARGIN_RIGHT = 18 * mm
MARGIN_TOP   = 22 * mm
MARGIN_BOT   = 20 * mm
CONTENT_W    = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT

BASE_URL = 'https://diraschool-api-production.up.railway.app'

# ── Custom Flowables ──────────────────────────────────────────────────────────

class MethodBadge(Flowable):
    """Renders a coloured HTTP method badge followed by the path."""
    def __init__(self, method, path, width=CONTENT_W):
        super().__init__()
        self.method = method.upper()
        self.path   = path
        self.width  = width
        self.height = 24

    def draw(self):
        c = self.canv
        bg, fg = METHOD_COLORS.get(self.method, (GRAY_BG, GRAY_DARK))

        # Badge pill
        badge_w = len(self.method) * 6.5 + 14
        c.setFillColor(bg)
        c.roundRect(0, 2, badge_w, 18, 4, fill=1, stroke=0)
        c.setFillColor(fg)
        c.setFont('Helvetica-Bold', 9)
        c.drawString(7, 7, self.method)

        # Path
        c.setFont('Courier-Bold', 10)
        c.setFillColor(GRAY_DARK)
        c.drawString(badge_w + 8, 6, self.path)


class CodeBlock(Flowable):
    """Renders a code block with gray background and monospace font."""
    def __init__(self, code, width=CONTENT_W, font_size=8):
        super().__init__()
        self.code      = code
        self.width     = width
        self.font_size = font_size
        self.line_h    = font_size * 1.45
        self.pad_h     = 8
        self.pad_v     = 7
        lines          = code.split('\n')
        self.height    = len(lines) * self.line_h + self.pad_v * 2

    def draw(self):
        c = self.canv
        # Background
        c.setFillColor(GRAY_BG)
        c.setStrokeColor(CODE_BORDER)
        c.setLineWidth(0.5)
        c.roundRect(0, 0, self.width, self.height, 4, fill=1, stroke=1)

        # Text
        c.setFillColor(HexColor('#1f2937'))
        c.setFont('Courier', self.font_size)
        lines = self.code.split('\n')
        y = self.height - self.pad_v - self.font_size
        for line in lines:
            c.drawString(self.pad_h, y, line)
            y -= self.line_h


class SectionDivider(HRFlowable):
    """Thin blue divider used between major sections."""
    def __init__(self):
        super().__init__(
            width='100%', thickness=1.2,
            color=BLUE, spaceAfter=4, spaceBefore=10
        )


# ── Paragraph Styles ──────────────────────────────────────────────────────────

def make_styles():
    base = getSampleStyleSheet()

    def S(name, **kw):
        return ParagraphStyle(name, **kw)

    return {
        'h1': S('h1',
            fontName='Helvetica-Bold', fontSize=20,
            textColor=BLUE, spaceAfter=6, spaceBefore=4,
            leading=26),
        'h2': S('h2',
            fontName='Helvetica-Bold', fontSize=14,
            textColor=BLUE, spaceAfter=4, spaceBefore=14,
            leading=18, borderPad=0),
        'h3': S('h3',
            fontName='Helvetica-Bold', fontSize=11,
            textColor=GRAY_DARK, spaceAfter=3, spaceBefore=8,
            leading=15),
        'h4': S('h4',
            fontName='Helvetica-Bold', fontSize=9.5,
            textColor=GRAY_MID, spaceAfter=2, spaceBefore=5,
            leading=14, textTransform='uppercase'),
        'body': S('body',
            fontName='Helvetica', fontSize=9.5,
            textColor=GRAY_DARK, spaceAfter=4, spaceBefore=0,
            leading=14),
        'note': S('note',
            fontName='Helvetica-Oblique', fontSize=8.5,
            textColor=GRAY_MID, spaceAfter=3, spaceBefore=2,
            leading=12),
        'toc_title': S('toc_title',
            fontName='Helvetica-Bold', fontSize=13,
            textColor=BLUE, spaceAfter=8, spaceBefore=4),
        'toc_item': S('toc_item',
            fontName='Helvetica', fontSize=9.5,
            textColor=GRAY_DARK, spaceAfter=2, spaceBefore=1,
            leading=14, leftIndent=8),
        'toc_sub': S('toc_sub',
            fontName='Helvetica', fontSize=9,
            textColor=GRAY_MID, spaceAfter=1, spaceBefore=0,
            leading=13, leftIndent=22),
        'inline_code': S('inline_code',
            fontName='Courier', fontSize=8.5,
            textColor=HexColor('#1f2937'),
            backColor=GRAY_BG,
            spaceAfter=0),
        'endpoint_desc': S('endpoint_desc',
            fontName='Helvetica', fontSize=9,
            textColor=GRAY_MID, spaceAfter=3,
            leading=13, leftIndent=4),
        'cover_title': S('cover_title',
            fontName='Helvetica-Bold', fontSize=28,
            textColor=white, spaceAfter=8,
            leading=34, alignment=TA_CENTER),
        'cover_sub': S('cover_sub',
            fontName='Helvetica', fontSize=12,
            textColor=HexColor('#bfdbfe'), spaceAfter=4,
            alignment=TA_CENTER),
        'cover_url': S('cover_url',
            fontName='Courier', fontSize=10,
            textColor=HexColor('#93c5fd'),
            alignment=TA_CENTER),
        'list_item': S('list_item',
            fontName='Helvetica', fontSize=9.5,
            textColor=GRAY_DARK, spaceAfter=2,
            leading=14, leftIndent=12, firstLineIndent=-8),
    }

ST = make_styles()


# ── Header / Footer ───────────────────────────────────────────────────────────

def draw_cover(canvas, doc):
    """Draw the full-bleed cover page on page 1."""
    canvas.saveState()
    w, h = A4

    # Full blue background
    canvas.setFillColor(BLUE)
    canvas.rect(0, 0, w, h, fill=1, stroke=0)

    # Decorative circles
    canvas.setFillColor(BLUE_MID)
    canvas.circle(w + 40, -40, 200, fill=1, stroke=0)
    canvas.setFillColor(HexColor('#2563eb'))
    canvas.circle(-60, h + 30, 150, fill=1, stroke=0)

    # Main title
    canvas.setFont('Helvetica-Bold', 36)
    canvas.setFillColor(white)
    title = 'Diraschool'
    tw = canvas.stringWidth(title, 'Helvetica-Bold', 36)
    canvas.drawString((w - tw) / 2, h * 0.70, title)

    canvas.setFont('Helvetica', 14)
    canvas.setFillColor(HexColor('#bfdbfe'))
    sub = 'API Documentation'
    sw = canvas.stringWidth(sub, 'Helvetica', 14)
    canvas.drawString((w - sw) / 2, h * 0.63, sub)

    # Separator
    canvas.setStrokeColor(HexColor('#3b82f6'))
    canvas.setLineWidth(1.5)
    canvas.line(w / 2 - 80, h * 0.59, w / 2 + 80, h * 0.59)

    # Meta block
    meta = [
        ('Version',    'v1.0'),
        ('Production', BASE_URL),
        ('Local',      'http://localhost:3000'),
        ('Prefix',     '/api/v1'),
        ('Date',       '2026-04-12'),
    ]
    row_y = h * 0.53
    for label, value in meta:
        canvas.setFont('Helvetica-Bold', 9)
        canvas.setFillColor(HexColor('#bfdbfe'))
        canvas.drawRightString(w / 2 - 5, row_y, label + ':')
        canvas.setFont('Courier', 9)
        canvas.setFillColor(white)
        canvas.drawString(w / 2 + 5, row_y, value)
        row_y -= 15

    # Footer strip
    canvas.setFillColor(HexColor('#1e40af'))
    canvas.rect(0, 0, w, 22, fill=1, stroke=0)
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(HexColor('#93c5fd'))
    canvas.drawCentredString(w / 2, 7,
                             'CBC School Management SaaS · Diraschool Kenya')
    canvas.restoreState()


def draw_header_footer(canvas, doc):
    """Draws page header and footer on every page (except cover)."""
    canvas.saveState()
    page = doc.page
    w, h = A4

    # ── Header ────────────────────────────────────────────────────────────────
    canvas.setFillColor(BLUE)
    canvas.rect(0, h - 14*mm, w, 14*mm, fill=1, stroke=0)

    canvas.setFont('Helvetica-Bold', 9)
    canvas.setFillColor(white)
    canvas.drawString(MARGIN_LEFT, h - 9*mm, 'Diraschool API Documentation')

    canvas.setFont('Courier', 7.5)
    canvas.setFillColor(HexColor('#93c5fd'))
    url_x = w - MARGIN_RIGHT - canvas.stringWidth(BASE_URL, 'Courier', 7.5)
    canvas.drawString(url_x, h - 9*mm, BASE_URL)

    # ── Footer ────────────────────────────────────────────────────────────────
    canvas.setStrokeColor(GRAY_LIGHT)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN_LEFT, 12*mm, w - MARGIN_RIGHT, 12*mm)

    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(GRAY_MID)
    canvas.drawString(MARGIN_LEFT, 7.5*mm, 'v1.0 · 2026')

    pg_str = f'Page {page}'
    pg_w = canvas.stringWidth(pg_str, 'Helvetica', 8)
    canvas.drawString(w - MARGIN_RIGHT - pg_w, 7.5*mm, pg_str)

    canvas.restoreState()


def on_page(canvas, doc):
    """Dispatcher: cover on page 1, header/footer on all others."""
    if doc.page == 1:
        draw_cover(canvas, doc)
    else:
        draw_header_footer(canvas, doc)


# ── Table Helpers ─────────────────────────────────────────────────────────────

def make_table(headers, rows, col_widths=None):
    """Build a styled table with alternating row colours."""
    if not rows:
        return None

    def cell(text, bold=False, mono=False):
        txt = str(text) if text is not None else ''
        # Escape XML special chars for Paragraph
        txt = txt.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        font = 'Courier' if mono else ('Helvetica-Bold' if bold else 'Helvetica')
        return Paragraph(f'<font name="{font}" size="8.5">{txt}</font>',
                         ParagraphStyle('tc', leading=12, spaceAfter=0))

    header_row = [cell(h, bold=True) for h in headers]
    data = [header_row]
    for row in rows:
        data.append([cell(c) for c in row])

    if col_widths is None:
        col_widths = [CONTENT_W / len(headers)] * len(headers)

    t = Table(data, colWidths=col_widths, repeatRows=1)
    style = TableStyle([
        # Header
        ('BACKGROUND', (0,0), (-1,0), BLUE),
        ('TEXTCOLOR',  (0,0), (-1,0), white),
        ('FONTNAME',   (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE',   (0,0), (-1,0), 8.5),
        ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ('TOPPADDING',    (0,0), (-1,0), 6),
        # Body rows
        ('FONTSIZE',   (0,1), (-1,-1), 8.5),
        ('BOTTOMPADDING', (0,1), (-1,-1), 5),
        ('TOPPADDING',    (0,1), (-1,-1), 5),
        ('LEFTPADDING',   (0,0), (-1,-1), 8),
        ('RIGHTPADDING',  (0,0), (-1,-1), 8),
        # Alternating rows
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [white, GRAY_ALT]),
        # Grid
        ('GRID', (0,0), (-1,-1), 0.4, BORDER),
        ('BOX',  (0,0), (-1,-1), 0.6, BORDER),
        # Align
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ])
    t.setStyle(style)
    return t


# ── Inline code substitution ──────────────────────────────────────────────────

def fmt(text):
    """Convert markdown inline code and bold to reportlab markup."""
    text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Bold: **text**
    text = re.sub(r'\*\*(.+?)\*\*',
                  r'<b>\1</b>', text)
    # Inline code: `text`
    text = re.sub(r'`([^`]+)`',
                  r'<font name="Courier" size="8.5" color="#1f2937">\1</font>', text)
    return text


# ── Markdown Parser → Flowables ───────────────────────────────────────────────

def md_to_flowables(md_text):
    lines = md_text.split('\n')
    story = []
    i = 0

    def flush_code(start):
        """Collect lines until closing ``` and return a CodeBlock."""
        nonlocal i
        lang = lines[start].strip()[3:].strip()   # e.g. "json", "bash"
        code_lines = []
        i = start + 1
        while i < len(lines) and not lines[i].strip().startswith('```'):
            code_lines.append(lines[i])
            i += 1
        raw = '\n'.join(code_lines).rstrip()
        return CodeBlock(raw, width=CONTENT_W)

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # ── Fenced code block ──────────────────────────────────────────────
        if stripped.startswith('```'):
            story.append(Spacer(1, 3))
            story.append(flush_code(i))
            story.append(Spacer(1, 5))
            i += 1
            continue

        # ── Horizontal rule ────────────────────────────────────────────────
        if stripped in ('---', '***', '___'):
            story.append(Spacer(1, 4))
            story.append(HRFlowable(width='100%', thickness=0.5,
                                    color=GRAY_LIGHT, spaceAfter=4))
            i += 1
            continue

        # ── H1 ─────────────────────────────────────────────────────────────
        if stripped.startswith('# ') and not stripped.startswith('## '):
            story.append(Paragraph(fmt(stripped[2:]), ST['h1']))
            story.append(HRFlowable(width='100%', thickness=1.5,
                                    color=BLUE, spaceAfter=6))
            i += 1
            continue

        # ── H2 ─────────────────────────────────────────────────────────────
        if stripped.startswith('## '):
            story.append(Spacer(1, 6))
            story.append(Paragraph(fmt(stripped[3:]), ST['h2']))
            story.append(HRFlowable(width='100%', thickness=0.8,
                                    color=BLUE_LIGHT, spaceAfter=3))
            i += 1
            continue

        # ── H3 ─────────────────────────────────────────────────────────────
        if stripped.startswith('### '):
            # Check if it looks like an endpoint definition: ### `METHOD /path`
            ep = re.match(r'^###\s+`(GET|POST|PATCH|PUT|DELETE)\s+([^`]+)`', stripped)
            if ep:
                method, path = ep.group(1), ep.group(2)
                story.append(Spacer(1, 6))
                story.append(MethodBadge(method, path))
                story.append(Spacer(1, 3))
            else:
                story.append(Paragraph(fmt(stripped[4:]), ST['h3']))
            i += 1
            continue

        # ── H4 ─────────────────────────────────────────────────────────────
        if stripped.startswith('#### '):
            story.append(Paragraph(fmt(stripped[5:]), ST['h4']))
            i += 1
            continue

        # ── Table ──────────────────────────────────────────────────────────
        if stripped.startswith('|') and stripped.endswith('|'):
            table_lines = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                table_lines.append(lines[i].strip())
                i += 1
            # Parse markdown table
            def parse_row(row):
                cells = [c.strip() for c in row.strip('|').split('|')]
                return cells

            headers = parse_row(table_lines[0])
            rows = []
            for tl in table_lines[2:]:   # skip separator row
                rows.append(parse_row(tl))

            if rows:
                # Heuristic column widths based on header count
                n = len(headers)
                if n == 2:
                    widths = [CONTENT_W * 0.35, CONTENT_W * 0.65]
                elif n == 3:
                    widths = [CONTENT_W * 0.28, CONTENT_W * 0.22, CONTENT_W * 0.50]
                elif n == 4:
                    widths = [CONTENT_W * 0.25, CONTENT_W * 0.15, CONTENT_W * 0.15, CONTENT_W * 0.45]
                elif n == 5:
                    widths = [CONTENT_W * 0.22, CONTENT_W * 0.13, CONTENT_W * 0.13, CONTENT_W * 0.13, CONTENT_W * 0.39]
                else:
                    widths = [CONTENT_W / n] * n

                t = make_table(headers, rows, widths)
                if t:
                    story.append(Spacer(1, 3))
                    story.append(t)
                    story.append(Spacer(1, 5))
            continue

        # ── Unordered list ──────────────────────────────────────────────────
        if stripped.startswith('- ') or stripped.startswith('* '):
            bullet_text = stripped[2:]
            story.append(Paragraph(
                f'<bullet>\u2022</bullet>{fmt(bullet_text)}',
                ParagraphStyle('bullet', parent=ST['body'],
                               leftIndent=16, firstLineIndent=0,
                               spaceAfter=2, spaceBefore=0, leading=14)
            ))
            i += 1
            continue

        # ── Ordered list ────────────────────────────────────────────────────
        ol = re.match(r'^(\d+)\.\s+(.*)', stripped)
        if ol:
            num, text = ol.group(1), ol.group(2)
            story.append(Paragraph(
                f'<bullet>{num}.</bullet>{fmt(text)}',
                ParagraphStyle('ol', parent=ST['body'],
                               leftIndent=20, firstLineIndent=0,
                               spaceAfter=2, spaceBefore=0, leading=14)
            ))
            i += 1
            continue

        # ── Blockquote / Note ───────────────────────────────────────────────
        if stripped.startswith('> '):
            note_text = stripped[2:]
            story.append(Paragraph(
                fmt(note_text),
                ParagraphStyle('note', parent=ST['note'],
                               leftIndent=12,
                               borderPad=4, borderColor=BLUE,
                               borderWidth=0, borderRadius=0,
                               backColor=BLUE_LIGHT)
            ))
            i += 1
            continue

        # ── Blank line ──────────────────────────────────────────────────────
        if not stripped:
            story.append(Spacer(1, 4))
            i += 1
            continue

        # ── Normal paragraph ────────────────────────────────────────────────
        # Check if it's a metadata line like **Version:** 1.0
        if stripped:
            story.append(Paragraph(fmt(stripped), ST['body']))

        i += 1

    return story


# ── Cover Page ────────────────────────────────────────────────────────────────

def build_cover():
    """Returns a PageBreak so page 1 is the cover (drawn in on_page), page 2 starts content."""
    from reportlab.platypus import PageBreak
    return [PageBreak()]


# ── Table of Contents ─────────────────────────────────────────────────────────

def build_toc():
    story = []
    story.append(Spacer(1, 8))
    story.append(Paragraph('Table of Contents', ST['h1']))
    story.append(HRFlowable(width='100%', thickness=1.5, color=BLUE, spaceAfter=8))

    sections = [
        ('1. Overview', []),
        ('2. Authentication', []),
        ('3. Response Format', []),
        ('4. Error Codes', []),
        ('5. Pagination', []),
        ('6. Rate Limiting', []),
        ('7. Roles & Permissions', []),
        ('8. Enumerations', []),
        ('9. Endpoints', [
            'Health Check', 'Auth', 'Users (Staff)', 'Schools',
            'Classes', 'Students', 'Subjects', 'Attendance',
            'Exams', 'Results', 'Fees', 'Report Cards',
            'Timetable', 'Library', 'Transport', 'Settings',
            'Audit Logs', 'Parent Portal',
        ]),
        ('10. Data Models Reference', []),
    ]

    for title, subs in sections:
        story.append(Paragraph(fmt(title), ST['toc_item']))
        for sub in subs:
            story.append(Paragraph(f'&#x2022;  {sub}', ST['toc_sub']))

    return story


# ── Main Build ────────────────────────────────────────────────────────────────

def build_pdf(md_path, out_path):
    doc = SimpleDocTemplate(
        out_path,
        pagesize=A4,
        leftMargin=MARGIN_LEFT,
        rightMargin=MARGIN_RIGHT,
        topMargin=MARGIN_TOP + 2*mm,
        bottomMargin=MARGIN_BOT,
        title='Diraschool API Documentation',
        author='Diraschool',
        subject='REST API Reference',
    )

    story = []

    # 1. Cover (page 1 is drawn by on_page; PageBreak pushes content to page 2)
    story += build_cover()

    # 2. TOC
    story += build_toc()
    story.append(HRFlowable(width='100%', thickness=0.5,
                            color=GRAY_LIGHT, spaceAfter=4, spaceBefore=10))

    # 3. Main content from markdown
    with open(md_path, 'r', encoding='utf-8') as f:
        md = f.read()

    # Skip the title line (already on cover)
    md = re.sub(r'^# Diraschool API Documentation\n', '', md)
    # Skip the TOC block (already rendered)
    md = re.sub(r'## Table of Contents.*?(?=\n## )', '', md, flags=re.DOTALL)

    story += md_to_flowables(md)

    # Build
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f'PDF written to: {out_path}')


# ── Entry Point ───────────────────────────────────────────────────────────────

if __name__ == '__main__':
    base_dir = os.path.dirname(os.path.abspath(__file__))
    md_path  = os.path.join(base_dir, 'API.md')
    out_path = os.path.join(base_dir, 'diraschool-api-docs.pdf')
    build_pdf(md_path, out_path)
