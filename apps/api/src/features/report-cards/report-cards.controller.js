import ReportCard from './ReportCard.model.js';
import Result from '../results/Result.model.js';
import Student from '../students/Student.model.js';
import Class from '../classes/Class.model.js';
import Attendance from '../attendance/Attendance.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { paginate } from '../../utils/pagination.js';
import { computeCBCGrade } from '../../utils/grading.js';
import {
  STUDENT_STATUSES,
  ATTENDANCE_REGISTER_STATUSES,
  AUDIT_ACTIONS,
  AUDIT_RESOURCES,
  JOB_NAMES,
} from '../../constants/index.js';
import { logAction } from '../../utils/auditLogger.js';
import { reportQueue } from '../../jobs/queues.js';
import { notifyUser } from '../../utils/notify.js';

const queueReportPdf = async ({ reportCardId, schoolId, requestedByUserId }) => {
  await ReportCard.updateOne(
    { _id: reportCardId },
    { pdfStatus: 'queued', pdfError: undefined }
  );

  await reportQueue.add(JOB_NAMES.GENERATE_REPORT_CARD, {
    reportCardId: String(reportCardId),
    schoolId: String(schoolId),
    requestedByUserId: String(requestedByUserId),
  });
};

// ── Core generation logic ─────────────────────────────────────────────────────

/**
 * Builds the full report card data payload for one student + term + year.
 * Queries results (populated with exam+subject info) and submitted attendance registers.
 *
 * Returns null if the student has no results for the given period.
 */
async function buildReportCardPayload(schoolId, student, cls, academicYear, term) {
  // Aggregate results in MongoDB to reduce Node-side memory/CPU on large classes.
  const [aggregatedSubjects, submittedDaysCount, attendanceByStatus] = await Promise.all([
    Result.aggregate([
      {
        $match: {
          schoolId,
          studentId: student._id,
          academicYear,
          term,
        },
      },
      {
        $lookup: {
          from: 'exams',
          localField: 'examId',
          foreignField: '_id',
          as: 'exam',
        },
      },
      { $unwind: { path: '$exam', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'subjects',
          localField: 'subjectId',
          foreignField: '_id',
          as: 'subject',
        },
      },
      { $unwind: { path: '$subject', preserveNullAndEmptyArrays: true } },
      { $sort: { 'subject.name': 1, 'exam.name': 1, createdAt: 1 } },
      {
        $group: {
          _id: '$subjectId',
          subjectId: { $first: '$subjectId' },
          subjectName: { $first: { $ifNull: ['$subject.name', 'Unknown Subject'] } },
          subjectCode: { $first: '$subject.code' },
          sumMarks: { $sum: '$marks' },
          sumTotal: { $sum: '$totalMarks' },
          exams: {
            $push: {
              examId: '$examId',
              examName: { $ifNull: ['$exam.name', 'Exam'] },
              examType: { $ifNull: ['$exam.type', 'unknown'] },
              marks: '$marks',
              totalMarks: '$totalMarks',
              percentage: '$percentage',
              grade: '$grade',
              points: '$points',
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          subjectId: 1,
          subjectName: 1,
          subjectCode: 1,
          sumMarks: 1,
          sumTotal: 1,
          exams: 1,
          averagePercentage: {
            $cond: [
              { $gt: ['$sumTotal', 0] },
              { $round: [{ $multiply: [{ $divide: ['$sumMarks', '$sumTotal'] }, 100] }, 2] },
              0,
            ],
          },
        },
      },
      { $sort: { subjectName: 1 } },
    ]),
    Attendance.countDocuments({
      schoolId,
      classId: cls._id,
      academicYear,
      term,
      status: ATTENDANCE_REGISTER_STATUSES.SUBMITTED,
    }),
    Attendance.aggregate([
      {
        $match: {
          schoolId,
          classId: cls._id,
          academicYear,
          term,
          status: ATTENDANCE_REGISTER_STATUSES.SUBMITTED,
        },
      },
      { $unwind: '$entries' },
      { $match: { 'entries.studentId': student._id } },
      { $group: { _id: '$entries.status', count: { $sum: 1 } } },
    ]),
  ]);

  const subjectSummaries = aggregatedSubjects.map((sub) => {
    const { grade, points } = computeCBCGrade(cls.levelCategory, sub.averagePercentage);
    return {
      subjectId: sub.subjectId,
      subjectName: sub.subjectName,
      subjectCode: sub.subjectCode || null,
      exams: sub.exams,
      averagePercentage: sub.averagePercentage,
      grade,
      points,
    };
  });

  const gradedSubjects = subjectSummaries.filter((s) => s.points !== null);
  const totalPoints = gradedSubjects.reduce((acc, s) => acc + (s.points ?? 0), 0);
  const averagePoints = gradedSubjects.length > 0
    ? Number((totalPoints / gradedSubjects.length).toFixed(2))
    : 0;

  const sumAllMarks = aggregatedSubjects.reduce((acc, s) => acc + (s.sumMarks ?? 0), 0);
  const sumAllTotal = aggregatedSubjects.reduce((acc, s) => acc + (s.sumTotal ?? 0), 0);
  const overallPercentage = sumAllTotal > 0 ? (sumAllMarks / sumAllTotal) * 100 : 0;
  const { grade: overallGrade } = computeCBCGrade(cls.levelCategory, overallPercentage);

  const attendanceSummary = { totalDays: submittedDaysCount, present: 0, absent: 0, late: 0, excused: 0 };
  for (const row of attendanceByStatus) {
    if (Object.prototype.hasOwnProperty.call(attendanceSummary, row._id)) {
      attendanceSummary[row._id] = row.count;
    }
  }

  return {
    levelCategory: cls.levelCategory,
    subjects: subjectSummaries,
    totalPoints,
    averagePoints,
    overallGrade,
    attendanceSummary,
    generatedAt: new Date(),
  };
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/v1/report-cards/generate
 * Generates (or regenerates) a report card for one student + term + year.
 * Regeneration is blocked if the card is already published.
 */
export const generateReportCard = asyncHandler(async (req, res) => {
  const { studentId, academicYear, term } = req.body;

  const student = await Student.findOne({
    _id: studentId,
    schoolId: req.user.schoolId,
    status: STUDENT_STATUSES.ACTIVE,
  });
  if (!student) return sendError(res, 'Active student not found in this school.', 404);

  const cls = await Class.findOne({ _id: student.classId, schoolId: req.user.schoolId });
  if (!cls) return sendError(res, 'Student class not found.', 404);

  // Block regeneration if already published
  const existing = await ReportCard.findOne({
    schoolId: req.user.schoolId,
    studentId,
    academicYear,
    term,
  });

  if (existing?.status === 'published') {
    return sendError(
      res,
      'Report card is already published and cannot be regenerated.',
      409
    );
  }

  const payload = await buildReportCardPayload(
    req.user.schoolId,
    student,
    cls,
    academicYear,
    term
  );

  // Re-attach any per-subject remarks the teacher wrote before regeneration
  if (existing) {
    const existingRemarkMap = new Map(
      existing.subjects
        .filter((s) => s.teacherRemark)
        .map((s) => [s.subjectId.toString(), s.teacherRemark])
    );
    for (const subj of payload.subjects) {
      const remark = existingRemarkMap.get(subj.subjectId.toString());
      if (remark) subj.teacherRemark = remark;
    }
  }

  // Upsert — create fresh or overwrite the existing draft
  const reportCard = await ReportCard.findOneAndUpdate(
    {
      schoolId: req.user.schoolId,
      studentId,
      academicYear,
      term,
    },
    {
      schoolId: req.user.schoolId,
      studentId,
      classId: cls._id,
      academicYear,
      term,
      ...payload,
      // Preserve overall remarks on regeneration
      ...(existing
        ? {
            teacherRemarks: existing.teacherRemarks,
            principalRemarks: existing.principalRemarks,
          }
        : {}),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const populated = await ReportCard.findById(reportCard._id)
    .populate('studentId', 'firstName lastName admissionNumber gender photo')
    .populate('classId', 'name stream levelCategory academicYear term');

  await queueReportPdf({
    reportCardId: reportCard._id,
    schoolId: req.user.schoolId,
    requestedByUserId: req.user._id,
  });

  await notifyUser({
    schoolId: req.user.schoolId,
    userId: req.user._id,
    type: 'info',
    title: 'Report Card PDF Queued',
    message: `Generating PDF for ${student.firstName} ${student.lastName} (${term} ${academicYear}).`,
    link: `/report-cards/${reportCard._id}`,
    meta: { reportCardId: reportCard._id.toString() },
  });

  return sendSuccess(res, { reportCard: populated }, existing ? 200 : 201);
});

/**
 * POST /api/v1/report-cards/generate-class
 * Bulk-generates (or regenerates) report cards for all active students in a class.
 * Skips students whose cards are already published.
 */
export const generateClassReportCards = asyncHandler(async (req, res) => {
  const { classId, academicYear, term } = req.body;

  const cls = await Class.findOne({ _id: classId, schoolId: req.user.schoolId });
  if (!cls) return sendError(res, 'Class not found.', 404);

  const students = await Student.find({
    schoolId: req.user.schoolId,
    classId,
    status: STUDENT_STATUSES.ACTIVE,
  }).lean();

  if (students.length === 0) {
    return sendError(res, 'No active students found in this class.', 404);
  }

  // Load existing cards to check published status
  const existingCards = await ReportCard.find({
    schoolId: req.user.schoolId,
    classId,
    academicYear,
    term,
  }).lean();

  const publishedStudentIds = new Set(
    existingCards
      .filter((c) => c.status === 'published')
      .map((c) => c.studentId.toString())
  );

  const existingByStudentId = new Map(
    existingCards.map((c) => [c.studentId.toString(), c])
  );

  const results = { generated: 0, skipped: 0, errors: [] };

  for (const student of students) {
    const studentIdStr = student._id.toString();

    if (publishedStudentIds.has(studentIdStr)) {
      results.skipped++;
      continue;
    }

    try {
      const payload = await buildReportCardPayload(
        req.user.schoolId,
        student,
        cls,
        academicYear,
        term
      );
      const existing = existingByStudentId.get(studentIdStr);

      // Re-attach per-subject remarks the teacher wrote before this regeneration
      if (existing) {
        const existingRemarkMap = new Map(
          existing.subjects
            .filter((s) => s.teacherRemark)
            .map((s) => [s.subjectId.toString(), s.teacherRemark])
        );
        for (const subj of payload.subjects) {
          const remark = existingRemarkMap.get(subj.subjectId.toString());
          if (remark) subj.teacherRemark = remark;
        }
      }

      const reportCard = await ReportCard.findOneAndUpdate(
        {
          schoolId: req.user.schoolId,
          studentId: student._id,
          academicYear,
          term,
        },
        {
          schoolId: req.user.schoolId,
          studentId: student._id,
          classId,
          academicYear,
          term,
          ...payload,
          ...(existing
            ? {
                teacherRemarks: existing.teacherRemarks,
                principalRemarks: existing.principalRemarks,
              }
            : {}),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      await queueReportPdf({
        reportCardId: reportCard._id,
        schoolId: req.user.schoolId,
        requestedByUserId: req.user._id,
      });

      results.generated++;
    } catch (err) {
      results.errors.push({ studentId: student._id, error: err.message });
    }
  }

  await notifyUser({
    schoolId: req.user.schoolId,
    userId: req.user._id,
    type: 'info',
    title: 'Class Report Card PDFs Queued',
    message: `${results.generated} student PDF job(s) queued for ${term} ${academicYear}.`,
    link: '/report-cards',
    meta: { classId, term, academicYear, generated: results.generated, skipped: results.skipped },
  });

  return sendSuccess(res, {
    message: `Report cards generated for ${results.generated} student(s). ${results.skipped} skipped (published).`,
    ...results,
  });
});

/**
 * GET /api/v1/report-cards/annual-summary
 * Returns Term 1, 2, and 3 report cards for a student in a given academic year,
 * plus a cross-term subject comparison and annual average.
 *
 * Query params: studentId (required), academicYear (required)
 *
 * Response shape:
 * {
 *   student:  { _id, firstName, lastName, admissionNumber },
 *   academicYear: "2025",
 *   terms: {
 *     "Term 1": { status, overallGrade, totalPoints, averagePoints, subjects: [...] } | null,
 *     "Term 2": ... | null,
 *     "Term 3": ... | null,
 *   },
 *   annualSummary: {
 *     termsAvailable: number,          // how many terms have generated cards
 *     annualAveragePoints: number,     // average of averagePoints across available terms
 *     subjects: [                      // per-subject cross-term comparison
 *       {
 *         subjectName, subjectCode,
 *         term1: { grade, points, avgPct, remark } | null,
 *         term2: ...,
 *         term3: ...,
 *         annualAvgPct: number | null  // weighted across terms that have data
 *       }
 *     ]
 *   }
 * }
 */
export const getAnnualSummary = asyncHandler(async (req, res) => {
  const { studentId, academicYear } = req.query;

  if (!studentId || !academicYear) {
    return sendError(res, 'studentId and academicYear query params are required.', 400);
  }

  const student = await Student.findOne({ _id: studentId, schoolId: req.user.schoolId })
    .select('firstName lastName admissionNumber classId');
  if (!student) return sendError(res, 'Student not found.', 404);

  // Fetch all three terms in one query
  const cards = await ReportCard.find({
    schoolId: req.user.schoolId,
    studentId: student._id,
    academicYear,
  })
    .populate('classId', 'name stream levelCategory')
    .lean();

  // Index by term for O(1) lookup
  const cardByTerm = new Map(cards.map((c) => [c.term, c]));

  const TERMS_LIST = ['Term 1', 'Term 2', 'Term 3'];

  // Build the per-term summaries (null if card doesn't exist yet)
  const terms = {};
  for (const term of TERMS_LIST) {
    const card = cardByTerm.get(term);
    if (!card) {
      terms[term] = null;
      continue;
    }
    terms[term] = {
      _id:           card._id,
      status:        card.status,
      overallGrade:  card.overallGrade,
      totalPoints:   card.totalPoints,
      averagePoints: card.averagePoints,
      attendanceSummary: card.attendanceSummary,
      teacherRemarks:    card.teacherRemarks,
      principalRemarks:  card.principalRemarks,
      subjects: card.subjects.map((s) => ({
        subjectId:        s.subjectId,
        subjectName:      s.subjectName,
        subjectCode:      s.subjectCode,
        averagePercentage: s.averagePercentage,
        grade:            s.grade,
        points:           s.points,
        teacherRemark:    s.teacherRemark ?? null,
      })),
    };
  }

  // ── Cross-term subject comparison ─────────────────────────────────────────
  // Collect unique subjects (by name, since subjectId may differ across terms
  // if the subject was recreated) using subjectName as the stable key.
  const subjectNameSet = new Set();
  for (const card of cards) {
    for (const s of card.subjects) subjectNameSet.add(s.subjectName);
  }

  const subjectComparison = [];
  for (const subjectName of [...subjectNameSet].sort()) {
    const row = { subjectName, subjectCode: null, term1: null, term2: null, term3: null };

    let sumPct = 0;
    let countPct = 0;

    for (const [termLabel, termKey] of [
      ['term1', 'Term 1'],
      ['term2', 'Term 2'],
      ['term3', 'Term 3'],
    ]) {
      const card = cardByTerm.get(termKey);
      if (!card) continue;
      const subj = card.subjects.find((s) => s.subjectName === subjectName);
      if (!subj) continue;

      row[termLabel] = {
        grade:   subj.grade ?? null,
        points:  subj.points ?? null,
        avgPct:  subj.averagePercentage,
        remark:  subj.teacherRemark ?? null,
      };

      if (row.subjectCode === null && subj.subjectCode) {
        row.subjectCode = subj.subjectCode;
      }

      sumPct += subj.averagePercentage;
      countPct++;
    }

    row.annualAvgPct = countPct > 0
      ? Number((sumPct / countPct).toFixed(2))
      : null;

    subjectComparison.push(row);
  }

  // ── Annual headline stats ─────────────────────────────────────────────────
  const availableCards = cards.filter(Boolean);
  const termsAvailable = availableCards.length;
  const annualAveragePoints = termsAvailable > 0
    ? Number(
        (availableCards.reduce((sum, c) => sum + (c.averagePoints ?? 0), 0) / termsAvailable).toFixed(2)
      )
    : null;

  return sendSuccess(res, {
    student: {
      _id:             student._id,
      firstName:       student.firstName,
      lastName:        student.lastName,
      admissionNumber: student.admissionNumber,
    },
    academicYear,
    terms,
    annualSummary: {
      termsAvailable,
      annualAveragePoints,
      subjects: subjectComparison,
    },
  });
});

/**
 * GET /api/v1/report-cards
 */
export const listReportCards = asyncHandler(async (req, res) => {
  const filter = { schoolId: req.user.schoolId };
  if (req.query.classId) filter.classId = req.query.classId;
  if (req.query.studentId) filter.studentId = req.query.studentId;
  if (req.query.academicYear) filter.academicYear = req.query.academicYear;
  if (req.query.term) filter.term = req.query.term;
  if (req.query.status) filter.status = req.query.status;

  const total = await ReportCard.countDocuments(filter);
  const { skip, limit, meta } = paginate(req.query, total);

  const reportCards = await ReportCard.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('studentId', 'firstName lastName admissionNumber gender photo')
    .populate('classId', 'name stream levelCategory');

  return sendSuccess(res, { reportCards, meta });
});

/**
 * GET /api/v1/report-cards/:id
 */
export const getReportCard = asyncHandler(async (req, res) => {
  const reportCard = await ReportCard.findOne({
    _id: req.params.id,
    schoolId: req.user.schoolId,
  })
    .populate('studentId', 'firstName lastName admissionNumber gender photo dateOfBirth')
    .populate('classId', 'name stream levelCategory academicYear term');

  if (!reportCard) return sendError(res, 'Report card not found.', 404);

  return sendSuccess(res, { reportCard });
});

/**
 * PATCH /api/v1/report-cards/:id/remarks
 * Updates teacher/principal remarks on a draft report card.
 */
export const updateRemarks = asyncHandler(async (req, res) => {
  const reportCard = await ReportCard.findOne({
    _id: req.params.id,
    schoolId: req.user.schoolId,
  });

  if (!reportCard) return sendError(res, 'Report card not found.', 404);

  if (reportCard.status === 'published') {
    return sendError(res, 'Cannot update remarks on a published report card.', 409);
  }

  if (req.body.teacherRemarks !== undefined) {
    reportCard.teacherRemarks = req.body.teacherRemarks || undefined;
  }
  if (req.body.principalRemarks !== undefined) {
    reportCard.principalRemarks = req.body.principalRemarks || undefined;
  }

  await reportCard.save();

  return sendSuccess(res, { reportCard });
});

/**
 * PATCH /api/v1/report-cards/:id/subjects/:subjectId/remark
 * Adds or updates the teacher's per-subject remark on a draft report card.
 * Pass remark: "" or remark: null to clear an existing remark.
 * Blocked on published report cards.
 */
export const updateSubjectRemark = asyncHandler(async (req, res) => {
  const { id, subjectId } = req.params;

  const reportCard = await ReportCard.findOne({
    _id: id,
    schoolId: req.user.schoolId,
  });

  if (!reportCard) return sendError(res, 'Report card not found.', 404);

  if (reportCard.status === 'published') {
    return sendError(res, 'Cannot edit remarks on a published report card.', 409);
  }

  // Find the matching subject entry within the embedded subjects array
  const subject = reportCard.subjects.find(
    (s) => s.subjectId.toString() === subjectId
  );

  if (!subject) {
    return sendError(
      res,
      'Subject not found on this report card. Generate the report card first.',
      404
    );
  }

  const { remark } = req.body;

  // Empty string or null clears the remark
  subject.teacherRemark = remark ? remark.trim() : undefined;

  await reportCard.save();

  return sendSuccess(res, {
    message: remark ? 'Subject remark updated.' : 'Subject remark cleared.',
    subjectId,
    teacherRemark: subject.teacherRemark ?? null,
  });
});

/**
 * POST /api/v1/report-cards/:id/publish
 * Locks a report card — no further regeneration or remarks edits are allowed.
 */
export const publishReportCard = asyncHandler(async (req, res) => {
  const reportCard = await ReportCard.findOne({
    _id: req.params.id,
    schoolId: req.user.schoolId,
  });

  if (!reportCard) return sendError(res, 'Report card not found.', 404);

  if (reportCard.status === 'published') {
    return sendError(res, 'Report card is already published.', 400);
  }

  if (reportCard.subjects.length === 0) {
    return sendError(res, 'Cannot publish a report card with no subject results.', 400);
  }

  reportCard.status = 'published';
  reportCard.publishedAt = new Date();
  await reportCard.save();

  await queueReportPdf({
    reportCardId: reportCard._id,
    schoolId: req.user.schoolId,
    requestedByUserId: req.user._id,
  });

  await notifyUser({
    schoolId: req.user.schoolId,
    userId: req.user._id,
    type: 'info',
    title: 'Published Report Card PDF Queued',
    message: `PDF regeneration queued for ${reportCard.term} ${reportCard.academicYear}.`,
    link: `/report-cards/${reportCard._id}`,
    meta: { reportCardId: reportCard._id.toString() },
  });

  logAction(req, {
    action: AUDIT_ACTIONS.PUBLISH,
    resource: AUDIT_RESOURCES.REPORT_CARD,
    resourceId: reportCard._id,
    meta: {
      studentId: reportCard.studentId.toString(),
      academicYear: reportCard.academicYear,
      term: reportCard.term,
    },
  });

  return sendSuccess(res, { reportCard });
});

/**
 * POST /api/v1/report-cards/:id/generate-pdf
 * Explicitly re-queues PDF generation for a report card.
 */
export const generateReportCardPdf = asyncHandler(async (req, res) => {
  const reportCard = await ReportCard.findOne({
    _id: req.params.id,
    schoolId: req.user.schoolId,
  })
    .populate('studentId', 'firstName lastName');

  if (!reportCard) return sendError(res, 'Report card not found.', 404);

  await queueReportPdf({
    reportCardId: reportCard._id,
    schoolId: req.user.schoolId,
    requestedByUserId: req.user._id,
  });

  await notifyUser({
    schoolId: req.user.schoolId,
    userId: req.user._id,
    type: 'info',
    title: 'Report Card PDF Queued',
    message: `Regeneration queued for ${reportCard.studentId?.firstName ?? 'student'} ${reportCard.studentId?.lastName ?? ''}`.trim(),
    link: `/report-cards/${reportCard._id}`,
    meta: { reportCardId: reportCard._id.toString() },
  });

  return sendSuccess(res, { message: 'PDF generation queued.' }, 202);
});
