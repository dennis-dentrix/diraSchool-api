/**
 * renderReportCardPdf — generates a PDF buffer for a populated ReportCard document.
 *
 * Requires `pdfkit` (npm install pdfkit).
 *
 * @param {Object} reportCard  — fully populated ReportCard mongoose doc
 * @param {string} schoolName  — display name of the school
 * @returns {Promise<Buffer>}  — PDF bytes ready for Cloudinary / disk / stream
 */
import PDFDocument from 'pdfkit';

// ── Colour palette ────────────────────────────────────────────────────────────
const COLORS = {
  primary: '#1a3c6e',   // dark navy
  accent:  '#f4a11d',   // amber
  light:   '#f5f7fa',   // table row alt
  border:  '#d0d7e2',
  text:    '#222222',
  muted:   '#6b7280',
};

// ── Layout constants ──────────────────────────────────────────────────────────
const MARGIN = 40;
const PAGE_WIDTH = 595;   // A4
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// Draw a filled rectangle helper
const fillRect = (doc, x, y, w, h, color) => {
  doc.save().rect(x, y, w, h).fill(color).restore();
};

// ── Main renderer ─────────────────────────────────────────────────────────────
export const renderReportCardPdf = (reportCard, schoolName) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, autoFirstPage: true });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const student = reportCard.studentId;
    const cls = reportCard.classId;

    // ── Header band ───────────────────────────────────────────────────────────
    fillRect(doc, 0, 0, PAGE_WIDTH, 80, COLORS.primary);

    doc
      .fillColor('white')
      .font('Helvetica-Bold')
      .fontSize(18)
      .text(schoolName, MARGIN, 18, { width: CONTENT_WIDTH, align: 'center' });

    doc
      .fontSize(11)
      .font('Helvetica')
      .text('STUDENT ACADEMIC REPORT CARD', MARGIN, 42, { width: CONTENT_WIDTH, align: 'center' });

    doc
      .fontSize(9)
      .text(`${cls.academicYear}  •  ${cls.term}`, MARGIN, 60, { width: CONTENT_WIDTH, align: 'center' });

    // ── Student info row ──────────────────────────────────────────────────────
    let y = 96;
    fillRect(doc, MARGIN, y, CONTENT_WIDTH, 50, COLORS.light);
    doc.rect(MARGIN, y, CONTENT_WIDTH, 50).strokeColor(COLORS.border).lineWidth(0.5).stroke();

    const infoItems = [
      ['Student', `${student.firstName} ${student.lastName}`],
      ['Adm. No', student.admissionNumber],
      ['Class', cls.stream ? `${cls.name} (${cls.stream})` : cls.name],
      ['Level', cls.levelCategory],
    ];

    const colW = CONTENT_WIDTH / infoItems.length;
    infoItems.forEach(([label, value], i) => {
      const x = MARGIN + i * colW + 8;
      doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8).text(label, x, y + 8);
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10).text(value, x, y + 22, { width: colW - 12 });
    });

    y += 62;

    // ── Subjects table ────────────────────────────────────────────────────────
    const COL = {
      subject: MARGIN,
      grade:   MARGIN + CONTENT_WIDTH * 0.55,
      points:  MARGIN + CONTENT_WIDTH * 0.72,
      avg:     MARGIN + CONTENT_WIDTH * 0.84,
    };

    // Table header
    fillRect(doc, MARGIN, y, CONTENT_WIDTH, 20, COLORS.primary);
    doc.fillColor('white').font('Helvetica-Bold').fontSize(9);
    doc.text('Subject', COL.subject + 4, y + 5);
    doc.text('Grade', COL.grade, y + 5);
    doc.text('Points', COL.points, y + 5);
    doc.text('Avg %', COL.avg, y + 5);
    y += 20;

    const subjects = reportCard.subjects || [];
    subjects.forEach((subj, idx) => {
      const rowBg = idx % 2 === 0 ? 'white' : COLORS.light;
      fillRect(doc, MARGIN, y, CONTENT_WIDTH, 18, rowBg);
      doc.rect(MARGIN, y, CONTENT_WIDTH, 18).strokeColor(COLORS.border).lineWidth(0.3).stroke();

      doc.fillColor(COLORS.text).font('Helvetica').fontSize(9);
      const subjLabel = subj.subjectCode
        ? `${subj.subjectName} (${subj.subjectCode})`
        : subj.subjectName;
      doc.text(subjLabel, COL.subject + 4, y + 4, { width: CONTENT_WIDTH * 0.5 });
      doc.text(subj.grade ?? '–', COL.grade, y + 4);
      doc.text(subj.points != null ? String(subj.points) : '–', COL.points, y + 4);
      doc.text(`${subj.averagePercentage.toFixed(1)}%`, COL.avg, y + 4);
      y += 18;
    });

    // ── Summary row ───────────────────────────────────────────────────────────
    y += 4;
    fillRect(doc, MARGIN, y, CONTENT_WIDTH, 22, COLORS.accent);
    doc.fillColor('white').font('Helvetica-Bold').fontSize(9);
    doc.text('OVERALL SUMMARY', COL.subject + 4, y + 6);
    doc.text(reportCard.overallGrade ?? '–', COL.grade, y + 6);
    doc.text(reportCard.totalPoints != null ? String(reportCard.totalPoints) : '–', COL.points, y + 6);
    doc.text(`${(reportCard.averagePoints ?? 0).toFixed(2)} pts`, COL.avg, y + 6);
    y += 30;

    // ── Attendance ────────────────────────────────────────────────────────────
    const att = reportCard.attendanceSummary || {};
    doc.fillColor(COLORS.primary).font('Helvetica-Bold').fontSize(10).text('Attendance Summary', MARGIN, y);
    y += 14;

    fillRect(doc, MARGIN, y, CONTENT_WIDTH, 22, COLORS.light);
    doc.rect(MARGIN, y, CONTENT_WIDTH, 22).strokeColor(COLORS.border).lineWidth(0.5).stroke();

    const attItems = [
      ['Total Days', att.totalDays ?? 0],
      ['Present', att.present ?? 0],
      ['Absent', att.absent ?? 0],
      ['Late', att.late ?? 0],
      ['Excused', att.excused ?? 0],
    ];

    const attColW = CONTENT_WIDTH / attItems.length;
    attItems.forEach(([label, val], i) => {
      const ax = MARGIN + i * attColW + 8;
      doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8).text(label, ax, y + 4);
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10).text(String(val), ax + 2, y + 12);
    });
    y += 32;

    // ── Remarks ───────────────────────────────────────────────────────────────
    if (reportCard.teacherRemarks || reportCard.principalRemarks) {
      doc.fillColor(COLORS.primary).font('Helvetica-Bold').fontSize(10).text('Remarks', MARGIN, y);
      y += 14;

      if (reportCard.teacherRemarks) {
        doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8).text('Class Teacher:', MARGIN, y);
        y += 11;
        doc.fillColor(COLORS.text).font('Helvetica').fontSize(9)
          .text(reportCard.teacherRemarks, MARGIN, y, { width: CONTENT_WIDTH });
        y += doc.heightOfString(reportCard.teacherRemarks, { width: CONTENT_WIDTH }) + 8;
      }

      if (reportCard.principalRemarks) {
        doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8).text('Principal / Head Teacher:', MARGIN, y);
        y += 11;
        doc.fillColor(COLORS.text).font('Helvetica').fontSize(9)
          .text(reportCard.principalRemarks, MARGIN, y, { width: CONTENT_WIDTH });
      }
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    fillRect(doc, 0, 810, PAGE_WIDTH, 32, COLORS.light);
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(7)
      .text(
        `Generated by Diraschool  •  ${new Date().toLocaleDateString('en-KE', { dateStyle: 'long' })}`,
        MARGIN,
        818,
        { width: CONTENT_WIDTH, align: 'center' }
      );

    doc.end();
  });
