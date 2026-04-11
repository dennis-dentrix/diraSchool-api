/**
 * Queue instances — imported by controllers to enqueue jobs,
 * and by workers to register processors.
 *
 * All queues share the same Redis connection (ioredis).
 * BullMQ requires maxRetriesPerRequest: null on the connection.
 */
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../constants/index.js';
import { env } from '../config/env.js';

const connection = {
  host: new URL(env.REDIS_URL).hostname,
  port: Number(new URL(env.REDIS_URL).port) || 6379,
  password: new URL(env.REDIS_URL).password || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

export const smsQueue = new Queue(QUEUE_NAMES.SMS, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 }, // 5s, 10s, 20s
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
    attempts: 1,          // import is not safe to retry blindly
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
