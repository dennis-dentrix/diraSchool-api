import {
  LEVEL_CATEGORIES,
  RUBRIC_LEVELS_4,
  RUBRIC_LEVELS_8,
} from '../constants/index.js';

export const computeCBCGrade = (levelCategory, percentage) => {
  const pct = Math.max(0, Math.min(100, Number(percentage) || 0));

  if (
    levelCategory === LEVEL_CATEGORIES.LOWER_PRIMARY ||
    levelCategory === LEVEL_CATEGORIES.UPPER_PRIMARY
  ) {
    if (pct >= 75) return { grade: RUBRIC_LEVELS_4.EE, points: 4 };
    if (pct >= 50) return { grade: RUBRIC_LEVELS_4.ME, points: 3 };
    if (pct >= 25) return { grade: RUBRIC_LEVELS_4.AE, points: 2 };
    return { grade: RUBRIC_LEVELS_4.BE, points: 1 };
  }

  if (
    levelCategory === LEVEL_CATEGORIES.JUNIOR_SECONDARY ||
    levelCategory === LEVEL_CATEGORIES.SENIOR_SCHOOL
  ) {
    if (pct >= 90) return { grade: RUBRIC_LEVELS_8.EE1, points: 8 };
    if (pct >= 75) return { grade: RUBRIC_LEVELS_8.EE2, points: 7 };
    if (pct >= 58) return { grade: RUBRIC_LEVELS_8.ME1, points: 6 };
    if (pct >= 41) return { grade: RUBRIC_LEVELS_8.ME2, points: 5 };
    if (pct >= 31) return { grade: RUBRIC_LEVELS_8.AE1, points: 4 };
    if (pct >= 21) return { grade: RUBRIC_LEVELS_8.AE2, points: 3 };
    if (pct >= 11) return { grade: RUBRIC_LEVELS_8.BE1, points: 2 };
    return { grade: RUBRIC_LEVELS_8.BE2, points: 1 };
  }

  // Pre-Primary has no grading rubric (observation-only).
  return { grade: null, points: null };
};
