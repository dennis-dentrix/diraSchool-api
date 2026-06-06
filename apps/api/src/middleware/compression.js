/**
 * Compression and caching middleware for API responses.
 * Dramatically reduces response size and improves browser caching.
 */

import compression from 'compression';

/**
 * Setup compression for all responses.
 * Reduces response size by 60-80% for JSON responses.
 */
export const setupCompression = (app) => {
  // Compress all responses larger than 1KB
  app.use(compression({ threshold: 1024 }));
};

/**
 * Cache headers for different endpoint types.
 * Middleware to be applied to specific routes.
 */
export const cacheHeaders = {
  // Don't cache auth/user-specific responses
  noCache: (req, res, next) => {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    next();
  },

  // Cache list endpoints for 5 minutes
  list: (req, res, next) => {
    res.set({
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'Vary': 'Authorization',
    });
    next();
  },

  // Cache static data (schools, classes) for 1 hour
  static: (req, res, next) => {
    res.set({
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    });
    next();
  },

  // Cache read-only data for 10 minutes
  readonly: (req, res, next) => {
    res.set({
      'Cache-Control': 'public, max-age=600, s-maxage=600',
      'Vary': 'Authorization',
    });
    next();
  },
};

/**
 * Etag support for caching (automatic, built into Express).
 * Helps browsers avoid re-downloading unchanged responses.
 */
export const setupETag = (app) => {
  app.enable('etag');
};
