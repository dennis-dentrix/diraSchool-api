/**
 * Consistent API response helpers.
 * All responses must go through these — never use res.json() directly.
 *
 * Success shape:  { status: 'success', ...data }
 * Error shape:    { message: '...' }
 */

export const sendSuccess = (res, data = {}, statusCode = 200) => {
  return res.status(statusCode).json({ status: 'success', ...data });
};

export const sendError = (res, message, statusCode = 400) => {
  return res.status(statusCode).json({ message });
};

export const sendNotFound = (res, message = 'Resource not found') => {
  return res.status(404).json({ message });
};

export const sendUnauthorized = (res, message = 'Not authenticated') => {
  return res.status(401).json({ message });
};

export const sendForbidden = (res, message = 'Access denied') => {
  return res.status(403).json({ message });
};
