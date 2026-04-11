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
