import Department from './Department.model.js';
import Subject from './Subject.model.js';
import User from '../users/User.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { ROLES } from '../../constants/index.js';

/**
 * GET /api/v1/departments
 */
export const listDepartments = asyncHandler(async (req, res) => {
  const departments = await Department.find({ schoolId: req.user.schoolId })
    .populate('hodId', 'firstName lastName email')
    .sort({ name: 1 });

  // Attach subject count per department
  const names = departments.map((d) => d.name);
  const counts = await Subject.aggregate([
    { $match: { schoolId: req.user.schoolId, department: { $in: names } } },
    { $group: { _id: '$department', count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(counts.map((c) => [c._id, c.count]));

  const result = departments.map((d) => ({
    ...d.toObject(),
    subjectCount: countMap[d.name] ?? 0,
  }));

  return sendSuccess(res, { departments: result });
});

/**
 * POST /api/v1/departments
 */
export const createDepartment = asyncHandler(async (req, res) => {
  const { name, description, hodId } = req.body;

  if (!name?.trim()) return sendError(res, 'Department name is required.', 400);

  const exists = await Department.findOne({ schoolId: req.user.schoolId, name: name.trim() });
  if (exists) return sendError(res, 'A department with that name already exists.', 409);

  if (hodId) {
    const hod = await User.findOne({
      _id: hodId, schoolId: req.user.schoolId,
      role: { $in: [ROLES.TEACHER, ROLES.DEPARTMENT_HEAD] }, isActive: true,
    });
    if (!hod) return sendError(res, 'Head of Department user not found or inactive.', 404);
    if (hod.role === ROLES.TEACHER) { hod.role = ROLES.DEPARTMENT_HEAD; await hod.save(); }
  }

  const dept = await Department.create({
    schoolId: req.user.schoolId,
    name: name.trim(),
    description: description?.trim(),
    hodId: hodId || null,
  });

  const populated = await Department.findById(dept._id).populate('hodId', 'firstName lastName email');
  return sendSuccess(res, { department: { ...populated.toObject(), subjectCount: 0 } }, 201);
});

/**
 * PATCH /api/v1/departments/:id
 */
export const updateDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!dept) return sendError(res, 'Department not found.', 404);

  const { name, description, hodId } = req.body;
  const oldName = dept.name;

  if (name !== undefined) {
    const trimmed = name.trim();
    if (!trimmed) return sendError(res, 'Department name cannot be empty.', 400);
    const conflict = await Department.findOne({ schoolId: req.user.schoolId, name: trimmed, _id: { $ne: dept._id } });
    if (conflict) return sendError(res, 'A department with that name already exists.', 409);
    dept.name = trimmed;
  }

  if (description !== undefined) dept.description = description?.trim() || undefined;

  if (hodId !== undefined) {
    if (hodId === null) {
      dept.hodId = null;
    } else {
      const hod = await User.findOne({
        _id: hodId, schoolId: req.user.schoolId,
        role: { $in: [ROLES.TEACHER, ROLES.DEPARTMENT_HEAD] }, isActive: true,
      });
      if (!hod) return sendError(res, 'Head of Department user not found or inactive.', 404);
      if (hod.role === ROLES.TEACHER) { hod.role = ROLES.DEPARTMENT_HEAD; await hod.save(); }
      dept.hodId = hod._id;
    }
  }

  await dept.save();

  // Cascade rename to subjects that reference the old department name
  if (name !== undefined && dept.name !== oldName) {
    await Subject.updateMany({ schoolId: req.user.schoolId, department: oldName }, { department: dept.name });
  }

  const populated = await Department.findById(dept._id).populate('hodId', 'firstName lastName email');
  const subjectCount = await Subject.countDocuments({ schoolId: req.user.schoolId, department: dept.name });

  return sendSuccess(res, { department: { ...populated.toObject(), subjectCount } });
});

/**
 * DELETE /api/v1/departments/:id
 */
export const deleteDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!dept) return sendError(res, 'Department not found.', 404);

  const subjectCount = await Subject.countDocuments({ schoolId: req.user.schoolId, department: dept.name });
  if (subjectCount > 0) {
    return sendError(res, `Cannot delete: ${subjectCount} subject${subjectCount !== 1 ? 's' : ''} are assigned to this department. Reassign them first.`, 409);
  }

  await dept.deleteOne();
  return sendSuccess(res, { message: 'Department deleted.' });
});
