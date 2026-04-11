/**
 * Worker process entry point.
 *
 * Run separately from the API server:
 *   node src/jobs/worker.entry.js
 *
 * In production (PM2 ecosystem.config.js):
 *   { name: 'worker', script: 'src/jobs/worker.entry.js' }
 *
 * This process connects to MongoDB + Redis, registers BullMQ processors
 * for each queue, and runs indefinitely — consuming jobs as they arrive.
 */
import 'dotenv/config';
import { Worker } from 'bullmq';
import mongoose from 'mongoose';
import { validateEnv, env } from '../config/env.js';
import { connectDB } from '../config/db.js';
import logger from '../config/logger.js';
import { QUEUE_NAMES } from '../constants/index.js';
import { createBullMQConnection } from '../config/redis.js';
import { processSmsJob } from './workers/sms.worker.js';
import { processReportJob } from './workers/report.worker.js';
import { processReceiptJob } from './workers/receipt.worker.js';
import { processImportJob } from './workers/import.worker.js';

validateEnv();

// Must be a Redis *instance* — see redis.js createBullMQConnection() for details.
const connection = createBullMQConnection();

// ── Start DB then register workers ────────────────────────────────────────────

await connectDB();

const smsWorker = new Worker(QUEUE_NAMES.SMS, processSmsJob, {
  connection,
  concurrency: 5,    // process up to 5 SMS jobs in parallel
});

const reportWorker = new Worker(QUEUE_NAMES.REPORT, processReportJob, {
  connection,
  concurrency: 2,    // PDF generation is CPU-heavy — keep concurrency low
});

const receiptWorker = new Worker(QUEUE_NAMES.RECEIPT, processReceiptJob, {
  connection,
  concurrency: 5,
});

const importWorker = new Worker(QUEUE_NAMES.IMPORT, processImportJob, {
  connection,
  concurrency: 1,    // serial imports prevent DB contention and transaction conflicts
});

// ── Event logging ─────────────────────────────────────────────────────────────

for (const [name, worker] of [
  ['sms',     smsWorker],
  ['report',  reportWorker],
  ['receipt', receiptWorker],
  ['import',  importWorker],
]) {
  worker.on('completed', (job) => {
    logger.info(`[Worker:${name}] Job ${job.id} completed`);
  });
  worker.on('failed', (job, err) => {
    logger.error(`[Worker:${name}] Job ${job?.id} failed: ${err.message}`, {
      stack: err.stack,
    });
  });
  worker.on('error', (err) => {
    logger.error(`[Worker:${name}] Worker error: ${err.message}`);
  });
}

logger.info('[Worker] All workers started and listening for jobs');

// ── Graceful shutdown ─────────────────────────────────────────────────────────

const shutdown = async (signal) => {
  logger.info(`[Worker] ${signal} received — shutting down gracefully`);
  await smsWorker.close();
  await reportWorker.close();
  await receiptWorker.close();
  await importWorker.close();
  await mongoose.disconnect();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
