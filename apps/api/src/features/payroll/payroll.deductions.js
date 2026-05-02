/**
 * Kenya statutory deduction calculators — 2024 rates.
 * All amounts in KES.
 */

// NHIF — sliding scale based on gross salary
const NHIF_BANDS = [
  [  5999,  150], [  7999,  300], [  11999,  400], [ 14999,  500],
  [ 19999,  600], [ 24999,  750], [ 29999,  850], [ 34999,  900],
  [ 39999,  950], [ 44999, 1000], [ 49999, 1100], [ 59999, 1200],
  [ 69999, 1300], [ 79999, 1400], [ 89999, 1500], [ 99999, 1600],
  [Infinity, 1700],
];

export function computeNHIF(grossSalary) {
  for (const [limit, deduction] of NHIF_BANDS) {
    if (grossSalary <= limit) return deduction;
  }
  return 1700;
}

// NSSF Tier I + Tier II (Act 2013)
// Tier I: 6% on up to KES 6,000 (max KES 360 employee + 360 employer)
// Tier II: 6% on next KES 12,000 (max KES 720 employee + 720 employer)
// Only employee share is deducted from payslip.
const NSSF_TIER1_LIMIT = 6_000;
const NSSF_TIER2_LIMIT = 18_000;
const NSSF_RATE = 0.06;

export function computeNSSF(grossSalary) {
  const tier1 = Math.min(grossSalary, NSSF_TIER1_LIMIT) * NSSF_RATE;
  const tier2 = Math.max(0, Math.min(grossSalary, NSSF_TIER2_LIMIT) - NSSF_TIER1_LIMIT) * NSSF_RATE;
  return Math.round(tier1 + tier2);
}

// PAYE — KRA personal relief + tax bands 2024
// Monthly tax bands (annual ÷ 12)
const PAYE_BANDS = [
  [ 24_000, 0.10],
  [ 32_667, 0.25],
  [ 41_667, 0.30],
  [ 58_334, 0.325],
  [Infinity, 0.35],
];
const PERSONAL_RELIEF_MONTHLY = 2_400;

export function computePAYE(grossSalary, nhif, nssf) {
  // Taxable pay = gross - NSSF (NHIF not deducted from taxable pay since 2021)
  const taxablePay = Math.max(0, grossSalary - nssf);

  let tax = 0;
  let prev = 0;
  for (const [limit, rate] of PAYE_BANDS) {
    if (taxablePay <= prev) break;
    const slice = Math.min(taxablePay, limit) - prev;
    tax += slice * rate;
    prev = limit;
  }

  // Apply personal relief and NHIF relief (NHIF is a tax relief since 2022)
  const netTax = Math.max(0, tax - PERSONAL_RELIEF_MONTHLY - nhif);
  return Math.round(netTax);
}

export function computeDeductions(grossPay) {
  const nhif = computeNHIF(grossPay);
  const nssf = computeNSSF(grossPay);
  const paye = computePAYE(grossPay, nhif, nssf);
  return { nhif, nssf, paye };
}
