/**
 * Email worker — processes jobs from the email queue.
 *
 * Each job has a `type` field that maps to a specific email template:
 *   - 'invite'         → account invitation for new staff
 *   - 'password-reset' → forgot-password flow
 *
 * Jobs are enqueued by controllers and processed here asynchronously
 * so HTTP responses don't block waiting for the Resend API.
 */
import { Worker } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '../../constants/index.js';
import { createBullMQConnection } from '../../config/redis.js';
<<<<<<< HEAD
import {
  sendInviteEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendTempPasswordEmail,
} from '../../services/email.service.js';
=======
import { sendInviteEmail, sendPasswordResetEmail, sendVerificationEmail } from '../../services/email.service.js';
>>>>>>> efe73423fd6ede0a8ef64087cc643b364dbf41b5

export const startEmailWorker = () => {
  const worker = new Worker(
    QUEUE_NAMES.EMAIL,
    async (job) => {
      const { type, payload } = job.data;

      switch (type) {
        case JOB_NAMES.SEND_INVITE_EMAIL:
          await sendInviteEmail(payload);
          break;

        case JOB_NAMES.SEND_RESET_EMAIL:
          await sendPasswordResetEmail(payload);
          break;

        case JOB_NAMES.SEND_VERIFICATION_EMAIL:
          await sendVerificationEmail(payload);
          break;

<<<<<<< HEAD
        case JOB_NAMES.SEND_TEMP_PASSWORD_EMAIL:
          await sendTempPasswordEmail(payload);
          break;

=======
>>>>>>> efe73423fd6ede0a8ef64087cc643b364dbf41b5
        default:
          throw new Error(`Unknown email job type: ${type}`);
      }

      console.log(`[Email Worker] Sent "${type}" to ${job.data.payload?.to}`);
    },
    {
      connection: createBullMQConnection(),
      concurrency: 5,
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`[Email Worker] Job ${job?.id} (${job?.data?.type}) failed:`, err.message);
  });

  return worker;
};
