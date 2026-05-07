/**
 * Derives the current Kenya school term and academic year from the calendar.
 *   Term 1 — January to April   (months 0–3)
 *   Term 2 — May to August      (months 4–7)
 *   Term 3 — September to December (months 8–11)
 */
export function getCurrentTermAndYear() {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  let term;
  if (month <= 3) term = 'Term 1';
  else if (month <= 7) term = 'Term 2';
  else term = 'Term 3';
  return { term, academicYear: String(year) };
}
