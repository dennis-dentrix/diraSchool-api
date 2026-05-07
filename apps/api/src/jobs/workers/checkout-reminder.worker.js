/**
 * Checkout Reminder Worker
 *
 * Fired by a BullMQ repeatable job every 15 minutes on weekdays.
 * Each run determines which schools' checkout time ended ~60 minutes ago
 * (±15-minute window) and, for those schools, finds any staff member who
 * checked in (morning_in) today but never checked out (afternoon_out).
 * It then enqueues a lightweight email job per affected staff member.
 *
 * Why email and not SMS?
 *   Email via ZeptoMail is effectively free at this volume. SMS deducts
 *   from the school's paid credit pack, making it inappropriate for an
 *   automated system-driven message.
 */
import CheckIn        from '../../features/checkins/CheckIn.model.js';
import SchoolSettings from '../../features/settings/SchoolSettings.model.js';
import School         from '../../features/schools/School.model.js';
import User           from '../../features/users/User.model.js';
import { emailQueue } from '../queues.js';
import { JOB_NAMES, ROLES } from '../../constants/index.js';
import logger from '../../config/logger.js';

// Roles that are subject to checkout tracking
const TRACKED_ROLES = [
  ROLES.TEACHER,
  ROLES.DEPARTMENT_HEAD,
  ROLES.HEADTEACHER,
  ROLES.DEPUTY_HEADTEACHER,
  ROLES.SECRETARY,
  ROLES.ACCOUNTANT,
];

/**
 * Convert a "HH:MM" string to total EAT minutes since midnight.
 */
function eatMinutesFromTimeStr(timeStr) {
  const [h, m] = (timeStr ?? '17:00').split(':').map(Number);
  return h * 60 + m;
}

/**
 * Current East Africa Time (UTC+3) expressed as minutes since midnight.
 */
function currentEatMinutes() {
  const now = new Date();
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return (utcMinutes + 3 * 60) % (24 * 60);
}

/**
 * Start-of-day in UTC for the current EAT calendar date.
 * Used to scope today's check-in queries.
 */
function todayStartUTC() {
  const now = new Date();
  // EAT is UTC+3, so EAT midnight = UTC 21:00 the previous day
  const eatMidnightUTC = new Date(now);
  eatMidnightUTC.setUTCHours(21, 0, 0, 0);
  // If current UTC time is before 21:00 (i.e. EAT day hasn't rolled yet) go back one day
  if (now.getUTCHours() < 21) eatMidnightUTC.setUTCDate(eatMidnightUTC.getUTCDate() - 1);
  return eatMidnightUTC;
}

export const processCheckoutReminderScan = async () => {
  const nowEat    = currentEatMinutes();
  const dayStart  = todayStartUTC();

  // Load every school's settings (only the fields we need)
  const allSettings = await SchoolSettings.find({}, 'schoolId checkOutTime').lean();

  // Pre-load school names in one query
  const schoolIds  = allSettings.map((s) => s.schoolId);
  const schools    = await School.find({ _id: { $in: schoolIds } }, 'name').lean();
  const schoolName = schools.reduce((acc, s) => { acc[String(s._id)] = s.name; return acc; }, {});

  let reminded = 0;
  let skipped  = 0;

  for (const settings of allSettings) {
    const checkOutMinutes = eatMinutesFromTimeStr(settings.checkOutTime ?? '17:00');
    const minutesSinceCheckout = (nowEat - checkOutMinutes + 24 * 60) % (24 * 60);

    // Only act when we're 45–75 minutes past the school's checkout time
    if (minutesSinceCheckout < 45 || minutesSinceCheckout > 75) {
      skipped++;
      continue;
    }

    const schoolId = settings.schoolId;

    // Find all tracked staff who checked in today
    const checkedInToday = await CheckIn.find({
      schoolId,
      check_in_type: 'morning_in',
      createdAt: { $gte: dayStart },
    }).distinct('staffId');

    if (!checkedInToday.length) continue;

    // Find which of those already have an afternoon_out today
    const checkedOutToday = await CheckIn.find({
      schoolId,
      check_in_type: 'afternoon_out',
      staffId: { $in: checkedInToday },
      createdAt: { $gte: dayStart },
    }).distinct('staffId');

    const checkedOutSet = new Set(checkedOutToday.map(String));
    const stillIn = checkedInToday.filter((id) => !checkedOutSet.has(String(id)));

    if (!stillIn.length) continue;

    // Fetch user details for those who haven't checked out
    const users = await User.find({
      _id: { $in: stillIn },
      role: { $in: TRACKED_ROLES },
      isActive: true,
      email: { $exists: true, $nin: [null, ''] },
    }, 'firstName email').lean();

    for (const user of users) {
      await emailQueue.add(
        JOB_NAMES.SEND_CHECKOUT_REMINDER_EMAIL,
        {
          type: JOB_NAMES.SEND_CHECKOUT_REMINDER_EMAIL,
          payload: {
            to:           user.email,
            firstName:    user.firstName,
            schoolName:   schoolName[String(settings.schoolId)] ?? 'your school',
            checkOutTime: settings.checkOutTime ?? '17:00',
          },
        },
        { attempts: 2, backoff: { type: 'fixed', delay: 60_000 } }
      );
      reminded++;
    }
  }

  logger.info('[CheckoutReminder] Scan complete', { reminded, skipped, total: allSettings.length });
};
