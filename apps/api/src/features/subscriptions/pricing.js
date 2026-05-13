import SchoolGroup from '../admin/SchoolGroup.model.js';

export const DEFAULT_BASE_FEE = 12000;
export const DEFAULT_PER_STUDENT_RATE = 55;
export const DEFAULT_CURRENCY = 'KES';
export const DEFAULT_VAT_RATE = 0.16;
export const DEFAULT_CORPORATE_TAX_RATE = 0.30;

export const BILLING_MULTIPLIERS = {
  'per-term': 1,
  annual: 2.70,
  'multi-year': 2.55,
};

export function isPricingAgreementActive(agreement, now = new Date()) {
  if (!agreement?.enabled) return false;

  const startsAt = agreement.startsAt ? new Date(agreement.startsAt) : null;
  const expiresAt = agreement.expiresAt ? new Date(agreement.expiresAt) : null;

  if (startsAt && startsAt > now) return false;
  if (expiresAt && expiresAt < now) return false;
  return true;
}

export function defaultPricingTerms() {
  return {
    source: 'standard',
    baseFee: DEFAULT_BASE_FEE,
    perStudentRate: DEFAULT_PER_STUDENT_RATE,
    currency: DEFAULT_CURRENCY,
    agreementReference: null,
    notes: null,
    startsAt: null,
    expiresAt: null,
  };
}

function termsFromAgreement(agreement, source, extra = {}) {
  return {
    source,
    baseFee: Number(agreement.baseFee ?? DEFAULT_BASE_FEE),
    perStudentRate: Number(agreement.perStudentRate ?? DEFAULT_PER_STUDENT_RATE),
    currency: agreement.currency || DEFAULT_CURRENCY,
    agreementReference: agreement.agreementReference || null,
    notes: agreement.notes || null,
    startsAt: agreement.startsAt || null,
    expiresAt: agreement.expiresAt || null,
    ...extra,
  };
}

export async function resolvePricingTermsForSchool(school) {
  if (isPricingAgreementActive(school?.pricingAgreement)) {
    return termsFromAgreement(school.pricingAgreement, 'school', {
      schoolId: school._id,
      schoolName: school.name,
    });
  }

  if (school?.groupId) {
    const group = await SchoolGroup.findById(school.groupId).lean();
    if (isPricingAgreementActive(group?.pricingAgreement)) {
      return termsFromAgreement(group.pricingAgreement, 'group', {
        groupId: group._id,
        groupName: group.name,
      });
    }
  }

  return defaultPricingTerms();
}

export function calculateSubscriptionAmount({ studentCount, billingCycle = 'per-term', terms }) {
  const safeStudentCount = Math.max(parseInt(studentCount, 10) || 1, 1);
  const pricingTerms = terms || defaultPricingTerms();
  const baseFee = Math.max(Number(pricingTerms.baseFee ?? DEFAULT_BASE_FEE), 0);
  const perStudentRate = Math.max(Number(pricingTerms.perStudentRate ?? DEFAULT_PER_STUDENT_RATE), 0);
  const multiplier = BILLING_MULTIPLIERS[billingCycle] ?? BILLING_MULTIPLIERS['per-term'];
  const studentComponent = safeStudentCount * perStudentRate;
  const subtotalPerTerm = baseFee + studentComponent;
  const subtotalExVat = Math.round(subtotalPerTerm * multiplier);
  const vatAmount = Math.round(subtotalExVat * DEFAULT_VAT_RATE);
  const total = subtotalExVat + vatAmount;

  return {
    baseFee,
    perStudentRate,
    studentComponent,
    subtotalPerTerm: Math.round(subtotalPerTerm),
    multiplier,
    subtotalExVat,
    vatRate: DEFAULT_VAT_RATE,
    vatAmount,
    total,
    currency: pricingTerms.currency || DEFAULT_CURRENCY,
  };
}

export function pricingAgreementSnapshot(terms) {
  if (!terms || terms.source === 'standard') return null;
  return {
    source: terms.source,
    baseFee: terms.baseFee,
    perStudentRate: terms.perStudentRate,
    currency: terms.currency || DEFAULT_CURRENCY,
    agreementReference: terms.agreementReference || null,
    notes: terms.notes || null,
    startsAt: terms.startsAt || null,
    expiresAt: terms.expiresAt || null,
    schoolId: terms.schoolId || null,
    schoolName: terms.schoolName || null,
    groupId: terms.groupId || null,
    groupName: terms.groupName || null,
  };
}
