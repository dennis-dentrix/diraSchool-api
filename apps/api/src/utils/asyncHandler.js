/**
 * Wraps async controller functions to eliminate try/catch boilerplate.
 * All errors are forwarded to the global error handler middleware.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
