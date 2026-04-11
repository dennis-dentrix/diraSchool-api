/**
 * Report Worker — processes PDF generation jobs from the "report" queue.
 *
 * Job payload:
 *   { reportCardId: string, schoolId: string }
 *
 * Flow:
 *   1. Fetch + populate the ReportCard
 *   2. Render to PDF buffer via PDFKit
 *   3. Upload to Cloudinary (skipped if CLOUDINARY_* env vars are absent)
 *   4. Persist the pdfUrl on the ReportCard document
 */
import ReportCard from '../../features/report-cards/ReportCard.model.js';
import School from '../../features/schools/School.model.js';
import { renderReportCardPdf } from '../helpers/renderReportCardPdf.js';
import { uploadBuffer } from '../helpers/cloudinaryUpload.js';
import logger from '../../config/logger.js';

export const processReportJob = async (job) => {
  const { reportCardId, schoolId } = job.data;

  logger.info('[Report] Starting PDF generation', { jobId: job.id, reportCardId });

  // 1. Fetch report card with all populated refs
  const reportCard = await ReportCard.findOne({ _id: reportCardId, schoolId })
    .populate('studentId', 'firstName lastName admissionNumber gender dateOfBirth')
    .populate('classId', 'name stream levelCategory academicYear term');

  if (!reportCard) {
    throw new Error(`ReportCard ${reportCardId} not found for school ${schoolId}`);
  }

  // Fetch school name for the PDF header
  const school = await School.findById(schoolId).select('name');
  const schoolName = school?.name ?? 'School';

  // 2. Render PDF
  const pdfBuffer = await renderReportCardPdf(reportCard, schoolName);

  logger.info('[Report] PDF rendered', { jobId: job.id, bytes: pdfBuffer.length });

  // 3. Upload to Cloudinary
  const student = reportCard.studentId;
  const publicId = `report-cards/${schoolId}/${student.admissionNumber}_${reportCard.academicYear}_${reportCard.term.replace(/\s+/g, '-')}`;

  const upload = await uploadBuffer(pdfBuffer, {
    folder: `report-cards/${schoolId}`,
    public_id: publicId,
    resource_type: 'raw',
    format: 'pdf',
  });

  // 4. Persist URL (null if Cloudinary is not configured — URL stored when configured later)
  if (upload?.url) {
    await ReportCard.updateOne({ _id: reportCardId }, { pdfUrl: upload.url });
    logger.info('[Report] PDF uploaded to Cloudinary', { jobId: job.id, url: upload.url });
  } else {
    logger.info('[Report] Cloudinary not configured — PDF not stored remotely', { jobId: job.id });
  }

  return {
    reportCardId,
    status: 'complete',
    pdfUrl: upload?.url ?? null,
    student: `${student.firstName} ${student.lastName}`,
  };
};
