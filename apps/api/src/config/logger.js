/**
 * Structured logger — Winston with two transports:
 *
 *   1. Console  — human-readable in dev, JSON in production
 *   2. File     — always JSON, rotated daily, retained 14 days
 *        logs/error.log   — errors only
 *        logs/combined.log — all levels
 *
 * Usage:
 *   import logger from './config/logger.js';
 *   logger.info('Server started', { port: 3000 });
 *   logger.warn('Slow query', { ms: 450, collection: 'results' });
 *   logger.error('Unexpected error', { err: error.message, stack: error.stack });
 */
import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, '../../logs');
const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// ── Custom format ─────────────────────────────────────────────────────────────

const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const extras = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}] ${message}${extras}`;
  })
);

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// ── Transports ────────────────────────────────────────────────────────────────

const transports = [];

// Console — silenced in test to keep output clean
if (!isTest) {
  transports.push(
    new winston.transports.Console({
      format: isProd ? jsonFormat : devFormat,
    })
  );
}

// File transports — only in non-test environments
if (!isTest) {
  transports.push(
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      format: jsonFormat,
      maxsize: 10 * 1024 * 1024, // 10 MB per file
      maxFiles: 14,              // 14 rotations (~14 days at 1 file/day)
      tailable: true,
    }),
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      format: jsonFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 14,
      tailable: true,
    })
  );
}

// ── Logger instance ───────────────────────────────────────────────────────────

const logger = winston.createLogger({
  // 'http' sits between 'info' (3) and 'verbose' (4) in Winston's default hierarchy.
  // In dev show everything down to debug; in prod only info and above.
  level: isProd ? 'info' : 'debug',
  levels: { ...winston.config.npm.levels, http: 3 },
  transports,
  exitOnError: false,
});

export default logger;
