import { z } from 'zod';
import { sendSuccess, sendError } from '../../utils/response.js';

const BASE_FEE = 7500;
const PER_STUDENT_RATE = 40;
const VAT_RATE = 0.16;
const SCHOOL_FEE_ASSUMPTION = 10000; // KES per student per term (for % calc)

const MULTIPLIERS = {
  'per-term': 1,
  'annual': 2.98,       // 3 terms − 15% discount
  'multi-year': 2.4,    // 3 terms − 20% discount per year
};

const schema = z.object({
  students: z.coerce.number().int().min(1).max(10000),
  option: z.enum(['per-term', 'annual', 'multi-year']).default('per-term'),
  includeVAT: z.coerce.boolean().default(true),
});

/**
 * GET /api/v1/pricing/calculate
 * Public endpoint — no auth required.
 *
 * Query params:
 *   students    int 1–10000   required
 *   option      per-term|annual|multi-year   default: per-term
 *   includeVAT  boolean   default: true
 */
export const calculatePrice = (req, res) => {
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, parsed.error.errors[0].message, 400);
  }

  const { students, option, includeVAT } = parsed.data;
  const multiplier = MULTIPLIERS[option];

  const subtotalExVAT = BASE_FEE + students * PER_STUDENT_RATE;
  const periodSubtotal = subtotalExVAT * multiplier;
  const vatAmount = Math.round(periodSubtotal * VAT_RATE);
  const totalIncVAT = periodSubtotal + vatAmount;

  const costPerStudentPerTerm = subtotalExVAT / students;
  const pctOfFeeIncome = (subtotalExVAT / (students * SCHOOL_FEE_ASSUMPTION)) * 100;

  // For annual/multi-year, also return the effective per-term equivalent
  const effectivePerTerm = option !== 'per-term' ? totalIncVAT / 3 : null;

  return sendSuccess(res, {
    inputs: { students, option, baseFee: BASE_FEE, perStudentRate: PER_STUDENT_RATE, vatRate: VAT_RATE },
    breakdown: {
      baseFee: BASE_FEE,
      perStudentCost: students * PER_STUDENT_RATE,
      subtotalExVAT: Math.round(subtotalExVAT),
      multiplier,
      periodSubtotalExVAT: Math.round(periodSubtotal),
      vatAmount,
      totalIncVAT: Math.round(totalIncVAT),
    },
    insights: {
      costPerStudentPerTerm: Math.round(costPerStudentPerTerm * 100) / 100,
      pctOfFeeIncome: Math.round(pctOfFeeIncome * 100) / 100,
      ...(effectivePerTerm ? { effectivePerTermIncVAT: Math.round(effectivePerTerm) } : {}),
    },
  });
};
