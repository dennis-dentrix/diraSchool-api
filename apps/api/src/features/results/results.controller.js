import Result from './Result.model.js';
import Exam from '../exams/Exam.model.js';
import Class from '../classes/Class.model.js';
import Subject from '../subjects/Subject.model.js';
import Student from '../students/Student.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { paginate } from '../../utils/pagination.js';
import { computeCBCGrade } from '../../utils/grading.js';
import { STUDENT_STATUSES } from '../../constants/index.js';

const TYPE_LABEL_MAP = {
  opener: 'Opener',
  midterm: 'Mid Term',
  endterm: 'End Term',
  sba: 'SBA',
};

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

/**
 * GET /api/v1/results/session
 * Load existing exams + results for a (classId, type, term, academicYear) session.
 */
export const getSessionResults = asyncHandler(async (req, res) => {
  const { classId, type, term, academicYear } = req.query;
  const schoolId = req.user.schoolId;

  const exams = await Exam.find({ schoolId, classId, type, term, academicYear })
    .populate('subjectId', 'name code')
    .lean();

  if (exams.length === 0) {
    return sendSuccess(res, { exams: [], results: [] });
  }

  const examIds = exams.map((e) => e._id);
  const results = await Result.find({ schoolId, examId: { $in: examIds } }).lean();

  return sendSuccess(res, { exams, results });
});

/**
 * POST /api/v1/results/session
 * Find-or-create exams per subject and bulk-upsert results for a session.
 * subjects: [{ subjectId, totalMarks, entries: [{ studentId, marks }] }]
 */
export const sessionSaveResults = asyncHandler(async (req, res) => {
  const { classId, type, term, academicYear, subjects } = req.body;
  const schoolId = req.user.schoolId;

  const cls = await Class.findOne({ _id: classId, schoolId });
  if (!cls) return sendError(res, 'Class not found.', 404);

  const examName = TYPE_LABEL_MAP[type] ?? type;
  const allResults = [];

  for (const subjectData of subjects) {
    const { subjectId, totalMarks, entries = [] } = subjectData;
    if (!entries.length) continue;

    const subject = await Subject.findOne({ _id: subjectId, schoolId, classId });
    if (!subject) continue;

    for (const entry of entries) {
      if (entry.marks > totalMarks) {
        return sendError(
          res,
          `Marks for student ${entry.studentId} exceed total marks (${totalMarks}) for subject ${subject.name}.`,
          400
        );
      }
    }

    // Find or create the exam for this subject in this session
    let exam = await Exam.findOne({ schoolId, classId, subjectId, type, term, academicYear });
    if (!exam) {
      exam = await Exam.create({
        schoolId, classId, subjectId,
        name: examName, type, term, academicYear,
        levelCategory: cls.levelCategory,
        totalMarks,
      });
    } else if (exam.totalMarks !== totalMarks) {
      exam.totalMarks = totalMarks;
      await exam.save();
    }

    const ops = entries.map((entry) => {
      const computed = computeResultPayload(exam, entry.marks);
      return Result.findOneAndUpdate(
        { schoolId, examId: exam._id, studentId: entry.studentId },
        {
          schoolId, examId: exam._id, classId, subjectId,
          studentId: entry.studentId, term, academicYear, ...computed,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    });

    const saved = await Promise.all(ops);
    allResults.push(...saved);
  }

  return sendSuccess(res, { count: allResults.length }, 201);
});
