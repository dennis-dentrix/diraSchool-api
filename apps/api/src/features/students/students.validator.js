import { z } from 'zod';
import { sendError } from '../../utils/response.js';

const phoneRegex    = /^(\+254|0|254)?[17]\d{8}$/;
const objectIdRegex = /^[a-f\d]{24}$/i;

// ── Guardian sub-schema ───────────────────────────────────────────────────────
const guardianSchema = z.object({
  firstName:    z.string().trim().min(1, 'Guardian first name is required'),
  lastName:     z.string().trim().min(1, 'Guardian last name is required'),
  relationship: z.enum(['mother', 'father', 'guardian', 'other'], {
    message: "Relationship must be mother, father, guardian, or other",
  }),
  phone:        z.string().trim().regex(phoneRegex, 'Invalid guardian phone (Kenyan format)').optional(),
  // email is optional — invite sent only when provided
  email:        z.string().trim().email('Invalid guardian email').optional(),
  occupation:   z.string().trim().optional(),
  // Link an existing parent User instead of creating a new one
  existingUserId: z.string().regex(objectIdRegex, 'Invalid user ID').optional(),
});

// ── Enrollment ────────────────────────────────────────────────────────────────
export const enrollStudentSchema = z.object({
  classId:                z.string().regex(objectIdRegex, 'Invalid class ID'),
  admissionNumber:        z.string().trim().min(1, 'Admission number is required'),
  firstName:              z.string().trim().min(1, 'First name is required'),
  lastName:               z.string().trim().min(1, 'Last name is required'),
  gender:                 z.enum(['male', 'female'], { message: "Gender must be 'male' or 'female'" }),
  dateOfBirth:            z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  birthCertificateNumber: z.string().trim().optional(),
  assessmentNumber:       z.string().trim().optional(),
  enrollmentDate:         z.string().date().optional(),
  // One or more guardians — all optional at enrollment (can be added later)
  guardians:              z.array(guardianSchema).optional(),
  // Legacy single-parent shortcut (kept for backwards compatibility)
  parent: z
    .object({
      firstName:      z.string().trim().min(1),
      lastName:       z.string().trim().min(1),
      phone:          z.string().trim().regex(phoneRegex, 'Invalid phone number'),
      email:          z.string().trim().email().optional(),
      existingUserId: z.string().regex(objectIdRegex).optional(),
    })
    .optional(),
});

// ── Guardian update sub-schema (no existingUserId — edit only, no new portal accounts) ──────────
const guardianUpdateSchema = z.object({
  firstName:    z.string().trim().min(1, 'Guardian first name is required'),
  lastName:     z.string().trim().min(1, 'Guardian last name is required'),
  relationship: z.enum(['mother', 'father', 'guardian', 'other']),
  phone:        z.string().trim().regex(phoneRegex, 'Invalid phone (Kenyan format)').optional().or(z.literal('')),
  email:        z.string().trim().email('Invalid email').optional().or(z.literal('')),
  occupation:   z.string().trim().optional(),
});

// ── Update ────────────────────────────────────────────────────────────────────
const updateStudentSchema = z.object({
  firstName:              z.string().trim().min(1).optional(),
  lastName:               z.string().trim().min(1).optional(),
  gender:                 z.enum(['male', 'female']).optional(),
  dateOfBirth:            z.string().datetime({ offset: true }).or(z.string().date()).nullable().optional(),
  birthCertificateNumber: z.string().trim().nullable().optional(),
  assessmentNumber:       z.string().trim().nullable().optional(),
  enrollmentDate:         z.string().date().optional(),
  admissionNumber:        z.string().trim().min(1).optional(),
  guardians:              z.array(guardianUpdateSchema).optional(),
}).strict();

const transferStudentSchema = z.object({
  newClassId: z.string().regex(objectIdRegex, 'Invalid class ID'),
  note:       z.string().trim().optional(),
});

// ── Middleware factories ───────────────────────────────────────────────────────
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return sendError(res, result.error.errors[0].message, 400);
  }
  req.body = result.data;
  next();
};

export const validateEnrollStudent    = validate(enrollStudentSchema);
export const validateUpdateStudent    = validate(updateStudentSchema);
export const validateTransferStudent  = validate(transferStudentSchema);
