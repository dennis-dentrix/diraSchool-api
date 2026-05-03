import logger from '../config/logger.js';

// Circular buffer of the last 100 request durations (milliseconds)
const WINDOW = 100;
const durations = new Array(WINDOW).fill(0);
let head = 0;
let total = 0;

export const getResponseTimeStats = () => {
  const filled = Math.min(total, WINDOW);
  if (filled === 0) return { avg: 0, samples: 0 };
  const sum = durations.reduce((a, b) => a + b, 0);
  return { avg: Math.round(sum / filled), samples: filled };
};

export const responseTime = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const ms = Date.now() - start;

    // Update rolling average
    durations[head % WINDOW] = ms;
    head++;
    total++;

    const meta = {
      method:   req.method,
      path:     req.path,
      status:   res.statusCode,
      ms,
      userId:   req.user?._id   ? String(req.user._id)   : undefined,
      schoolId: req.user?.schoolId ? String(req.user.schoolId) : undefined,
    };

    if (ms >= 2000) {
      logger.error('[Perf] CRITICAL slow request', meta);
    } else if (ms >= 500) {
      logger.warn('[Perf] Slow request', meta);
    }
  });

  next();
};
