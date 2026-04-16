/**
 * Email worker — processes jobs from the email queue.
 *
 * Each job has a `type` field that maps to a specific email template:
 *   - 'invite'         → account invitation for new staff
 *   - 'password-reset' → forgot-password flow
 *
 * Jobs are enqueued by controllers and processed here asynchronously
 * so HTTP responses don't block waiting for external email providers.
 */
import { Worker } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '../../constants/index.js';
import { createBullMQConnection } from '../../config/redis.js';
import { sendInviteEmail, sendPasswordResetEmail, sendVerificationEmail } from '../../services/email.service.js';
import logger from '../../config/logger.js';

export const startEmailWorker = () => {
  const worker = new Worker(
    QUEUE_NAMES.EMAIL,
    async (job) => {
      const { type, payload } = job.data;

      let result;
      switch (type) {
        case JOB_NAMES.SEND_INVITE_EMAIL:
          result = await sendInviteEmail(payload);
          break;

        case JOB_NAMES.SEND_RESET_EMAIL:
          result = await sendPasswordResetEmail(payload);
          break;

        case JOB_NAMES.SEND_VERIFICATION_EMAIL:
          result = await sendVerificationEmail(payload);
          break;

        default:
          throw new Error(`Unknown email job type: ${type}`);
      }

      logger.info('[Email Worker] Sent email', {
        type,
        to: payload?.to,
        provider: result?.provider,
        providerMessageId: result?.providerMessageId,
      });
    },
    {
      connection: createBullMQConnection(),
      concurrency: 5,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error('[Email Worker] Job failed', {
      jobId: job?.id,
      type: job?.data?.type,
      err: err.message,
    });
  });

  return worker;
};
