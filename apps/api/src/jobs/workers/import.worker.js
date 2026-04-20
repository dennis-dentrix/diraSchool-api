/**
 * Import Worker — processes student CSV import jobs from the "import" queue.
 *
 * Job payload:
 *   {
 *     jobId:   string   — same as BullMQ job.id, used as Redis result key
 *     schoolId: string
 *     classId:  string
 *     rows:    Array<{admissionNumber, firstName, lastName, gender, dateOfBirth?,
 *                      parentFirstName?, parentLastName?, parentPhone?, parentEmail?}>
 *   }
 *
 * Results are stored in Redis at key  import:result:{jobId}  (TTL: 2 hours).
 * The client polls  GET /api/v1/students/import/:jobId/status  to read them.
 *
 * Duplicate admission numbers within the school are skipped (not failed).
 */
import mongoose from 'mongoose';
import Student from '../../features/students/Student.model.js';
import User from '../../features/users/User.model.js';
import Class from '../../features/classes/Class.model.js';
import { normalisePhone } from '../../utils/phone.js';
import { ROLES, STUDENT_STATUSES } from '../../constants/index.js';
import { getRedis } from '../../config/redis.js';
import logger from '../../config/logger.js';
import { notifyUser } from '../../utils/notify.js';

const RESULT_TTL = 2 * 60 * 60; // 2 hours

const saveResult = async (jobId, result) => {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(`import:result:${jobId}`, JSON.stringify(result), 'EX', RESULT_TTL);
  } catch { /* non-fatal */ }
};

export const processImportJob = async (job) => {
  const { jobId, schoolId, classId, rows, requestedByUserId } = job.data;

  logger.info('[Import] Starting student CSV import', {
    jobId,
    schoolId,
    classId,
    total: rows.length,
  });

  // Verify class still exists (could have been deleted between enqueue and processing)
  const cls = await Class.findOne({ _id: classId, schoolId });
  if (!cls) {
    const result = { status: 'failed', error: 'Target class not found.', total: rows.length, succeeded: 0, failed: rows.length, errors: [] };
    await saveResult(jobId, result);
    await notifyUser({
      schoolId,
      userId: requestedByUserId,
      type: 'error',
      title: 'Student Import Failed',
      message: 'Target class was not found. Import job could not run.',
      link: '/students',
      meta: { jobId },
    });
    throw new Error(result.error);
  }

  const errors = [];
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +2: 1 for header, 1 for 1-indexed

    try {
      // Basic required field check (validator catches this before enqueue, but be safe)
      if (!row.admissionNumber || !row.firstName || !row.lastName || !row.gender) {
        throw new Error('Missing required field (admissionNumber, firstName, lastName, gender)');
      }

      // Check for duplicate admission number in this school
      const exists = await Student.exists({
        schoolId,
        admissionNumber: row.admissionNumber.trim().toUpperCase(),
      });
      if (exists) {
        throw new Error(`Admission number ${row.admissionNumber} already exists`);
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        let parentId;

        if (row.parentPhone) {
          const phone = normalisePhone(row.parentPhone);
          // Re-use an existing parent user (matched by phone + school) or create one
          let parent = await User.findOne({ phone, schoolId, role: ROLES.PARENT }).session(session);

          if (!parent) {
            const email = row.parentEmail?.toLowerCase().trim() ||
              `parent${phone.replace(/\D/g, '')}@placeholder.diraschool`;

            [parent] = await User.create(
              [{
                firstName: (row.parentFirstName ?? 'Parent').trim(),
                lastName:  (row.parentLastName  ?? row.lastName).trim(),
                email,
                phone,
                password: phone,
                role: ROLES.PARENT,
                schoolId,
                mustChangePassword: true,
              }],
              { session }
            );
          }
          parentId = parent._id;
        }

        const [student] = await Student.create(
          [{
            schoolId,
            classId,
            admissionNumber: row.admissionNumber.trim().toUpperCase(),
            firstName:       row.firstName.trim(),
            lastName:        row.lastName.trim(),
            gender:          row.gender.toLowerCase(),
            dateOfBirth:     row.dateOfBirth ? new Date(row.dateOfBirth) : undefined,
            parentIds:       parentId ? [parentId] : [],
            status:          STUDENT_STATUSES.ACTIVE,
          }],
          { session }
        );

        if (parentId) {
          await User.updateOne(
            { _id: parentId },
            { $addToSet: { children: student._id } },
            { session }
          );
        }

        await session.commitTransaction();
        succeeded++;
      } catch (innerErr) {
        if (session.inTransaction()) await session.abortTransaction();
        throw innerErr;
      } finally {
        session.endSession();
      }
    } catch (err) {
      failed++;
      errors.push({ row: rowNum, admissionNumber: row.admissionNumber, error: err.message });
      logger.warn('[Import] Row skipped', { jobId, row: rowNum, error: err.message });
    }
  }

  const result = {
    status: 'complete',
    total: rows.length,
    succeeded,
    failed,
    errors,
  };

  await saveResult(jobId, result);
  await notifyUser({
    schoolId,
    userId: requestedByUserId,
    type: failed > 0 ? 'warning' : 'success',
    title: 'Student Import Completed',
    message: `${succeeded} succeeded, ${failed} failed.`,
    link: '/students',
    meta: { jobId, succeeded, failed },
  });

  logger.info('[Import] CSV import complete', { jobId, succeeded, failed });

  return result;
};
