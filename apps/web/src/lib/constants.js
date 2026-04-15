export const ROLES = {
  SUPERADMIN: 'superadmin',
  SCHOOL_ADMIN: 'school_admin',
  DIRECTOR: 'director',
  HEADTEACHER: 'headteacher',
  DEPUTY_HEADTEACHER: 'deputy_headteacher',
  SECRETARY: 'secretary',
  ACCOUNTANT: 'accountant',
  TEACHER: 'teacher',
  PARENT: 'parent',
};

export const ADMIN_ROLES = [
  'school_admin',
  'director',
  'headteacher',
  'deputy_headteacher',
];

export const TERMS = ['Term 1', 'Term 2', 'Term 3'];

export const LEVEL_CATEGORIES = [
  'Pre-Primary',
  'Lower Primary',
  'Upper Primary',
  'Junior Secondary',
  'Senior School',
];

export const PAYMENT_METHODS = ['cash', 'mpesa', 'bank'];
export const EXAM_TYPES = ['opener', 'midterm', 'endterm', 'sba'];
export const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused'];
export const SUBSCRIPTION_STATUSES = ['trial', 'active', 'suspended', 'expired'];
export const PLAN_TIERS = ['trial', 'basic', 'standard', 'premium'];
export const STUDENT_STATUSES = ['active', 'transferred', 'graduated', 'withdrawn'];
export const WORKING_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export const CURRENT_YEAR = new Date().getFullYear();
export const ACADEMIC_YEARS = [
  String(CURRENT_YEAR - 1),
  String(CURRENT_YEAR),
  String(CURRENT_YEAR + 1),
];

export const PLAN_LABELS = {
  trial: 'Trial',
  basic: 'Basic',
  standard: 'Standard',
  premium: 'Premium',
};

export const ROLE_LABELS = {
  superadmin: 'Super Admin',
  school_admin: 'School Admin',
  director: 'Director',
  headteacher: 'Head Teacher',
  deputy_headteacher: 'Deputy Head Teacher',
  secretary: 'Secretary',
  accountant: 'Accountant',
  teacher: 'Teacher',
  parent: 'Parent',
};

export const DEFAULT_PAGE_SIZE = 20;
