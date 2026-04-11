import { z } from 'zod';
import { sendError } from '../../utils/response.js';

const phoneRegex = /^(\+254|0|254)?[17]\d{8}$/;
const objectIdRegex = /^[a-f\d]{24}$/i;

const parentSchema = z.object({
  firstName: z.string().trim().min(1, 'Parent first name is required'),
  lastName: z.string().trim().min(1, 'Parent last name is required'),
  phone: z.string().trim().regex(phoneRegex, 'Invalid parent phone number (Kenyan format required)'),
  email: z.string().trim().email('Invalid parent email').optional(),
  // If provided, link an existing user instead of creating a new parent
  existingUserId: z.string().regex(objectIdRegex, 'Invalid user ID').optional(),
});

const enrollStudentSchema = z.object({
  classId: z.string().regex(objectIdRegex, 'Invalid class ID'),
  admissionNumber: z.string().trim().min(1, 'Admission number is required'),
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  gender: z.enum(['male', 'female'], { message: "Gender must be 'male' or 'female'" }),
  dateOfBirth: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  // At least one parent/guardian is optional (can be added later)
  parent: parentSchema.optional(),
});

const updateStudentSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  gender: z.enum(['male', 'female']).optional(),
  dateOfBirth: z.string().datetime({ offset: true }).or(z.string().date()).nullable().optional(),
  admissionNumber: z.string().trim().min(1).optional(),
}).strict();

const transferStudentSchema = z.object({
  newClassId: z.string().regex(objectIdRegex, 'Invalid class ID'),
  note: z.string().trim().optional(),
});

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return sendError(res, result.error.errors[0].message, 400);
  }
  req.body = result.data;
  next();
};

export const validateEnrollStudent = validate(enrollStudentSchema);
export const validateUpdateStudent = validate(updateStudentSchema);
export const validateTransferStudent = validate(transferStudentSchema);
