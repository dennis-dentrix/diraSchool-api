import { z } from 'zod';
import { SUBSCRIPTION_STATUSES, PAYMENT_SMS_PROVIDERS } from '../../constants/index.js';
import { sendError } from '../../utils/response.js';

// ── Shared field definitions ──────────────────────────────────────────────────

const nameField = z.string().trim().min(2, 'School name must be at least 2 characters');
const emailField = z.string().trim().toLowerCase().email('Invalid email address');
const phoneField = z
  .string()
  .trim()
  .regex(/^\+?[\d\s\-()]{7,15}$/, 'Invalid phone number');
const paymentNotificationNumberField = z
  .string()
  .trim()
  .regex(/^\+?[\d\s\-()]{5,15}$/, 'Invalid payment notification number');

const paymentSmsSettingsSchema = z
  .object({
    enabled: z.coerce.boolean().optional(),
    provider: z.enum(Object.values(PAYMENT_SMS_PROVIDERS)).optional(),
    phoneNumber: paymentNotificationNumberField.optional().or(z.literal('')),
    bankName: z.string().trim().max(80).optional().or(z.literal('')),
  })
  .strict();

// ── Create school (superadmin only) ──────────────────────────────────────────

const createSchoolSchema = z.object({
  name: nameField,
  email: emailField,
  phone: phoneField,
  county: z.string().trim().min(1).optional(),
  constituency: z.string().trim().min(1).optional(),
  registrationNumber: z.string().trim().min(1).optional(),
  address: z.string().trim().min(1).optional(),
  adminFirstName: z.string().trim().min(1, 'Admin first name is required'),
  adminLastName: z.string().trim().min(1, 'Admin last name is required'),
  adminEmail: emailField,
  adminPhone: phoneField.optional().or(z.literal('')),
});

const deactivationRequestSchema = z
  .object({
    reason: z.string().trim().min(30, 'Please provide a detailed reason of at least 30 characters.').max(1000),
    confirmation: z.literal('DEACTIVATE', {
      errorMap: () => ({ message: 'Type DEACTIVATE to confirm this request.' }),
    }),
    dataRetentionAcknowledged: z.literal(true, {
      errorMap: () => ({ message: 'Confirm that you understand access will be disabled after approval.' }),
    }),
    billingAcknowledged: z.literal(true, {
      errorMap: () => ({ message: 'Confirm that any billing or data export issues have been reviewed.' }),
    }),
  })
  .strict();

// ── School admin updates their own school ────────────────────────────────────
// Cannot touch subscription fields — those are superadmin-only.

const updateMySchoolSchema = z
  .object({
    name: nameField.optional(),
    phone: phoneField.optional(),
    county: z.string().trim().min(1).optional(),
    constituency: z.string().trim().min(1).optional(),
    registrationNumber: z.string().trim().min(1).optional(),
    address: z.string().trim().min(1).optional(),
    mpesaTillNumber: paymentNotificationNumberField.optional().or(z.literal('')),
    paymentSmsSettings: paymentSmsSettingsSchema.optional(),
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
    constituency: z.string().trim().min(1).optional(),
    registrationNumber: z.string().trim().min(1).optional(),
    address: z.string().trim().min(1).optional(),
    mpesaTillNumber: paymentNotificationNumberField.optional().or(z.literal('')),
    paymentSmsSettings: paymentSmsSettingsSchema.optional(),
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
export const validateDeactivationRequest = validate(deactivationRequestSchema);
