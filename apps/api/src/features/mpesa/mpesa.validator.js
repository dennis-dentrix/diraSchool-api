import { z } from 'zod';
import { sendError } from '../../utils/response.js';
import { PAYMENT_METHODS, PAYMENT_STATUSES, TERMS } from '../../constants/index.js';
import { objectIdRegex, yearRegex } from '@diraschool/shared/schemas';

const paybillRegex = /^\d{5,9}$/;

const settingsSchema = z.object({
  paybill: z.string().trim().regex(paybillRegex, 'Paybill must be 5-9 digits'),
}).strict();

const manualPaymentSchema = z.object({
  studentId: z.string().regex(objectIdRegex, 'Invalid student ID'),
  amount: z.coerce.number().min(1, 'Payment amount must be at least 1'),
  paymentMethod: z.enum([PAYMENT_METHODS.CASH, PAYMENT_METHODS.BANK], {
    message: 'Manual M-Pesa endpoint only accepts cash or bank payments',
  }),
  reference: z.string().trim().min(1, 'Reference number is required'),
  paymentDate: z.string().optional(),
  academicYear: z.string().regex(yearRegex).optional(),
  term: z.enum(TERMS).optional(),
  notes: z.string().trim().optional(),
}).strict();

const allocatePaymentSchema = z.object({
  unallocatedPaymentId: z.string().regex(objectIdRegex, 'Invalid unallocated payment ID'),
  studentId: z.string().regex(objectIdRegex, 'Invalid student ID'),
  notes: z.string().trim().optional(),
}).strict();

const listPaymentsSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  studentId: z.string().regex(objectIdRegex).optional(),
  classId: z.string().regex(objectIdRegex).optional(),
  paymentMethod: z.enum(Object.values(PAYMENT_METHODS)).optional(),
  status: z.enum(Object.values(PAYMENT_STATUSES)).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
}).strict();

const listUnallocatedSchema = z.object({
  status: z.enum(['unmatched', 'ambiguous', 'parse_failed']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
}).strict();

const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) return sendError(res, result.error.errors[0].message, 400);
  req.body = result.data;
  next();
};

const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) return sendError(res, result.error.errors[0].message, 400);
  req.query = result.data;
  next();
};

export const validateMpesaSettings = validateBody(settingsSchema);
export const validateManualPayment = validateBody(manualPaymentSchema);
export const validateAllocatePayment = validateBody(allocatePaymentSchema);
export const validateListMpesaPayments = validateQuery(listPaymentsSchema);
export const validateListUnallocatedPayments = validateQuery(listUnallocatedSchema);
