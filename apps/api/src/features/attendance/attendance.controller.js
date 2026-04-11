import Attendance from './Attendance.model.js';
import Class from '../classes/Class.model.js';
import Student from '../students/Student.model.js';
import User from '../users/User.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { paginate } from '../../utils/pagination.js';
import {
  ATTENDANCE_REGISTER_STATUSES,
  ROLES,
  STUDENT_STATUSES,
} from '../../constants/index.js';

const normaliseDate = (dateString) => {
  return new Date(`${dateString}T00:00:00.000Z`);
};

const validateEntriesForClass = async (schoolId, classId, entries) => {
  if (!entries || entries.length === 0) return true;

  const studentIds = entries.map((entry) => entry.studentId);

  const matchingStudents = await Student.countDocuments({
    _id: { $in: studentIds },
    schoolId,
    classId,
    status: STUDENT_STATUSES.ACTIVE,
  });

  return matchingStudents === studentIds.length;
};

const resolveSubstituteMeta = async (req, cls, substituteTeacherId) => {
  if (!substituteTeacherId) {
    return {
      takenByUserId: req.user._id,
      substituteTeacherId: undefined,
      isSubstitute: false,
    };
  }

  const substitute = await User.findOne({
    _id: substituteTeacherId,
    schoolId: req.user.schoolId,
    role: ROLES.TEACHER,
    isActive: true,
  }).select('_id');

  if (!substitute) return null;

  const isSubstitute =
    !cls.classTeacherId || !cls.classTeacherId.equals(substituteTeacherId);

  return {
    takenByUserId: substitute._id,
    substituteTeacherId: substitute._id,
    isSubstitute,
  };
};

/**
 * POST /api/v1/attendance/registers
 * Creates a class attendance register for a specific date.
 */
export const createAttendanceRegister = asyncHandler(async (req, res) => {
  const { classId, date, entries, substituteTeacherId, substituteNote } = req.body;

  const cls = await Class.findOne({ _id: classId, schoolId: req.user.schoolId });
  if (!cls) return sendError(res, 'Class not found.', 404);

  const entriesAreValid = await validateEntriesForClass(
    req.user.schoolId,
    classId,
    entries
  );
  if (!entriesAreValid) {
    return sendError(
      res,
      'One or more students are invalid, inactive, or not in the selected class.',
      400
    );
  }

  const substituteMeta = await resolveSubstituteMeta(req, cls, substituteTeacherId);
  if (!substituteMeta) {
    return sendError(res, 'Substitute teacher not found in this school.', 404);
  }

  const register = await Attendance.create({
    schoolId: req.user.schoolId,
    classId,
    date: normaliseDate(date),
    academicYear: cls.academicYear,
    term: cls.term,
    entries: entries || [],
    substituteNote: substituteNote || undefined,
    ...substituteMeta,
  });

  const populated = await Attendance.findById(register._id)
    .populate('classId', 'name stream academicYear term')
    .populate('takenByUserId', 'firstName lastName role')
    .populate('substituteTeacherId', 'firstName lastName role')
    .populate('entries.studentId', 'firstName lastName admissionNumber');

  return sendSuccess(res, { register: populated }, 201);
});

/**
 * GET /api/v1/attendance/registers
 * Lists attendance registers for a school.
 */
export const listAttendanceRegisters = asyncHandler(async (req, res) => {
  const filter = { schoolId: req.user.schoolId };
  if (req.query.classId) filter.classId = req.query.classId;
  if (req.query.date) filter.date = normaliseDate(req.query.date);
  if (req.query.status) filter.status = req.query.status;
  if (req.query.term) filter.term = req.query.term;
  if (req.query.academicYear) filter.academicYear = req.query.academicYear;

  const total = await Attendance.countDocuments(filter);
  const { skip, limit, meta } = paginate(req.query, total);

  const registers = await Attendance.find(filter)
    .sort({ date: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('classId', 'name stream academicYear term')
    .populate('takenByUserId', 'firstName lastName role')
    .populate('substituteTeacherId', 'firstName lastName role');

  return sendSuccess(res, { registers, meta });
});

/**
 * GET /api/v1/attendance/registers/:id
 */
export const getAttendanceRegister = asyncHandler(async (req, res) => {
  const register = await Attendance.findOne({
    _id: req.params.id,
    schoolId: req.user.schoolId,
  })
    .populate('classId', 'name stream academicYear term')
    .populate('takenByUserId', 'firstName lastName role')
    .populate('substituteTeacherId', 'firstName lastName role')
    .populate('entries.studentId', 'firstName lastName admissionNumber');

  if (!register) return sendError(res, 'Attendance register not found.', 404);

  return sendSuccess(res, { register });
});

/**
 * PATCH /api/v1/attendance/registers/:id
 * Edits a draft register only.
 */
export const updateAttendanceRegister = asyncHandler(async (req, res) => {
  const register = await Attendance.findOne({
    _id: req.params.id,
    schoolId: req.user.schoolId,
  });

  if (!register) return sendError(res, 'Attendance register not found.', 404);

  if (register.status === ATTENDANCE_REGISTER_STATUSES.SUBMITTED) {
    return sendError(res, 'Submitted attendance cannot be edited.', 409);
  }

  const cls = await Class.findOne({ _id: register.classId, schoolId: req.user.schoolId });
  if (!cls) return sendError(res, 'Class not found.', 404);

  const { entries, substituteTeacherId, substituteNote } = req.body;

  if (entries !== undefined) {
    const entriesAreValid = await validateEntriesForClass(
      req.user.schoolId,
      register.classId,
      entries
    );
    if (!entriesAreValid) {
      return sendError(
        res,
        'One or more students are invalid, inactive, or not in the selected class.',
        400
      );
    }
    register.entries = entries;
  }

  if (substituteTeacherId !== undefined) {
    if (substituteTeacherId === null) {
      register.substituteTeacherId = undefined;
      register.substituteNote = undefined;
      register.takenByUserId = req.user._id;
      register.isSubstitute = false;
    } else {
      const substituteMeta = await resolveSubstituteMeta(req, cls, substituteTeacherId);
      if (!substituteMeta) {
        return sendError(res, 'Substitute teacher not found in this school.', 404);
      }
      register.takenByUserId = substituteMeta.takenByUserId;
      register.substituteTeacherId = substituteMeta.substituteTeacherId;
      register.isSubstitute = substituteMeta.isSubstitute;
    }
  }

  if (substituteNote !== undefined) {
    register.substituteNote = substituteNote || undefined;
  }

  await register.save();

  const populated = await Attendance.findById(register._id)
    .populate('classId', 'name stream academicYear term')
    .populate('takenByUserId', 'firstName lastName role')
    .populate('substituteTeacherId', 'firstName lastName role')
    .populate('entries.studentId', 'firstName lastName admissionNumber');

  return sendSuccess(res, { register: populated });
});

/**
 * POST /api/v1/attendance/registers/:id/submit
 * Finalises a draft register and locks edits.
 */
export const submitAttendanceRegister = asyncHandler(async (req, res) => {
  const register = await Attendance.findOne({
    _id: req.params.id,
    schoolId: req.user.schoolId,
  });

  if (!register) return sendError(res, 'Attendance register not found.', 404);

  if (register.status === ATTENDANCE_REGISTER_STATUSES.SUBMITTED) {
    return sendError(res, 'Attendance register already submitted.', 400);
  }

  if (!register.entries || register.entries.length === 0) {
    return sendError(res, 'Cannot submit attendance with no student entries.', 400);
  }

  register.status = ATTENDANCE_REGISTER_STATUSES.SUBMITTED;
  register.submittedAt = new Date();
  await register.save();

  return sendSuccess(res, {
    register,
    message: 'Attendance register submitted.',
  });
});
