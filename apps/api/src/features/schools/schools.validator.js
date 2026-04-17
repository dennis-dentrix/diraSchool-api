import { z } from 'zod';
import { SUBSCRIPTION_STATUSES } from '../../constants/index.js';
import { sendError } from '../../utils/response.js';

// ── Shared field definitions ──────────────────────────────────────────────────

const nameField = z.string().trim().min(2, 'School name must be at least 2 characters');
const emailField = z.string().trim().toLowerCase().email('Invalid email address');
const phoneField = z
  .string()
  .trim()
  .regex(/^\+?[\d\s\-()]{7,15}$/, 'Invalid phone number');

// ── Create school (superadmin only) ──────────────────────────────────────────

const createSchoolSchema = z.object({
  name: nameField,
  email: emailField,
  phone: phoneField,
  county: z.string().trim().min(1).optional(),
  registrationNumber: z.string().trim().min(1).optional(),
  address: z.string().trim().min(1).optional(),
});

// ── School admin updates their own school ────────────────────────────────────
// Cannot touch subscription fields — those are superadmin-only.

const updateMySchoolSchema = z
  .object({
    name: nameField.optional(),
    phone: phoneField.optional(),
    county: z.string().trim().min(1).optional(),
    registrationNumber: z.string().trim().min(1).optional(),
    address: z.string().trim().min(1).optional(),
  })
  .strict();

// ── Superadmin updates any school ────────────────────────────────────────────
// Full access: includes email and isActive toggle.

const superadminUpdateSchoolSchema = z
  .object({
    name: nameField.optional(),
    email: emailField.optional(),
    phone: phoneField.optional(),
    county: z.string().trim().min(1).optional(),
    registrationNumber: z.string().trim().min(1).optional(),
    address: z.string().trim().min(1).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

// ── Superadmin manages subscription ──────────────────────────────────────────

const updateSubscriptionSchema = z
  .object({
    subscriptionStatus: z.enum(Object.values(SUBSCRIPTION_STATUSES), {
      message: `Status must be one of: ${Object.values(SUBSCRIPTION_STATUSES).join(', ')}`,
    }),
    planTier: z.enum(['trial', 'basic', 'standard', 'premium']).optional(),
    // Optional: extend or set trial/subscription expiry
    trialExpiry: z.coerce.date().optional(),
  })
  .strict();

// ── Middleware factory ────────────────────────────────────────────────────────

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return sendError(res, result.error.errors[0].message, 400);
  }
  req.body = result.data;
  next();
};

export const validateCreateSchool = validate(createSchoolSchema);
export const validateUpdateMySchool = validate(updateMySchoolSchema);
export const validateSuperadminUpdateSchool = validate(superadminUpdateSchoolSchema);
export const validateUpdateSubscription = validate(updateSubscriptionSchema);
