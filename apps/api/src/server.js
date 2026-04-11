import 'dotenv/config';
import { fileURLToPath } from 'url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import { validateEnv, env } from './config/env.js';
import { connectDB } from './config/db.js';
import { connectRedis, getRedis } from './config/redis.js';
import { corsOptions } from './config/cors.js';
import logger from './config/logger.js';
import errorHandler from './middleware/errorHandler.js';
import { csrf } from './middleware/csrf.js';
import authRoutes from './features/auth/auth.routes.js';
import userRoutes from './features/users/users.routes.js';
import classRoutes from './features/classes/classes.routes.js';
import studentRoutes from './features/students/students.routes.js';
import attendanceRoutes from './features/attendance/attendance.routes.js';
import subjectRoutes from './features/subjects/subjects.routes.js';
import examRoutes from './features/exams/exams.routes.js';
import resultRoutes from './features/results/results.routes.js';
import feeRoutes from './features/fees/fees.routes.js';
import reportCardRoutes from './features/report-cards/report-cards.routes.js';
import schoolRoutes from './features/schools/schools.routes.js';
import parentRoutes from './features/parent/parent.routes.js';
import auditRoutes from './features/audit/audit.routes.js';
import settingsRoutes from './features/settings/settings.routes.js';
import timetableRoutes from './features/timetable/timetable.routes.js';
import libraryRoutes from './features/library/library.routes.js';
import transportRoutes from './features/transport/transport.routes.js';

// Validate env before anything else — exits if required vars missing
validateEnv();

const app = express();

// ── Security middleware ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors(corsOptions));
app.use(csrf); // Origin/Referer validation — defense-in-depth CSRF guard

// ── Parsing middleware ───────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── HTTP request logging ─────────────────────────────────────────────────────
// Silence in tests; use morgan piped through Winston in all other envs.
// Production: Apache "combined" format → JSON log file.
// Development: concise "dev" format → coloured console.
if (env.NODE_ENV !== 'test') {
  const morganFormat = env.isProduction ? 'combined' : 'dev';
  const morganStream = {
    // Pipe morgan output into Winston so all logs go to the same place
    write: (message) => logger.http(message.trim()),
  };
  app.use(morgan(morganFormat, { stream: morganStream }));
}

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    const redis = getRedis();
    if (redis) await redis.ping();
    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: { api: 'up', mongodb: 'up', redis: redis ? 'up' : 'not_connected' },
    });
  } catch (err) {
    return res.status(503).json({ status: 'degraded', error: err.message });
  }
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/classes', classRoutes);
app.use('/api/v1/students', studentRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/subjects', subjectRoutes);
app.use('/api/v1/exams', examRoutes);
app.use('/api/v1/results', resultRoutes);
app.use('/api/v1/fees', feeRoutes);
app.use('/api/v1/report-cards', reportCardRoutes);
app.use('/api/v1/schools', schoolRoutes);
app.use('/api/v1/parent', parentRoutes);
app.use('/api/v1/audit-logs', auditRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/timetables', timetableRoutes);
app.use('/api/v1/library', libraryRoutes);
app.use('/api/v1/transport', transportRoutes);

// ── 404 catch-all ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.url} not found` });
});

// ── Global error handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

// ── Boot — only when run directly, not when imported by tests ────────────────
const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  const start = async () => {
    await connectDB();
    connectRedis();
    app.listen(env.PORT, () => {
      logger.info(`API server running on port ${env.PORT}`, { env: env.NODE_ENV });
      logger.info(`Health check: http://localhost:${env.PORT}/health`);
    });
  };
  start();
}

export default app;
