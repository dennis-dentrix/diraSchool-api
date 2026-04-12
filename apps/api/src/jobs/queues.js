/**
 * BullMQ Queue instances — imported by controllers to enqueue jobs
 * and by workers to register processors.
 *
 * Uses buildRedisOptions() so TLS, keepAlive, and family settings
 * are applied consistently whether connecting to local Redis or Upstash.
 */
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../constants/index.js';
import { createBullMQConnection } from '../config/redis.js';

// Shared ioredis instance for all queues.
// BullMQ will duplicate() it internally for each Queue/Worker connection.
// Must be a Redis *instance* — passing { url: '...' } as options is silently ignored by ioredis.
const connection = createBullMQConnection();

export const smsQueue = new Queue(QUEUE_NAMES.SMS, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  },
});

export const reportQueue = new Queue(QUEUE_NAMES.REPORT, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 10000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

export const importQueue = new Queue(QUEUE_NAMES.IMPORT, {
  connection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});

export const receiptQueue = new Queue(QUEUE_NAMES.RECEIPT, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 500 },
  },
});

export const emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  },
});
