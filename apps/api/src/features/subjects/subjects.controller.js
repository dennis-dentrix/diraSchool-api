import Subject from './Subject.model.js';
import Class from '../classes/Class.model.js';
import User from '../users/User.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { paginate } from '../../utils/pagination.js';
import { LEVEL_CATEGORIES, ROLES } from '../../constants/index.js';

const validateClassForSubject = async (schoolId, classId) => {
  const cls = await Class.findOne({ _id: classId, schoolId });
  if (!cls) return { error: { message: 'Class not found.', statusCode: 404 } };

  if (cls.levelCategory === LEVEL_CATEGORIES.PRE_PRIMARY) {
    return {
      error: {
        message: 'Pre-Primary classes cannot have subjects.',
        statusCode: 400,
      },
    };
  }

  return { cls };
};

/**
 * POST /api/v1/subjects
 */
export const createSubject = asyncHandler(async (req, res) => {
  const { classId, name, code } = req.body;

  const check = await validateClassForSubject(req.user.schoolId, classId);
  if (check.error) return sendError(res, check.error.message, check.error.statusCode);

  const subject = await Subject.create({
    schoolId: req.user.schoolId,
    classId,
    name: name.trim(),
    code: code?.trim().toUpperCase(),
  });

  return sendSuccess(res, { subject }, 201);
});

/**
 * GET /api/v1/subjects
 */
export const listSubjects = asyncHandler(async (req, res) => {
  const filter = { schoolId: req.user.schoolId };
  if (req.query.classId) filter.classId = req.query.classId;
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

  const total = await Subject.countDocuments(filter);
  const { skip, limit, meta } = paginate(req.query, total);

  const subjects = await Subject.find(filter)
    .sort({ name: 1 })
    .skip(skip)
    .limit(limit)
    .populate('classId', 'name stream levelCategory academicYear term')
    .populate('teacherId', 'firstName lastName email');

  return sendSuccess(res, { subjects, meta });
});

/**
 * GET /api/v1/subjects/:id
 */
export const getSubject = asyncHandler(async (req, res) => {
  const subject = await Subject.findOne({
    _id: req.params.id,
    schoolId: req.user.schoolId,
  })
    .populate('classId', 'name stream levelCategory academicYear term')
    .populate('teacherId', 'firstName lastName email');

  if (!subject) return sendError(res, 'Subject not found.', 404);

  return sendSuccess(res, { subject });
});

/**
 * PATCH /api/v1/subjects/:id
 */
export const updateSubject = asyncHandler(async (req, res) => {
  const subject = await Subject.findOne({
    _id: req.params.id,
    schoolId: req.user.schoolId,
  });

  if (!subject) return sendError(res, 'Subject not found.', 404);

  const { classId, name, code, isActive } = req.body;

  if (classId !== undefined) {
    const check = await validateClassForSubject(req.user.schoolId, classId);
    if (check.error) return sendError(res, check.error.message, check.error.statusCode);
    subject.classId = classId;
  }

  if (name !== undefined) subject.name = name.trim();
  if (code !== undefined) subject.code = code ? code.trim().toUpperCase() : undefined;
  if (isActive !== undefined) subject.isActive = isActive;

  await subject.save();

  return sendSuccess(res, { subject });
});

/**
 * PATCH /api/v1/subjects/:id/teacher
 * Assigns (or unassigns) a teacher to a subject.
 * teacherId must belong to this school and have role = teacher.
 * Pass teacherId: null to remove the current assignment.
 */
export const assignTeacher = asyncHandler(async (req, res) => {
  const subject = await Subject.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!subject) return sendError(res, 'Subject not found.', 404);

  const { teacherId } = req.body;

  if (teacherId === null || teacherId === undefined) {
    subject.teacherId = undefined;
  } else {
    const teacher = await User.findOne({
      _id: teacherId,
      schoolId: req.user.schoolId,
      role: ROLES.TEACHER,
      isActive: true,
    });
    if (!teacher) return sendError(res, 'Active teacher not found in this school.', 404);
    subject.teacherId = teacher._id;
  }

  await subject.save();

  const populated = await Subject.findById(subject._id)
    .populate('classId', 'name stream levelCategory academicYear term')
    .populate('teacherId', 'firstName lastName email');

  return sendSuccess(res, { subject: populated });
});

/**
 * DELETE /api/v1/subjects/:id
 */
export const deleteSubject = asyncHandler(async (req, res) => {
  const subject = await Subject.findOne({
    _id: req.params.id,
    schoolId: req.user.schoolId,
  });

  if (!subject) return sendError(res, 'Subject not found.', 404);

  await subject.deleteOne();
  return sendSuccess(res, { message: 'Subject deleted.' });
});
