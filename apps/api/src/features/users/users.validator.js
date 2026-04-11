import { z } from 'zod';
import { sendError } from '../../utils/response.js';
import { ROLES } from '../../constants/index.js';

const phoneRegex = /^(\+254|0|254)?[17]\d{8}$/;

// Roles an admin can assign — school_admin and superadmin are not creatable via this endpoint
const ASSIGNABLE_ROLES = [
  ROLES.DIRECTOR,
  ROLES.HEADTEACHER,
  ROLES.DEPUTY_HEADTEACHER,
  ROLES.SECRETARY,
  ROLES.ACCOUNTANT,
  ROLES.TEACHER,
  ROLES.PARENT,
];

const createUserSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  email: z.string().trim().email('Invalid email address'),
  phone: z.string().trim().regex(phoneRegex, 'Invalid phone number (Kenyan format required)').optional(),
  role: z.enum(ASSIGNABLE_ROLES, { message: `Role must be one of: ${ASSIGNABLE_ROLES.join(', ')}` }),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const updateUserSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  phone: z.string().trim().regex(phoneRegex, 'Invalid phone number').optional(),
  role: z.enum(ASSIGNABLE_ROLES, { message: `Role must be one of: ${ASSIGNABLE_ROLES.join(', ')}` }).optional(),
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

export const validateCreateUser = validate(createUserSchema);
export const validateUpdateUser = validate(updateUserSchema);
