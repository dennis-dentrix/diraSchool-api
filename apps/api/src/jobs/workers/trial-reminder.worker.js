/**
 * Trial Reminder Worker
 *
 * Runs daily at 08:00 UTC (11:00 EAT). Each run checks all trial schools
 * and sends engagement emails at three points in the trial lifecycle:
 *
 *   Day 3  — onboarding nudge: have you set up your first class?
 *   Day 15 — midpoint: feature recap + pricing
 *   Day 27 — urgency: trial ends in 3 days, subscribe now
 *
 * The window check uses a ±12-hour band around the target day so a single
 * daily cron always catches the school regardless of minor timing drift.
 */
import School from '../../features/schools/School.model.js';
import User from '../../features/users/User.model.js';
import { emailQueue } from '../queues.js';
import { JOB_NAMES, ROLES, SUBSCRIPTION_STATUSES } from '../../constants/index.js';
import { env } from '../../config/env.js';
import logger from '../../config/logger.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Returns true if `trialExpiry` falls within [daysAhead - 0.5, daysAhead + 0.5) days from now.
 */
const inWindow = (trialExpiry, daysAhead) => {
  const now = Date.now();
  const lo = now + (daysAhead - 0.5) * DAY_MS;
  const hi = now + (daysAhead + 0.5) * DAY_MS;
  const expMs = new Date(trialExpiry).getTime();
  return expMs >= lo && expMs < hi;
};

const daysLeft = (trialExpiry) =>
  Math.ceil((new Date(trialExpiry).getTime() - Date.now()) / DAY_MS);

const queueTrialEmail = async (jobName, user, school) => {
  const left = daysLeft(school.trialExpiry);
  await emailQueue.add(
    jobName,
    {
      type: jobName,
      payload: {
        to: user.email,
        firstName: user.firstName,
        schoolName: school.name,
        dashboardUrl: env.CLIENT_URL,
        trialDaysLeft: left,
        meta: {
          schoolId: school._id,
          userId: user._id,
          flow: 'trial-reminder',
        },
      },
    },
    { attempts: 2, backoff: { type: 'fixed', delay: 60_000 } }
  );
};

export const processTrialReminderScan = async () => {
  const trialSchools = await School.find({
    subscriptionStatus: SUBSCRIPTION_STATUSES.TRIAL,
    isActive: true,
    trialExpiry: { $gt: new Date() },
  }).select('name trialExpiry').lean();

  let sent = 0;
  let skipped = 0;

  for (const school of trialSchools) {
    // Determine which email window this school falls into
    let jobName = null;
    if (inWindow(school.trialExpiry, 27))      jobName = JOB_NAMES.SEND_TRIAL_DAY3_EMAIL;
    else if (inWindow(school.trialExpiry, 15)) jobName = JOB_NAMES.SEND_TRIAL_MIDPOINT_EMAIL;
    else if (inWindow(school.trialExpiry, 3))  jobName = JOB_NAMES.SEND_TRIAL_EXPIRY_EMAIL;

    if (!jobName) {
      skipped++;
      continue;
    }

    const admin = await User.findOne({
      schoolId: school._id,
      role: ROLES.SCHOOL_ADMIN,
      isActive: true,
      email: { $exists: true, $nin: [null, ''] },
    }).select('email firstName').lean();

    if (!admin) {
      skipped++;
      continue;
    }

    try {
      await queueTrialEmail(jobName, admin, school);
      sent++;
      logger.info('[TrialReminder] Queued email', {
        jobName,
        schoolId: school._id,
        adminEmail: admin.email,
        daysLeft: daysLeft(school.trialExpiry),
      });
    } catch (err) {
      logger.error('[TrialReminder] Failed to queue email', {
        schoolId: school._id,
        err: err.message,
      });
    }
  }

  logger.info('[TrialReminder] Scan complete', {
    sent,
    skipped,
    total: trialSchools.length,
  });
};
