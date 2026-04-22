import { z } from 'zod';
import { sendError } from '../../utils/response.js';
import { LEVEL_CATEGORIES, TERMS } from '../../constants/index.js';

const createClassSchema = z.object({
  name: z.string().trim().min(1, 'Class name is required'),
  stream: z.string().trim().min(1).optional(),
  levelCategory: z.enum(Object.values(LEVEL_CATEGORIES), {
    message: `Level category must be one of: ${Object.values(LEVEL_CATEGORIES).join(', ')}`,
  }),
  academicYear: z
    .string()
    .regex(/^\d{4}$/, 'Academic year must be a 4-digit year (e.g. 2025)'),
  term: z.enum(TERMS, { message: `Term must be one of: ${TERMS.join(', ')}` }),
  classTeacherId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid teacher ID').optional(),
});

const updateClassSchema = z.object({
  name: z.string().trim().min(1).optional(),
  stream: z.string().trim().min(1).optional(),
  levelCategory: z.enum(Object.values(LEVEL_CATEGORIES)).optional(),
  academicYear: z.string().regex(/^\d{4}$/).optional(),
  term: z.enum(TERMS).optional(),
  classTeacherId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid teacher ID').nullable().optional(),
  isActive: z.boolean().optional(),
}).strict();

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return sendError(res, result.error.errors[0].message, 400);
  }
  req.body = result.data;
  next();
};

const promoteClassSchema = z.object({
  action: z.enum(['promote', 'graduate']).optional(),
  targetClassId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid target class ID').optional(),
  eligibilityMode: z.enum(['all', 'cbc_recommended']).optional(),
}).superRefine((data, ctx) => {
  const action = data.action ?? 'promote';
  if (action === 'promote' && !data.targetClassId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Target class is required when action is promote.',
      path: ['targetClassId'],
    });
  }
});

export const validateCreateClass = validate(createClassSchema);
export const validateUpdateClass = validate(updateClassSchema);
export const validatePromoteClass = validate(promoteClassSchema);
