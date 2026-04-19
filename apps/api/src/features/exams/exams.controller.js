import Exam from './Exam.model.js';
import Class from '../classes/Class.model.js';
import Subject from '../subjects/Subject.model.js';
import Result from '../results/Result.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { paginate } from '../../utils/pagination.js';
import { LEVEL_CATEGORIES } from '../../constants/index.js';

const validateClassAndSubject = async (schoolId, classId, subjectId) => {
  const cls = await Class.findOne({ _id: classId, schoolId });
  if (!cls) return { error: { message: 'Class not found.', statusCode: 404 } };

  if (cls.levelCategory === LEVEL_CATEGORIES.PRE_PRIMARY) {
    return {
      error: {
        message: 'Pre-Primary classes cannot have exams.',
        statusCode: 400,
      },
    };
  }

  const subject = await Subject.findOne({ _id: subjectId, schoolId, classId });
  if (!subject) {
    return {
      error: {
        message: 'Subject not found for this class.',
        statusCode: 404,
      },
    };
  }

  return { cls, subject };
};

/**
 * POST /api/v1/exams
 */
export const createExam = asyncHandler(async (req, res) => {
  const { classId, subjectId, name, type, totalMarks, examPaperUrl } = req.body;

  const check = await validateClassAndSubject(req.user.schoolId, classId, subjectId);
  if (check.error) return sendError(res, check.error.message, check.error.statusCode);

  const exam = await Exam.create({
    schoolId: req.user.schoolId,
    classId,
    subjectId,
    name: name.trim(),
    type,
    totalMarks,
    term: check.cls.term,
    academicYear: check.cls.academicYear,
    levelCategory: check.cls.levelCategory,
    examPaperUrl: examPaperUrl || undefined,
  });

  return sendSuccess(res, { exam }, 201);
});

/**
 * GET /api/v1/exams
 */
export const listExams = asyncHandler(async (req, res) => {
  const filter = { schoolId: req.user.schoolId };
  if (req.query.classId) filter.classId = req.query.classId;
  if (req.query.subjectId) filter.subjectId = req.query.subjectId;
  if (req.query.type) filter.type = req.query.type;
  if (req.query.term) filter.term = req.query.term;
  if (req.query.academicYear) filter.academicYear = req.query.academicYear;

  const total = await Exam.countDocuments(filter);
  const { skip, limit, meta } = paginate(req.query, total);

  const exams = await Exam.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('classId', 'name stream levelCategory academicYear term')
    .populate('subjectId', 'name code');

  return sendSuccess(res, { exams, meta });
});

/**
 * GET /api/v1/exams/:id
 */
export const getExam = asyncHandler(async (req, res) => {
  const exam = await Exam.findOne({ _id: req.params.id, schoolId: req.user.schoolId })
    .populate('classId', 'name stream levelCategory academicYear term')
    .populate('subjectId', 'name code');

  if (!exam) return sendError(res, 'Exam not found.', 404);

  return sendSuccess(res, { exam });
});

/**
 * PATCH /api/v1/exams/:id
 */
export const updateExam = asyncHandler(async (req, res) => {
  const exam = await Exam.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!exam) return sendError(res, 'Exam not found.', 404);

  const { name, type, totalMarks, isPublished } = req.body;

  // Guard: changing totalMarks would invalidate all existing graded results
  if (totalMarks !== undefined && totalMarks !== exam.totalMarks) {
    const resultsCount = await Result.countDocuments({
      schoolId: req.user.schoolId,
      examId: exam._id,
    });
    if (resultsCount > 0) {
      return sendError(
        res,
        `Cannot change total marks — ${resultsCount} result(s) already recorded. Delete results first.`,
        409
      );
    }
  }

  if (name !== undefined) exam.name = name.trim();
  if (type !== undefined) exam.type = type;
  if (totalMarks !== undefined) exam.totalMarks = totalMarks;
  if (isPublished !== undefined) exam.isPublished = isPublished;

  await exam.save();

  return sendSuccess(res, { exam });
});

/**
 * DELETE /api/v1/exams/:id
 */
export const deleteExam = asyncHandler(async (req, res) => {
  const exam = await Exam.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!exam) return sendError(res, 'Exam not found.', 404);

  const resultsCount = await Result.countDocuments({
    schoolId: req.user.schoolId,
    examId: exam._id,
  });
  if (resultsCount > 0) {
    return sendError(
      res,
      `Cannot delete exam with ${resultsCount} result record(s).`,
      409
    );
  }

  await exam.deleteOne();
  return sendSuccess(res, { message: 'Exam deleted.' });
});
