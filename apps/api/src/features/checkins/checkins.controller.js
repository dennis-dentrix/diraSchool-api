import CheckIn       from './CheckIn.model.js';
import SchoolSettings from '../settings/SchoolSettings.model.js';
import User           from '../users/User.model.js';
import asyncHandler   from '../../utils/asyncHandler.js';
import { sendSuccess, sendError, sendForbidden } from '../../utils/response.js';
import { ROLES }      from '../../constants/index.js';

// Roles subject to geofence enforcement
const HARD_ENFORCE_ROLES = [
  ROLES.TEACHER,
  ROLES.DEPARTMENT_HEAD,
  ROLES.SECRETARY,
  ROLES.ACCOUNTANT,
];
const SOFT_ENFORCE_ROLES = [ROLES.HEADTEACHER, ROLES.DEPUTY_HEADTEACHER, ROLES.DIRECTOR];
// school_admin and superadmin skip geofencing entirely

/**
 * Haversine formula — returns distance in metres between two GPS points.
 */
function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R  = 6_371_000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a  =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Compare current Kenya time against a "HH:MM" deadline string.
 * Returns true if the current time is strictly after the deadline.
 */
function isLateCheckIn(deadlineStr, now = new Date()) {
  const [dh, dm] = deadlineStr.split(':').map(Number);
  // Use East Africa Time (UTC+3) for comparison
  const eatOffset = 3 * 60; // minutes
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const eatMinutes = (utcMinutes + eatOffset) % (24 * 60);
  return eatMinutes > dh * 60 + dm;
}

// ── POST /api/v1/checkins ─────────────────────────────────────────────────────

export const createCheckIn = asyncHandler(async (req, res) => {
  const {
    latitude,
    longitude,
    accuracy,
    check_in_type   = 'morning_in',
    off_site_reason,
    synced_offline  = false,
    client_timestamp,
  } = req.body;

  const staffId = req.user._id;
  const schoolId = req.user.schoolId;
  const role = req.user.role;

  // Reject readings with poor accuracy (already validated by client, server double-checks)
  if (accuracy > 200) {
    return sendError(res,
      'Location accuracy too low. Please move to an open area and try again.',
      400
    );
  }

  // Fetch school settings (geofence + check-in deadline)
  const settings = await SchoolSettings.findOne({ schoolId }).lean();

  const geofence       = settings?.geofence;
  const deadline       = settings?.checkInDeadline ?? '08:00';
  const checkOutTime   = settings?.checkOutTime    ?? '17:00';
  const relevantDeadline = check_in_type === 'morning_in' ? deadline : checkOutTime;

  // If no geofence is configured, allow check-in but note it
  if (!geofence?.latitude || !geofence?.longitude) {
    const status = isLateCheckIn(relevantDeadline) ? 'late' : 'on_time';
    const record = await CheckIn.create({
      staffId, schoolId, latitude, longitude, accuracy,
      distance_from_center: 0,
      status, check_in_type,
      off_site: false,
      synced_offline,
      client_timestamp: client_timestamp ? new Date(client_timestamp) : undefined,
    });
    return sendSuccess(res, {
      checkIn: { _id: record._id, status, distance_from_center: 0 },
      message: 'Checked in (no geofence configured for this school).',
    }, 201);
  }

  // Calculate distance
  const distance = Math.round(
    getDistanceMeters(latitude, longitude, geofence.latitude, geofence.longitude)
  );
  const isOutside = distance > geofence.radius_meters;

  // Hard enforcement: block non-principal staff if outside boundary
  const isHardEnforced = HARD_ENFORCE_ROLES.includes(role);
  const isSoftEnforced = SOFT_ENFORCE_ROLES.includes(role);

  if (isOutside && isHardEnforced) {
    return res.status(403).json({
      success: false,
      message: `Check-in failed. You are ${distance}m from school. You must be on school premises to check in.`,
      distance_from_center: distance,
      radius_meters: geofence.radius_meters,
    });
  }

  // Soft enforcement: principal must provide a reason if outside
  if (isOutside && isSoftEnforced && !off_site_reason?.trim()) {
    return res.status(422).json({
      success: false,
      code: 'OFF_SITE_REASON_REQUIRED',
      message: `You are ${distance}m from school. Please provide a reason for off-site check-in.`,
      distance_from_center: distance,
    });
  }

  const status = isLateCheckIn(relevantDeadline) ? 'late' : 'on_time';
  const off_site = isOutside && (isHardEnforced === false);

  const record = await CheckIn.create({
    staffId, schoolId, latitude, longitude, accuracy,
    distance_from_center: distance,
    status,
    check_in_type,
    off_site,
    off_site_reason: off_site ? off_site_reason : undefined,
    synced_offline,
    client_timestamp: client_timestamp ? new Date(client_timestamp) : undefined,
  });

  return sendSuccess(res, {
    checkIn: {
      _id:                  record._id,
      status,
      distance_from_center: distance,
      off_site,
    },
    message: off_site
      ? `Off-site check-in recorded. You are ${distance}m from school.`
      : `Check-in successful. You are ${distance}m from school.`,
  }, 201);
});

// ── GET /api/v1/checkins/today ────────────────────────────────────────────────
// Returns today's check-in record(s) for the authenticated staff member

export const getMyTodayCheckIns = asyncHandler(async (req, res) => {
  const now        = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd   = new Date(todayStart.getTime() + 86_400_000);

  const records = await CheckIn.find({
    staffId: req.user._id,
    schoolId: req.user.schoolId,
    createdAt: { $gte: todayStart, $lt: todayEnd },
  }).sort({ createdAt: -1 }).lean();

  return sendSuccess(res, { checkIns: records });
});

// ── GET /api/v1/checkins/roster — admin daily roster ─────────────────────────

export const getDailyRoster = asyncHandler(async (req, res) => {
  const { date } = req.query;
  const now = date ? new Date(date) : new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd   = new Date(dayStart.getTime() + 86_400_000);

  const [checkIns, allStaff] = await Promise.all([
    CheckIn.find({ schoolId: req.user.schoolId, createdAt: { $gte: dayStart, $lt: dayEnd } })
      .populate('staffId', 'firstName lastName role')
      .sort({ createdAt: 1 })
      .lean(),
    User.find({
      schoolId: req.user.schoolId,
      isActive: true,
      role: { $in: [...HARD_ENFORCE_ROLES, ...SOFT_ENFORCE_ROLES] },
    }).select('firstName lastName role').lean(),
  ]);

  // Group check-in records by staffId, separating morning_in from evening_out
  const checkInMap = new Map();
  for (const record of checkIns) {
    const staffId = String(record.staffId?._id ?? record.staffId);
    if (!checkInMap.has(staffId)) {
      checkInMap.set(staffId, { staff: record.staffId, morningIn: null, eveningOut: null });
    }
    const entry = checkInMap.get(staffId);
    if (record.check_in_type === 'morning_in') entry.morningIn = record;
    else if (record.check_in_type === 'evening_out') entry.eveningOut = record;
  }

  // Build full roster: one row per staff member
  const roster = allStaff.map((staff) => {
    const entry = checkInMap.get(String(staff._id));
    return {
      staff,
      morningIn:  entry?.morningIn  ?? null,
      eveningOut: entry?.eveningOut ?? null,
      present:    !!(entry?.morningIn),
    };
  });

  // Include any staff who checked in but whose role may have changed
  for (const [staffId, entry] of checkInMap) {
    if (!roster.some((r) => String(r.staff._id ?? r.staff) === staffId)) {
      roster.push({ staff: entry.staff, morningIn: entry.morningIn, eveningOut: entry.eveningOut, present: true });
    }
  }

  const present    = roster.filter((r) => r.present);
  const absent     = roster.filter((r) => !r.present);
  const checkedOut = roster.filter((r) => r.eveningOut);

  return sendSuccess(res, {
    date:    dayStart.toISOString().split('T')[0],
    roster,
    counts: {
      total:      roster.length,
      present:    present.length,
      absent:     absent.length,
      checkedOut: checkedOut.length,
      late:       present.filter((r) => r.morningIn?.status === 'late').length,
      on_time:    present.filter((r) => r.morningIn?.status === 'on_time').length,
      off_site:   present.filter((r) => r.morningIn?.off_site).length,
    },
  });
});

// ── GET /api/v1/checkins/staff/:staffId — per-staff history (admin) ───────────

export const getStaffCheckInHistory = asyncHandler(async (req, res) => {
  const { staffId } = req.params;
  const { from, to, limit = 30, page = 1 } = req.query;

  const filter = { schoolId: req.user.schoolId, staffId };
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to)   filter.createdAt.$lte = new Date(to);
  }

  const skip  = (Number(page) - 1) * Number(limit);
  const [records, total] = await Promise.all([
    CheckIn.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    CheckIn.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    checkIns: records,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
  });
});

// ── PUT /api/v1/settings/geofence ─────────────────────────────────────────────

export const updateGeofence = asyncHandler(async (req, res) => {
  const { latitude, longitude, radius_meters = 150 } = req.body;
  const schoolId = req.user.schoolId;

  const settings = await SchoolSettings.findOneAndUpdate(
    { schoolId },
    {
      $set: {
        'geofence.latitude':      latitude,
        'geofence.longitude':     longitude,
        'geofence.radius_meters': radius_meters,
        'geofence.configured_by': req.user._id,
        'geofence.configured_at': new Date(),
      },
    },
    { new: true, upsert: true }
  );

  return sendSuccess(res, { geofence: settings.geofence });
});

// ── PUT /api/v1/settings/checkin-times ────────────────────────────────────────

export const updateCheckInTimes = asyncHandler(async (req, res) => {
  const { checkInDeadline, checkOutTime } = req.body;
  const schoolId = req.user.schoolId;

  const update = {};
  if (checkInDeadline) update.checkInDeadline = checkInDeadline;
  if (checkOutTime)    update.checkOutTime    = checkOutTime;

  const settings = await SchoolSettings.findOneAndUpdate(
    { schoolId },
    { $set: update },
    { new: true, upsert: true }
  );

  return sendSuccess(res, {
    checkInDeadline: settings.checkInDeadline,
    checkOutTime:    settings.checkOutTime,
  });
});
