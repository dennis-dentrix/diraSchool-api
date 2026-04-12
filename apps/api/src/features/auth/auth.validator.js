import { z } from 'zod';
import { sendError } from '../../utils/response.js';

// ── Schemas ───────────────────────────────────────────────────────────────────

const phoneRegex = /^(\+254|0|254)?[17]\d{8}$/;

const registerSchoolSchema = z.object({
  // School details
  schoolName: z.string().trim().min(2, 'School name must be at least 2 characters'),
  schoolEmail: z.string().trim().email('Invalid school email'),
  schoolPhone: z
    .string()
    .trim()
    .regex(phoneRegex, 'Invalid school phone number (Kenyan format required)'),
  county: z.string().trim().optional(),

  // Admin user details
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  email: z.string().trim().email('Invalid admin email'),
  phone: z
    .string()
    .trim()
    .regex(phoneRegex, 'Invalid phone number (Kenyan format required)')
    .optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters'),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters'),
});

// Same shape as resetPassword — user picks a password when accepting their invite
const acceptInviteSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters'),
});

// ── Middleware factories ───────────────────────────────────────────────────────

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const message = result.error.errors[0].message;
    return sendError(res, message, 400);
  }
  req.body = result.data;
  next();
};

export const validateRegisterSchool  = validate(registerSchoolSchema);
export const validateLogin           = validate(loginSchema);
export const validateChangePassword  = validate(changePasswordSchema);
export const validateForgotPassword  = validate(forgotPasswordSchema);
export const validateResetPassword   = validate(resetPasswordSchema);
export const validateAcceptInvite    = validate(acceptInviteSchema);
