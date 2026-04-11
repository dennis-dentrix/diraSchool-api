import Result from './Result.model.js';
import Exam from '../exams/Exam.model.js';
import Student from '../students/Student.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { paginate } from '../../utils/pagination.js';
import { computeCBCGrade } from '../../utils/grading.js';
import { STUDENT_STATUSES } from '../../constants/index.js';

const computeResultPayload = (exam, marks) => {
  const percentage = Number(((marks / exam.totalMarks) * 100).toFixed(2));
  const { grade, points } = computeCBCGrade(exam.levelCategory, percentage);

  return {
    marks,
    totalMarks: exam.totalMarks,
    percentage,
    grade,
    points,
  };
};

const validateStudentsForExamClass = async (schoolId, classId, studentIds) => {
  const count = await Student.countDocuments({
    _id: { $in: studentIds },
    schoolId,
    classId,
    status: STUDENT_STATUSES.ACTIVE,
  });
  return count === studentIds.length;
};

/**
 * POST /api/v1/results/bulk
 * Upserts results for an exam and auto-computes CBC grade/points.
 */
export const bulkUpsertResults = asyncHandler(async (req, res) => {
  const { examId, entries } = req.body;

  const exam = await Exam.findOne({ _id: examId, schoolId: req.user.schoolId });
  if (!exam) return sendError(res, 'Exam not found.', 404);

  const studentIds = entries.map((entry) => entry.studentId);
  const studentsValid = await validateStudentsForExamClass(
    req.user.schoolId,
    exam.classId,
    studentIds
  );

  if (!studentsValid) {
    return sendError(
      res,
      'One or more students are invalid, inactive, or not in the exam class.',
      400
    );
  }

  for (const entry of entries) {
    if (entry.marks > exam.totalMarks) {
      return sendError(
        res,
        `Marks for student ${entry.studentId} cannot exceed exam total marks (${exam.totalMarks}).`,
        400
      );
    }
  }

  const operations = entries.map((entry) => {
    const computed = computeResultPayload(exam, entry.marks);

    return Result.findOneAndUpdate(
      {
        schoolId: req.user.schoolId,
        examId: exam._id,
        studentId: entry.studentId,
      },
      {
        schoolId: req.user.schoolId,
        examId: exam._id,
        classId: exam.classId,
        subjectId: exam.subjectId,
        studentId: entry.studentId,
        term: exam.term,
        academicYear: exam.academicYear,
        ...computed,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  });

  const results = await Promise.all(operations);

  return sendSuccess(res, { results, count: results.length }, 201);
});

/**
 * GET /api/v1/results
 */
export const listResults = asyncHandler(async (req, res) => {
  const filter = { schoolId: req.user.schoolId };
  if (req.query.examId) filter.examId = req.query.examId;
  if (req.query.classId) filter.classId = req.query.classId;
  if (req.query.subjectId) filter.subjectId = req.query.subjectId;
  if (req.query.studentId) filter.studentId = req.query.studentId;
  if (req.query.term) filter.term = req.query.term;
  if (req.query.academicYear) filter.academicYear = req.query.academicYear;

  const total = await Result.countDocuments(filter);
  const { skip, limit, meta } = paginate(req.query, total);

  const results = await Result.find(filter)
    .sort({ percentage: -1 })
    .skip(skip)
    .limit(limit)
    .populate('examId', 'name type totalMarks term academicYear')
    .populate('subjectId', 'name code')
    .populate('studentId', 'firstName lastName admissionNumber')
    .populate('classId', 'name stream levelCategory');

  return sendSuccess(res, { results, meta });
});

/**
 * GET /api/v1/results/:id
 */
export const getResult = asyncHandler(async (req, res) => {
  const result = await Result.findOne({ _id: req.params.id, schoolId: req.user.schoolId })
    .populate('examId', 'name type totalMarks term academicYear')
    .populate('subjectId', 'name code')
    .populate('studentId', 'firstName lastName admissionNumber')
    .populate('classId', 'name stream levelCategory');

  if (!result) return sendError(res, 'Result not found.', 404);

  return sendSuccess(res, { result });
});

/**
 * PATCH /api/v1/results/:id
 * Recomputes grade and points from updated marks.
 */
export const updateResult = asyncHandler(async (req, res) => {
  const result = await Result.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!result) return sendError(res, 'Result not found.', 404);

  const exam = await Exam.findOne({ _id: result.examId, schoolId: req.user.schoolId });
  if (!exam) return sendError(res, 'Exam not found.', 404);

  if (req.body.marks > exam.totalMarks) {
    return sendError(res, `Marks cannot exceed exam total marks (${exam.totalMarks}).`, 400);
  }

  const computed = computeResultPayload(exam, req.body.marks);
  result.marks = computed.marks;
  result.totalMarks = computed.totalMarks;
  result.percentage = computed.percentage;
  result.grade = computed.grade;
  result.points = computed.points;
  await result.save();

  return sendSuccess(res, { result });
});
