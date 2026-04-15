// ============================================================
// SINGLE SOURCE OF TRUTH — never hardcode these strings elsewhere
// ============================================================

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

// All roles that have full admin access to a school
export const ADMIN_ROLES = [
  ROLES.SCHOOL_ADMIN,
  ROLES.DIRECTOR,
  ROLES.HEADTEACHER,
  ROLES.DEPUTY_HEADTEACHER,
];

// All roles scoped to a specific school (not superadmin)
export const SCHOOL_ROLES = Object.values(ROLES).filter((r) => r !== ROLES.SUPERADMIN);

export const TERMS = ['Term 1', 'Term 2', 'Term 3'];

export const YEARS = () => {
  const current = new Date().getFullYear();
  return [current - 1, current, current + 1].map(String);
};

export const SUBSCRIPTION_STATUSES = {
  TRIAL: 'trial',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  EXPIRED: 'expired',
};

export const STUDENT_STATUSES = {
  ACTIVE: 'active',
  TRANSFERRED: 'transferred',
  GRADUATED: 'graduated',
  WITHDRAWN: 'withdrawn',
};

export const PAYMENT_METHODS = {
  CASH: 'cash',
  MPESA: 'mpesa',
  BANK: 'bank',
};

export const PAYMENT_STATUSES = {
  COMPLETED: 'completed',
  REVERSED: 'reversed',
};

export const EXAM_TYPES = {
  OPENER: 'opener',
  MIDTERM: 'midterm',
  ENDTERM: 'endterm',
  SBA: 'sba',
};

export const ATTENDANCE_STATUSES = {
  PRESENT: 'present',
  ABSENT: 'absent',
  LATE: 'late',
  EXCUSED: 'excused',
};

export const ATTENDANCE_REGISTER_STATUSES = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
};

// CBC level categories — drive which grading scale is applied
export const LEVEL_CATEGORIES = {
  PRE_PRIMARY: 'Pre-Primary',         // PP1–PP2: observation only, no grades
  LOWER_PRIMARY: 'Lower Primary',     // Grade 1–3: 4-level rubric EE/ME/AE/BE
  UPPER_PRIMARY: 'Upper Primary',     // Grade 4–6: 4-level rubric EE/ME/AE/BE
  JUNIOR_SECONDARY: 'Junior Secondary', // Grade 7–9: 8-point scale EE1–BE2
  SENIOR_SCHOOL: 'Senior School',     // Grade 10–12: 8-point scale EE1–BE2
};

// 4-level rubric (Grade 1–6)
export const RUBRIC_LEVELS_4 = {
  EE: 'EE', // Exceeds Expectations
  ME: 'ME', // Meets Expectations
  AE: 'AE', // Approaching Expectations
  BE: 'BE', // Below Expectations
};

// 8-point scale (Grade 7–12, KNEC)
export const RUBRIC_LEVELS_8 = {
  EE1: 'EE1', // 90–100%  8pts
  EE2: 'EE2', // 75–89%   7pts
  ME1: 'ME1', // 58–74%   6pts
  ME2: 'ME2', // 41–57%   5pts
  AE1: 'AE1', // 31–40%   4pts
  AE2: 'AE2', // 21–30%   3pts
  BE1: 'BE1', // 11–20%   2pts
  BE2: 'BE2', // 1–10%    1pt
};

export const SMS_TRIGGER_TYPES = {
  FEE_REMINDER: 'fee_reminder',
  ABSENCE_ALERT: 'absence_alert',
  RESULT_NOTIFICATION: 'result_notification',
  CUSTOM_BROADCAST: 'custom_broadcast',
  ACCOUNT_CREATED: 'account_created',
  REPORT_PUBLISHED: 'report_published',
};

export const QUEUE_NAMES = {
  SMS: 'sms',
  REPORT: 'report',
  IMPORT: 'import',
  RECEIPT: 'receipt',
  NOTIFICATION: 'notification',
  EMAIL: 'email',
};

export const JOB_NAMES = {
  SEND_SMS: 'send-sms',
  GENERATE_REPORT_CARD: 'generate-report-card',
  GENERATE_PDF: 'generate-pdf',
  IMPORT_STUDENTS_CSV: 'import-students-csv',
  IN_APP_NOTIFICATION: 'in-app-notification',
  SEND_INVITE_EMAIL:        'send-invite-email',
  SEND_RESET_EMAIL:         'send-reset-email',
  SEND_VERIFICATION_EMAIL:  'send-verification-email',
  SEND_TEMP_PASSWORD_EMAIL: 'send-temp-password-email',
};

export const AUDIT_ACTIONS = {
  CREATE:    'create',
  UPDATE:    'update',
  DELETE:    'delete',
  PUBLISH:   'publish',
  REVERSE:   'reverse',
  SUSPEND:   'suspend',
  ACTIVATE:  'activate',
  TRANSFER:  'transfer',
  WITHDRAW:  'withdraw',
  PROMOTE:   'promote',
  ISSUE:     'issue',
  RETURN:    'return',
};

export const AUDIT_RESOURCES = {
  PAYMENT:    'Payment',
  STUDENT:    'Student',
  REPORT_CARD:'ReportCard',
  SCHOOL:     'School',
  USER:       'User',
  BOOK:       'Book',
  BOOK_LOAN:  'BookLoan',
};

export const LOAN_STATUSES = {
  ACTIVE:   'active',
  RETURNED: 'returned',
  OVERDUE:  'overdue',
};

export const BORROWER_TYPES = {
  STUDENT: 'student',
  STAFF:   'staff',
};

export const DAYS_OF_WEEK = [
  'monday','tuesday','wednesday','thursday','friday','saturday','sunday',
];

// ── Subscription plan tiers ───────────────────────────────────────────────────
export const PLAN_TIERS = {
  TRIAL:    'trial',
  BASIC:    'basic',
  STANDARD: 'standard',
  PREMIUM:  'premium',
};

// ── Feature keys — one constant per gated feature ────────────────────────────
// Core features (students, classes, attendance, exams, fees, users) are NOT listed
// here — they are always available on every plan.
export const PLAN_FEATURES = {
  REPORT_CARDS:  'report_cards',
  PARENT_PORTAL: 'parent_portal',
  TIMETABLE:     'timetable',
  LIBRARY:       'library',
  TRANSPORT:     'transport',
  BULK_IMPORT:   'bulk_import',
  AUDIT_LOG:     'audit_log',
  SMS:           'sms',
};

/**
 * PLAN_FEATURE_MAP — maps each tier to the features it unlocks.
 *
 * ⚠️  TODO: Finalise tier allocations once pricing is confirmed.
 *
 * Current state: all features are included on every tier (including trial)
 * so nothing is blocked while pricing is being decided.  When tiers are set,
 * simply remove feature keys from the lower-tier arrays — the middleware and
 * routes will enforce the gates automatically without any other code change.
 *
 * Suggested starting point (edit when ready):
 *   trial    → core only (no add-ons, time-limited)
 *   basic    → + report_cards, parent_portal, timetable
 *   standard → + library, transport, bulk_import, audit_log
 *   premium  → + sms + everything
 */
export const PLAN_FEATURE_MAP = {
  [PLAN_TIERS.TRIAL]: Object.values(PLAN_FEATURES),    // TODO: restrict when pricing set
  [PLAN_TIERS.BASIC]: Object.values(PLAN_FEATURES),    // TODO: define
  [PLAN_TIERS.STANDARD]: Object.values(PLAN_FEATURES), // TODO: define
  [PLAN_TIERS.PREMIUM]: Object.values(PLAN_FEATURES),  // all features
};

// Redis cache TTLs (seconds)
export const CACHE_TTL = {
  SCHOOL_SUBSCRIPTION: 5 * 60,    // 5 minutes
  CLASS_LIST: 10 * 60,            // 10 minutes
  SCHOOL_SETTINGS: 30 * 60,       // 30 minutes
  SUBJECT_LIST: 15 * 60,          // 15 minutes
};
