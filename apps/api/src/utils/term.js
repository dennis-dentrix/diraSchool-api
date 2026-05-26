import SchoolSettings from '../features/settings/SchoolSettings.model.js';
import SystemSettings  from '../features/admin/SystemSettings.model.js';

/**
 * Derives the current Kenya school term and academic year from the calendar.
 *   Term 1 — January to April      (months 0–3)
 *   Term 2 — May to August         (months 4–7)
 *   Term 3 — September to December (months 8–11)
 */
export function getCurrentTermAndYear() {
  const now   = new Date();
  const month = now.getMonth();
  const year  = now.getFullYear();
  let term;
  if (month <= 3)      term = 'Term 1';
  else if (month <= 7) term = 'Term 2';
  else                 term = 'Term 3';
  return { term, academicYear: String(year) };
}

/**
 * Resolve the active term + academic year for a school.
 *
 * Priority:
 *   1. School's own SchoolSettings (if term date ranges are configured and one is active today)
 *   2. Platform SystemSettings (superadmin-defined global defaults, same date-range logic)
 *   3. Calendar heuristic (getCurrentTermAndYear)
 */
export async function resolveCurrentTermAndYear(schoolId) {
  const now = new Date();

  const findActiveTerm = (terms = []) =>
    terms.find((t) => new Date(t.startDate) <= now && now <= new Date(t.endDate));

  // 1 — school-level settings
  const schoolSettings = await SchoolSettings.findOne({ schoolId }).lean();
  const schoolTerm = findActiveTerm(schoolSettings?.terms);
  if (schoolTerm) {
    return {
      term:         schoolTerm.name,
      academicYear: schoolSettings.currentAcademicYear || String(now.getFullYear()),
      source:       'school',
    };
  }

  // 2 — platform system settings
  const systemSettings = await SystemSettings.findOne().lean();
  const systemTerm = findActiveTerm(systemSettings?.terms);
  if (systemTerm) {
    return {
      term:         systemTerm.name,
      academicYear: systemSettings.currentAcademicYear || String(now.getFullYear()),
      source:       'system',
    };
  }

  // 3 — calendar heuristic
  const { term, academicYear } = getCurrentTermAndYear();
  return { term, academicYear, source: 'heuristic' };
}
