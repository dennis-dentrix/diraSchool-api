import AuditLog from '../features/audit/AuditLog.model.js';

/**
 * Fire-and-forget audit log helper.
 * Call anywhere — never throws, never blocks the response.
 *
 * @param {import('express').Request} req
 * @param {{ action: string, resource: string, resourceId?: ObjectId|string, meta?: object }} opts
 */
export const logAction = (req, { action, resource, resourceId, meta = {} }) => {
  const entry = {
    userId:    req.user._id,
    userRole:  req.user.role,
    action,
    resource,
    ip:        req.ip || req.headers['x-forwarded-for'],
    userAgent: req.headers['user-agent'],
    meta,
  };

  // schoolId is optional — superadmin actions may not have one
  if (req.user.schoolId) entry.schoolId = req.user.schoolId;
  if (resourceId) entry.resourceId = resourceId;

  AuditLog.create(entry).catch(() => {
    // Silent — audit logging must never crash a request
  });
};

const TITLE_CASE_OVERRIDES = {
  auth: 'Auth',
  users: 'User',
  classes: 'Class',
  students: 'Student',
  attendance: 'Attendance',
  subjects: 'Subject',
  exams: 'Exam',
  results: 'Result',
  fees: 'Fee',
  'report-cards': 'ReportCard',
  schools: 'School',
  parent: 'Parent',
  'audit-logs': 'AuditLog',
  settings: 'Setting',
  timetables: 'Timetable',
  library: 'Library',
  transport: 'Transport',
  admin: 'Admin',
  dashboard: 'Dashboard',
  email: 'Email',
  pricing: 'Pricing',
  export: 'Export',
};

const inferResource = (req) => {
  const cleanPath = (req.baseUrl || req.path || '')
    .replace(/^\/api\/v1\//, '')
    .replace(/^\/+|\/+$/g, '');
  const firstSegment = cleanPath.split('/')[0] || 'system';
  return TITLE_CASE_OVERRIDES[firstSegment] || firstSegment;
};

const inferAction = (req) => {
  const path = `${req.baseUrl || ''}${req.path || ''}`.toLowerCase();
  const method = req.method?.toUpperCase();

  if (path.includes('/promote')) return 'promote';
  if (path.includes('/transfer')) return 'transfer';
  if (path.includes('/withdraw')) return 'withdraw';
  if (path.includes('/publish')) return 'publish';
  if (path.includes('/reverse')) return 'reverse';
  if (path.includes('/issue')) return 'issue';
  if (path.includes('/return')) return 'return';
  if (path.includes('/suspend')) return 'suspend';
  if (path.includes('/activate')) return 'activate';
  if (path.includes('/login')) return 'login';
  if (path.includes('/logout')) return 'logout';

  if (method === 'GET' || method === 'HEAD') return 'read';
  if (method === 'POST') return 'create';
  if (method === 'PATCH' || method === 'PUT') return 'update';
  if (method === 'DELETE') return 'delete';
  return method?.toLowerCase() || 'unknown';
};

/**
 * Attach once per request. Creates an automatic audit entry when the response
 * completes successfully (status < 500) for every protected API request.
 */
export const attachAutoAudit = (req, res) => {
  if (req._autoAuditAttached) return;
  req._autoAuditAttached = true;

  res.on('finish', () => {
    if (!req.user || req.method === 'OPTIONS') return;
    if (res.statusCode >= 500) return;

    logAction(req, {
      action: inferAction(req),
      resource: inferResource(req),
      resourceId: req.params?.id,
      meta: {
        auto: true,
        method: req.method,
        statusCode: res.statusCode,
        path: req.originalUrl || req.url,
      },
    });
  });
};
