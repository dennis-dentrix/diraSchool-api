/**
 * Receipt Worker — generates a PDF fee receipt for a completed payment.
 *
 * Job payload:
 *   { paymentId: string, schoolId: string }
 *
 * Flow:
 *   1. Fetch + populate Payment
 *   2. Render PDF receipt buffer via PDFKit
 *   3. Upload to Cloudinary
 *   4. Persist receiptUrl on Payment document
 */
import PDFDocument from 'pdfkit';
import Payment from '../../features/fees/Payment.model.js';
import School from '../../features/schools/School.model.js';
import { uploadBuffer } from '../helpers/cloudinaryUpload.js';
import logger from '../../config/logger.js';

// ── PDF renderer ──────────────────────────────────────────────────────────────

const renderReceiptPdf = (payment, schoolName) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A5', margin: 40 });
    const chunks = [];

    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const student = payment.studentId;
    const W = 420; // A5 content width

    // Header
    doc.rect(0, 0, W + 80, 70).fill('#1a3c6e');
    doc.fillColor('white').font('Helvetica-Bold').fontSize(16)
      .text(schoolName, 40, 14, { width: W, align: 'center' });
    doc.font('Helvetica').fontSize(10)
      .text('FEE PAYMENT RECEIPT', 40, 36, { width: W, align: 'center' });
    doc.fontSize(8).text(
      `Receipt Date: ${new Date(payment.createdAt).toLocaleDateString('en-KE', { dateStyle: 'long' })}`,
      40, 54, { width: W, align: 'center' }
    );

    let y = 84;

    // Receipt details
    const rows = [
      ['Student Name',   `${student.firstName} ${student.lastName}`],
      ['Admission No',   student.admissionNumber],
      ['Academic Year',  payment.academicYear],
      ['Term',           payment.term],
      ['Amount Paid',    `KES ${payment.amount.toLocaleString()}`],
      ['Payment Method', payment.method.toUpperCase()],
      ['Reference',      payment.reference || '—'],
      ['Recorded By',    payment.recordedByUserId
        ? `${payment.recordedByUserId.firstName} ${payment.recordedByUserId.lastName}`
        : '—'],
    ];

    rows.forEach(([label, value], i) => {
      const bg = i % 2 === 0 ? '#f5f7fa' : 'white';
      doc.rect(40, y, W, 22).fill(bg);
      doc.rect(40, y, W, 22).strokeColor('#d0d7e2').lineWidth(0.4).stroke();
      doc.fillColor('#6b7280').font('Helvetica').fontSize(8).text(label, 48, y + 7, { width: W * 0.38 });
      doc.fillColor('#222222').font('Helvetica-Bold').fontSize(9).text(value, 48 + W * 0.38, y + 6, { width: W * 0.58 });
      y += 22;
    });

    y += 10;
    // Amount highlight
    doc.rect(40, y, W, 30).fill('#f4a11d');
    doc.fillColor('white').font('Helvetica-Bold').fontSize(13)
      .text(`TOTAL PAID: KES ${payment.amount.toLocaleString()}`, 40, y + 8, { width: W, align: 'center' });

    y += 44;
    doc.fillColor('#6b7280').font('Helvetica').fontSize(7)
      .text('This is an official receipt. Please retain for your records.', 40, y, { width: W, align: 'center' });
    doc.text('Powered by Diraschool', 40, y + 10, { width: W, align: 'center' });

    doc.end();
  });

// ── Worker handler ────────────────────────────────────────────────────────────

export const processReceiptJob = async (job) => {
  const { paymentId, schoolId } = job.data;

  logger.info('[Receipt] Generating fee receipt', { jobId: job.id, paymentId });

  const payment = await Payment.findOne({ _id: paymentId, schoolId })
    .populate('studentId', 'firstName lastName admissionNumber')
    .populate('recordedByUserId', 'firstName lastName');

  if (!payment) {
    throw new Error(`Payment ${paymentId} not found for school ${schoolId}`);
  }

  const school = await School.findById(schoolId).select('name');
  const schoolName = school?.name ?? 'School';

  const pdfBuffer = await renderReceiptPdf(payment, schoolName);

  const student = payment.studentId;
  const publicId = `receipts/${schoolId}/${student.admissionNumber}_${payment.academicYear}_${payment.term.replace(/\s+/g, '-')}_${payment._id}`;

  const upload = await uploadBuffer(pdfBuffer, {
    folder: `receipts/${schoolId}`,
    public_id: publicId,
    resource_type: 'raw',
    format: 'pdf',
  });

  if (upload?.url) {
    await Payment.updateOne({ _id: paymentId }, { receiptUrl: upload.url });
    logger.info('[Receipt] Receipt uploaded', { jobId: job.id, url: upload.url });
  }

  return { paymentId, status: 'complete', receiptUrl: upload?.url ?? null };
};
