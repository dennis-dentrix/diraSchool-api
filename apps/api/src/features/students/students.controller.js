import crypto from 'node:crypto';
import mongoose from 'mongoose';
import Student from './Student.model.js';
import Class from '../classes/Class.model.js';
import User from '../users/User.model.js';
import School from '../schools/School.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { paginate } from '../../utils/pagination.js';
import { normalisePhone } from '../../utils/phone.js';
import { sendInviteEmail } from '../../services/email.service.js';
import { ROLES, STUDENT_STATUSES, JOB_NAMES, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../../constants/index.js';
import { importQueue, emailQueue } from '../../jobs/queues.js';
import { getRedis } from '../../config/redis.js';
import { logAction } from '../../utils/auditLogger.js';
import { env } from '../../config/env.js';
import logger from '../../config/logger.js';
import { uploadBuffer } from '../../jobs/helpers/cloudinaryUpload.js';

const enqueueEmail = async (type, payload) =>
  emailQueue.add(type, { type, payload });

/**
 * POST /api/v1/students
 * Enrolls a new student.
 *
 * Guardian handling:
 *   - guardians[] — rich contact details; stored on the student record
 *   - If a guardian has an email, a parent portal account is created and an
 *     invite email is sent (fire-and-forget). No invite = placeholder account
 *     only when a portal account is explicitly requested via existingUserId or email.
 *   - parent (legacy) — single-guardian shortcut, still supported
 */
export const enrollStudent = asyncHandler(async (req, res) => {
  const {
    classId,
    admissionNumber,
    firstName,
    lastName,
    gender,
    dateOfBirth,
    birthCertificateNumber,
    enrollmentDate,
    guardians = [],
    parent, // legacy single-guardian field
  } = req.body;

  // Verify the target class belongs to this school
  const cls = await Class.findOne({ _id: classId, schoolId: req.user.schoolId });
  if (!cls) return sendError(res, 'Class not found.', 404);

  // Fetch school name for invite emails
  const school = await School.findById(req.user.schoolId).select('name').lean();
  const schoolName = school?.name ?? 'your school';

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const parentIds = [];
    const guardianEntries = [];
    // Track pending invite emails so we can fire them AFTER commit
    const pendingInvites = [];

    // ── Process guardians array ───────────────────────────────────────────────
    for (const guardian of guardians) {
      // Normalize guardian data
      const guardianEntry = {
        firstName:    guardian.firstName.trim(),
        lastName:     guardian.lastName.trim(),
        relationship: guardian.relationship,
        phone:        guardian.phone ? normalisePhone(guardian.phone) : undefined,
        email:        guardian.email?.toLowerCase().trim(),
        occupation:   guardian.occupation?.trim(),
      };

      if (guardian.existingUserId) {
        // Link an already-existing parent user
        const existingUser = await User.findOne({
          _id: guardian.existingUserId,
          schoolId: req.user.schoolId,
          role: ROLES.PARENT,
        }).session(session);

        if (!existingUser) {
          await session.abortTransaction();
          return sendError(res, `Parent user ${guardian.existingUserId} not found in this school.`, 404);
        }
        guardianEntry.userId = existingUser._id;
        parentIds.push(existingUser._id);
      } else if (guardian.email) {
        // Email provided → create parent portal account + send invite
        const rawToken  = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiry    = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        const [newParent] = await User.create(
          [
            {
              firstName:         guardian.firstName.trim(),
              lastName:          guardian.lastName.trim(),
              email:             guardian.email.toLowerCase().trim(),
              phone:             guardian.phone ? normalisePhone(guardian.phone) : undefined,
              password:          crypto.randomBytes(16).toString('hex'), // placeholder
              role:              ROLES.PARENT,
              schoolId:          req.user.schoolId,
              mustChangePassword: false,
              invitePending:      true,
              inviteToken:        tokenHash,
              inviteTokenExpiry:  expiry,
              emailVerified:      true,
            },
          ],
          { session }
        );

        guardianEntry.userId = newParent._id;
        parentIds.push(newParent._id);

        const inviteUrl = `${env.CLIENT_URL}/accept-invite/${rawToken}`;
        pendingInvites.push({
          to:           newParent.email,
          firstName:    newParent.firstName,
          schoolName,
          inviteUrl,
          meta: { schoolId: req.user.schoolId, userId: newParent._id, flow: 'parent-invite' },
        });
      }
      guardianEntries.push(guardianEntry);
      // No email and no existingUserId → store contact only, no portal account
    }

    // ── Legacy single-parent shortcut ─────────────────────────────────────────
    if (parent && !guardians.length) {
      if (parent.existingUserId) {
        const existingUser = await User.findOne({
          _id: parent.existingUserId,
          schoolId: req.user.schoolId,
          role: ROLES.PARENT,
        }).session(session);

        if (!existingUser) {
          await session.abortTransaction();
          return sendError(res, 'Existing parent user not found in this school.', 404);
        }
        parentIds.push(existingUser._id);
      } else {
        const phone = normalisePhone(parent.phone);
        const email = parent.email?.toLowerCase().trim();

        const rawToken  = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiry    = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        const [newParent] = await User.create(
          [
            {
              firstName:          parent.firstName.trim(),
              lastName:           parent.lastName.trim(),
              email:              email || `parent${phone.replace('+', '')}@placeholder.diraschool`,
              phone,
              password:           crypto.randomBytes(16).toString('hex'),
              role:               ROLES.PARENT,
              schoolId:           req.user.schoolId,
              mustChangePassword: false,
              invitePending:      !!email, // only pending if we can invite them
              inviteToken:        email ? tokenHash : undefined,
              inviteTokenExpiry:  email ? expiry : undefined,
              emailVerified:      true,
            },
          ],
          { session }
        );

        parentIds.push(newParent._id);

        if (email) {
          const inviteUrl = `${env.CLIENT_URL}/accept-invite/${rawToken}`;
          pendingInvites.push({
            to:       newParent.email,
            firstName: newParent.firstName,
            schoolName,
            inviteUrl,
            meta: { schoolId: req.user.schoolId, userId: newParent._id, flow: 'parent-invite' },
          });
        }
      }
    }

    // ── Create student ────────────────────────────────────────────────────────
    const [student] = await Student.create(
      [
        {
          schoolId:               req.user.schoolId,
          classId,
          admissionNumber:        admissionNumber.trim().toUpperCase(),
          firstName:              firstName.trim(),
          lastName:               lastName.trim(),
          gender,
          dateOfBirth:            dateOfBirth ? new Date(dateOfBirth) : undefined,
          birthCertificateNumber: birthCertificateNumber?.trim(),
          enrollmentDate:         enrollmentDate ? new Date(enrollmentDate) : new Date(),
          guardians: guardianEntries,
          parentIds,
        },
      ],
      { session }
    );

    // Link student to all parent portal accounts
    if (parentIds.length) {
      await User.updateMany(
        { _id: { $in: parentIds } },
        { $addToSet: { children: student._id } },
        { session }
      );
    }

    await session.commitTransaction();

    // ── Fire invite emails after commit (fire-and-forget) ─────────────────────
    for (const invite of pendingInvites) {
      sendInviteEmail(invite).catch((err) => {
        logger.error('[Students] Parent invite email direct send failed, falling back to queue', {
          err: err.message,
          to: invite.to,
        });
        enqueueEmail(JOB_NAMES.SEND_INVITE_EMAIL, invite).catch((qErr) =>
          logger.error('[Students] Parent invite email queue fallback also failed:', qErr.message)
        );
      });
    }

    const populated = await Student.findById(student._id)
      .populate('classId', 'name stream levelCategory academicYear term')
      .populate('parentIds', 'firstName lastName phone email');

    logAction(req, {
      action:     AUDIT_ACTIONS.CREATE,
      resource:   AUDIT_RESOURCES.STUDENT,
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
  const schoolId = req.user.schoolId;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const student = await Student.findOne({ _id: req.params.id, schoolId }).session(session);
    if (!student) {
      await session.abortTransaction();
      return sendError(res, 'Student not found.', 404);
    }

    const {
      firstName, lastName, gender, dateOfBirth, admissionNumber, birthCertificateNumber, enrollmentDate, guardians,
    } = req.body;

    if (firstName !== undefined) student.firstName = firstName;
    if (lastName !== undefined) student.lastName = lastName;
    if (gender !== undefined) student.gender = gender;
    if (dateOfBirth !== undefined) student.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : undefined;
    if (admissionNumber !== undefined) student.admissionNumber = admissionNumber.trim().toUpperCase();
    if (birthCertificateNumber !== undefined) student.birthCertificateNumber = birthCertificateNumber || undefined;
    if (enrollmentDate !== undefined) student.enrollmentDate = enrollmentDate ? new Date(enrollmentDate) : undefined;

    const pendingInvites = [];
    if (guardians !== undefined) {
      const school = await School.findById(schoolId).select('name').session(session);
      const schoolName = school?.name ?? 'your school';

      const existingParentIds = new Set((student.parentIds ?? []).map((id) => id.toString()));
      const nextParentIds = new Set();
      const nextGuardians = [];

      for (let idx = 0; idx < guardians.length; idx += 1) {
        const g = guardians[idx];
        const existing = student.guardians?.[idx];
        const email = g.email?.trim().toLowerCase() || undefined;
        const phone = g.phone ? normalisePhone(g.phone) : undefined;

        let linkedUserId = existing?.userId ? existing.userId.toString() : undefined;
        let linkedUser = null;

        if (linkedUserId) {
          linkedUser = await User.findOne({ _id: linkedUserId, schoolId, role: ROLES.PARENT }).session(session);
          if (!linkedUser) linkedUserId = undefined;
        }

        if (email) {
          const emailChanged = !linkedUser || linkedUser.email?.toLowerCase() !== email;
          if (emailChanged) {
            let parentUser = await User.findOne({ schoolId, role: ROLES.PARENT, email }).session(session);

            if (!parentUser) {
              const rawToken = crypto.randomBytes(32).toString('hex');
              const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
              const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

              const [newParent] = await User.create(
                [
                  {
                    firstName: g.firstName.trim(),
                    lastName: g.lastName.trim(),
                    email,
                    phone,
                    password: crypto.randomBytes(16).toString('hex'),
                    role: ROLES.PARENT,
                    schoolId,
                    mustChangePassword: false,
                    invitePending: true,
                    inviteToken: tokenHash,
                    inviteTokenExpiry: expiry,
                    emailVerified: true,
                  },
                ],
                { session }
              );

              parentUser = newParent;
              const inviteUrl = `${env.CLIENT_URL}/accept-invite/${rawToken}`;
              pendingInvites.push({
                to: parentUser.email,
                firstName: parentUser.firstName,
                schoolName,
                inviteUrl,
                meta: { schoolId, userId: parentUser._id, flow: 'parent-invite-update' },
              });
            }

            linkedUserId = parentUser._id.toString();
          }
        }

        if (linkedUserId) nextParentIds.add(linkedUserId);

        nextGuardians.push({
          ...(linkedUserId ? { userId: linkedUserId } : {}),
          firstName: g.firstName,
          lastName: g.lastName,
          relationship: g.relationship,
          phone,
          email,
          occupation: g.occupation || undefined,
        });
      }

      student.guardians = nextGuardians;
      student.parentIds = Array.from(nextParentIds);

      if (student.parentIds.length) {
        await User.updateMany(
          { _id: { $in: student.parentIds } },
          { $addToSet: { children: student._id } },
          { session }
        );
      }

      const removedParentIds = Array.from(existingParentIds).filter((id) => !nextParentIds.has(id));
      if (removedParentIds.length) {
        await User.updateMany(
          { _id: { $in: removedParentIds } },
          { $pull: { children: student._id } },
          { session }
        );
      }
    }

    // Prevent the post('save') hook from double-incrementing studentCount
    student.wasNew = false;
    await student.save({ session });
    await session.commitTransaction();

    for (const invite of pendingInvites) {
      sendInviteEmail(invite).catch((err) => {
        logger.error('[Students] Updated guardian invite email direct send failed, falling back to queue', {
          err: err.message,
          to: invite.to,
        });
        enqueueEmail(JOB_NAMES.SEND_INVITE_EMAIL, invite).catch((qErr) =>
          logger.error('[Students] Updated guardian invite email queue fallback also failed:', qErr.message)
        );
      });
    }

    const populated = await Student.findById(student._id)
      .populate('classId', 'name stream levelCategory academicYear term')
      .populate('parentIds', 'firstName lastName phone email');

    return sendSuccess(res, { student: populated });
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
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

/**
 * POST /api/v1/students/:id/photo
 * Uploads/updates a student's profile photo.
 * Field name: "photo" (multipart/form-data)
 */
export const uploadStudentPhoto = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!student) return sendError(res, 'Student not found.', 404);

  const upload = await uploadBuffer(req.file.buffer, {
    folder: `students/${req.user.schoolId}`,
    public_id: `${student.admissionNumber}_${student._id}`,
    resource_type: 'image',
    overwrite: true,
  });

  if (!upload?.url) {
    return sendError(
      res,
      'Photo upload unavailable. Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
      503
    );
  }

  student.photo = upload.url;
  student.wasNew = false;
  await student.save();

  return sendSuccess(res, { photo: student.photo, studentId: student._id });
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
    requestedByUserId: req.user._id.toString(),
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
