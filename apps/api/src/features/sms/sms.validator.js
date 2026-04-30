import { z } from 'zod';
import { sendError } from '../../utils/response.js';

const validate = (schema) => (req, res, next) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return sendError(res, parsed.error.errors[0].message, 400);
  req.body = parsed.data;
  next();
};

const sendSchema = z.object({
  to: z.string().min(7, 'Phone number is too short').max(20, 'Phone number is too long').trim(),
  message: z.string().min(1, 'Message cannot be empty').max(480, 'Message exceeds 480 characters').trim(),
}).strict();

const broadcastSchema = z
  .object({
    target: z.enum(['class_parents', 'all_parents', 'all_staff'], {
      errorMap: () => ({ message: 'target must be class_parents, all_parents, or all_staff' }),
    }),
    classId: z.string().optional(),
    message: z.string().min(1, 'Message cannot be empty').max(480, 'Message exceeds 480 characters').trim(),
  })
  .strict()
  .refine(
    (d) => d.target !== 'class_parents' || !!d.classId,
    { message: 'classId is required when target is class_parents', path: ['classId'] }
  );

export const validateSend = validate(sendSchema);
export const validateBroadcast = validate(broadcastSchema);
