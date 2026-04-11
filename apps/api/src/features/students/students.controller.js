import mongoose from 'mongoose';
import Student from './Student.model.js';
import Class from '../classes/Class.model.js';
import User from '../users/User.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { paginate } from '../../utils/pagination.js';
import { normalisePhone } from '../../utils/phone.js';
import { ROLES, STUDENT_STATUSES, JOB_NAMES, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../../constants/index.js';
import { importQueue } from '../../jobs/queues.js';
import { getRedis } from '../../config/redis.js';
import { logAction } from '../../utils/auditLogger.js';

/**
 * POST /api/v1/students
 * Enrolls a new student.
 * If a parent object is supplied, auto-creates a parent User (or links an existing one).
 */
export const enrollStudent = asyncHandler(async (req, res) => {
  const {
    classId,
    admissionNumber,
    firstName,
    lastName,
    gender,
    dateOfBirth,
    parent,
  } = req.body;

  // Verify the target class belongs to this school
  const cls = await Class.findOne({ _id: classId, schoolId: req.user.schoolId });
  if (!cls) return sendError(res, 'Class not found.', 404);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let parentId;

    if (parent) {
      if (parent.existingUserId) {
        // Link an already-existing user in this school
        const existingUser = await User.findOne({
          _id: parent.existingUserId,
          schoolId: req.user.schoolId,
          role: ROLES.PARENT,
        }).session(session);

        if (!existingUser) {
          await session.abortTransaction();
          return sendError(res, 'Existing parent user not found in this school.', 404);
        }
        parentId = existingUser._id;
      } else {
        // Create a new parent user
        const phone = normalisePhone(parent.phone);
        const email = parent.email?.toLowerCase().trim() ||
          // Generate a placeholder email from phone if none provided
          `parent${phone.replace('+', '')}@placeholder.diraschool`;

        const [newParent] = await User.create(
          [
            {
              firstName: parent.firstName.trim(),
              lastName: parent.lastName.trim(),
              email,
              phone,
              password: phone, // temp password = their phone number; they must change on first login
              role: ROLES.PARENT,
              schoolId: req.user.schoolId,
              mustChangePassword: true,
            },
          ],
          { session }
        );
        parentId = newParent._id;
      }
    }

    const [student] = await Student.create(
      [
        {
          schoolId: req.user.schoolId,
          classId,
          admissionNumber: admissionNumber.trim().toUpperCase(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          gender,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
          parentIds: parentId ? [parentId] : [],
        },
      ],
      { session }
    );

    // If we created a parent, link this student to their children array
    if (parentId && !parent?.existingUserId) {
      await User.updateOne(
        { _id: parentId },
        { $addToSet: { children: student._id } },
        { session }
      );
    }

    await session.commitTransaction();

    const populated = await Student.findById(student._id).populate('parentIds', 'firstName lastName phone email');

    logAction(req, {
      action: AUDIT_ACTIONS.CREATE,
      resource: AUDIT_RESOURCES.STUDENT,
      resourceId: student._id,
      meta: { admissionNumber: student.admissionNumber, classId: classId.toString() },
    });

    return sendSuccess(res, { student: populated }, 201);
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
});

/**
 * GET /api/v1/students
 * Lists students for the school. Supports ?classId=, ?status=, ?search= (name/admission), ?page=, ?limit=
 */
export const listStudents = asyncHandler(async (req, res) => {
  const filter = { schoolId: req.user.schoolId };
  if (req.query.classId) filter.classId = req.query.classId;
  if (req.query.status) filter.status = req.query.status;

  if (req.query.search) {
    const rx = new RegExp(req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { firstName: rx },
      { lastName: rx },
      { admissionNumber: rx },
    ];
  }

  const total = await Student.countDocuments(filter);
  const { skip, limit, meta } = paginate(req.query, total);

  const students = await Student.find(filter)
    .sort({ lastName: 1, firstName: 1 })
    .skip(skip)
    .limit(limit)
    .populate('classId', 'name stream levelCategory')
    .populate('parentIds', 'firstName lastName phone email');

  return sendSuccess(res, { students, meta });
});

/**
 * GET /api/v1/students/:id
 */
export const getStudent = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ _id: req.params.id, schoolId: req.user.schoolId })
    .populate('classId', 'name stream levelCategory academicYear term')
    .populate('parentIds', 'firstName lastName phone email');

  if (!student) return sendError(res, 'Student not found.', 404);

  return sendSuccess(res, { student });
});

/**
 * PATCH /api/v1/students/:id
 * Updates basic details. Does NOT handle class transfer (use /transfer).
 */
export const updateStudent = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ _id: req.params.id, schoolId: req.user.schoolId });

  if (!student) return sendError(res, 'Student not found.', 404);

  const { firstName, lastName, gender, dateOfBirth, admissionNumber } = req.body;
  if (firstName !== undefined) student.firstName = firstName;
  if (lastName !== undefined) student.lastName = lastName;
  if (gender !== undefined) student.gender = gender;
  if (dateOfBirth !== undefined) student.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : undefined;
  if (admissionNumber !== undefined) student.admissionNumber = admissionNumber.trim().toUpperCase();

  // Prevent the post('save') hook from double-incrementing studentCount
  student.wasNew = false;
  await student.save();

  return sendSuccess(res, { student });
});

/**
 * POST /api/v1/students/:id/transfer
 * Moves a student to a different class within the same school.
 */
export const transferStudent = asyncHandler(async (req, res) => {
  const { newClassId, note } = req.body;

  const student = await Student.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!student) return sendError(res, 'Student not found.', 404);

  const newClass = await Class.findOne({ _id: newClassId, schoolId: req.user.schoolId });
  if (!newClass) return sendError(res, 'Target class not found.', 404);

  if (student.classId.equals(newClassId)) {
    return sendError(res, 'Student is already in this class.', 400);
  }

  const oldClassId = student.classId;

  // Update counts
  await Class.updateOne({ _id: oldClassId }, { $inc: { studentCount: -1 } });
  await Class.updateOne({ _id: newClassId }, { $inc: { studentCount: 1 } });

  student.classId = newClassId;
  if (note) student.transferNote = note;
  student.wasNew = false;
  await student.save();

  logAction(req, {
    action: AUDIT_ACTIONS.TRANSFER,
    resource: AUDIT_RESOURCES.STUDENT,
    resourceId: student._id,
    meta: { from: oldClassId.toString(), to: newClassId.toString() },
  });

  return sendSuccess(res, { student, message: 'Student transferred successfully.' });
});

/**
 * POST /api/v1/students/:id/withdraw
 * Marks a student as withdrawn (soft delete).
 */
export const withdrawStudent = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!student) return sendError(res, 'Student not found.', 404);

  if (student.status !== STUDENT_STATUSES.ACTIVE) {
    return sendError(res, `Student is already ${student.status}.`, 400);
  }

  student.status = STUDENT_STATUSES.WITHDRAWN;
  student.wasNew = false;
  await student.save();

  // Decrement class count
  await Class.updateOne({ _id: student.classId }, { $inc: { studentCount: -1 } });

  logAction(req, {
    action: AUDIT_ACTIONS.WITHDRAW,
    resource: AUDIT_RESOURCES.STUDENT,
    resourceId: student._id,
    meta: { admissionNumber: student.admissionNumber },
  });

  return sendSuccess(res, { student, message: 'Student withdrawn.' });
});

// ── CSV Bulk Import ───────────────────────────────────────────────────────────

/**
 * POST /api/v1/students/import
 * Accepts a multipart CSV file upload (field: "file") + classId body param.
 * Parses the CSV, validates each row, then enqueues a BullMQ import job.
 * Returns { jobId } immediately — client polls /import/:jobId/status for results.
 *
 * CSV format (header row required):
 *   admissionNumber,firstName,lastName,gender[,dateOfBirth,parentFirstName,parentLastName,parentPhone,parentEmail]
 */
export const importStudents = asyncHandler(async (req, res) => {
  const { classId } = req.body;
  if (!classId) return sendError(res, 'classId is required in the form body.', 400);

  // Verify the class belongs to this school
  const cls = await Class.findOne({ _id: classId, schoolId: req.user.schoolId });
  if (!cls) return sendError(res, 'Class not found.', 404);

  // Parse CSV from memory buffer
  const csvText = req.file.buffer.toString('utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = csvText.split('\n').filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    return sendError(res, 'CSV must have a header row and at least one data row.', 400);
  }

  // Parse header (lowercase, trim)
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z]/g, ''));

  const requiredHeaders = ['admissionnumber', 'firstname', 'lastname', 'gender'];
  const missing = requiredHeaders.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    return sendError(res, `CSV missing required columns: ${missing.join(', ')}.`, 400);
  }

  const rows = [];
  const parseErrors = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ''; });

    // Validate required fields
    if (!row.admissionnumber || !row.firstname || !row.lastname || !row.gender) {
      parseErrors.push({ row: i + 1, error: 'Missing required field' });
      continue;
    }

    const gender = row.gender.toLowerCase();
    if (gender !== 'male' && gender !== 'female') {
      parseErrors.push({ row: i + 1, error: `Invalid gender "${row.gender}" — must be male or female` });
      continue;
    }

    rows.push({
      admissionNumber: row.admissionnumber,
      firstName:       row.firstname,
      lastName:        row.lastname,
      gender,
      dateOfBirth:     row.dateofbirth || undefined,
      parentFirstName: row.parentfirstname || undefined,
      parentLastName:  row.parentlastname || undefined,
      parentPhone:     row.parentphone || undefined,
      parentEmail:     row.parentemail || undefined,
    });
  }

  if (rows.length === 0) {
    return sendError(res, `No valid rows found. Parse errors: ${parseErrors.length}`, 400);
  }

  // Enqueue the import job
  const job = await importQueue.add(JOB_NAMES.IMPORT_STUDENTS_CSV, {
    jobId: null,  // will be replaced below after we know job.id
    schoolId: req.user.schoolId.toString(),
    classId,
    rows,
  });

  // Store the BullMQ job.id as jobId in the payload (for status polling key)
  await job.updateData({ ...job.data, jobId: job.id });

  return sendSuccess(res, {
    message: `Import job queued. ${rows.length} rows to process, ${parseErrors.length} pre-validation errors.`,
    jobId: job.id,
    total: rows.length,
    preValidationErrors: parseErrors,
  }, 202);
});

/**
 * GET /api/v1/students/import/:jobId/status
 * Reads import result from Redis. Returns 202 while still processing, 200 when done.
 */
export const getImportStatus = asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const redis = getRedis();

  if (!redis) {
    return sendError(res, 'Import status unavailable (Redis not configured).', 503);
  }

  const raw = await redis.get(`import:result:${jobId}`);

  if (!raw) {
    // Not yet in Redis — either still processing or job ID is wrong
    return res.status(202).json({ status: 'processing', message: 'Import job is still running. Check back shortly.' });
  }

  const result = JSON.parse(raw);
  return sendSuccess(res, { result });
});
