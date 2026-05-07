import crypto from 'node:crypto';
import School from '../schools/School.model.js';
import Student from '../students/Student.model.js';
import SubscriptionPayment from './SubscriptionPayment.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendError, sendSuccess } from '../../utils/response.js';
import { env } from '../../config/env.js';
import { getRedis } from '../../config/redis.js';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCES,
  PLAN_TIERS,
  SUBSCRIPTION_STATUSES,
} from '../../constants/index.js';
import { logAction } from '../../utils/auditLogger.js';
import { initializeTransaction, verifyTransaction } from './paystack.service.js';
import { sendSubscriptionConfirmationEmail } from '../../services/email.service.js';
import logger from '../../config/logger.js';

const BASE_FEE = 12000;
const PER_STUDENT_RATE = 50;
const VAT_RATE = 0.16;
const MULTIPLIERS = {
  'per-term': 1,
  annual: 2.70,      // 3 terms × 0.90 = 10% off
  'multi-year': 2.55, // 3 terms × 0.85 = 15% off per year
};

const calcAmount = ({ studentCount, billingCycle }) => {
  const subtotal = BASE_FEE + studentCount * PER_STUDENT_RATE;
  const multiplier = MULTIPLIERS[billingCycle] ?? 1;
  const exVat = Math.round(subtotal * multiplier);
  const vat = Math.round(exVat * VAT_RATE);
  return { subtotalExVat: exVat, vatAmount: vat, total: exVat + vat };
};

const merchantRef = (schoolId) =>
  `DS-${schoolId.toString().slice(-6).toUpperCase()}-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

const bustSchoolSubCache = async (schoolId) => {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(`school:sub:${schoolId}`);
  } catch {
    // non-fatal
  }
};

const buildInvoiceSnapshot = (payment, school) => ({
  invoiceNumber: `INV-${String(payment._id).slice(-8).toUpperCase()}`,
  issuedAt: payment.paidAt || new Date(),
  school: {
    name: school.name,
    email: school.email,
    phone: school.phone,
    address: school.address || null,
    county: school.county || null,
    registrationNumber: school.registrationNumber || null,
  },
  billingCycle: payment.billingCycle,
  studentCount: payment.studentCount,
  subtotalExVat: payment.subtotalExVat,
  vatAmount: payment.vatAmount,
  total: payment.amount,
  currency: payment.currency || 'KES',
  merchantReference: payment.merchantReference,
  description: payment.description,
});

const activateSchool = async (payment) => {
  const school = await School.findById(payment.schoolId);
  if (!school) return;

  const planTier = payment.selectedPlanTier || PLAN_TIERS.STANDARD;
  school.subscriptionStatus = SUBSCRIPTION_STATUSES.ACTIVE;
  school.planTier = planTier;
  school.trialExpiry = undefined;
  await school.save();
  await bustSchoolSubCache(school._id);

  // Freeze a copy of the invoice at confirmation time
  if (!payment.invoiceSnapshot) {
    payment.invoiceSnapshot = buildInvoiceSnapshot(payment, school);
    await payment.save();
  }

  // If this school is part of a billing group, activate all sibling schools too
  if (school.groupId) {
    const siblings = await School.find({ groupId: school.groupId, _id: { $ne: school._id } });
    await Promise.all(
      siblings.map(async (s) => {
        s.subscriptionStatus = SUBSCRIPTION_STATUSES.ACTIVE;
        s.planTier = planTier;
        s.trialExpiry = undefined;
        await s.save();
        await bustSchoolSubCache(s._id);
      })
    );
  }

  sendSubscriptionConfirmationEmail({
    to: school.email,
    schoolName: school.name,
    amount: payment.amount,
    currency: payment.currency || 'KES',
    billingCycle: payment.billingCycle,
    studentCount: payment.studentCount,
    merchantReference: payment.merchantReference,
    paidAt: payment.paidAt || new Date(),
    meta: { schoolId: school._id },
  }).catch(() => {}); // fire-and-forget, non-fatal
};

/**
 * POST /api/v1/subscriptions/paystack/checkout
 */
export const createPaystackCheckout = asyncHandler(async (req, res) => {
  if (!env.PAYSTACK_ENABLED) {
    return sendError(res, 'Paystack is not enabled in this environment.', 400);
  }

  const school = await School.findById(req.user.schoolId);
  if (!school) return sendError(res, 'School not found.', 404);

  const { billingCycle, planTier, description } = req.body;
  let { studentCount } = req.body;

  // If the school is part of a billing group, aggregate active students across all branches
  if (school.groupId) {
    const groupSchools = await School.find({ groupId: school.groupId }).select('_id');
    const groupSchoolIds = groupSchools.map((s) => s._id);
    studentCount = await Student.countDocuments({ schoolId: { $in: groupSchoolIds }, status: 'active' });
  }

  const amounts = calcAmount({ studentCount, billingCycle });
  const reference = merchantRef(school._id);

  const callbackUrl = `${env.CLIENT_URL.replace(/\/+$/, '')}/billing?reference=${reference}`;

  const payment = await SubscriptionPayment.create({
    schoolId: school._id,
    initiatedByUserId: req.user._id,
    merchantReference: reference,
    status: 'pending',
    billingCycle,
    studentCount,
    amount: amounts.total,
    subtotalExVat: amounts.subtotalExVat,
    vatAmount: amounts.vatAmount,
    currency: 'KES',
    selectedPlanTier: planTier || school.planTier || PLAN_TIERS.STANDARD,
    description: description || `DiraSchool subscription (${billingCycle})`,
  });

  try {
    const result = await initializeTransaction({
      email: school.email,
      amount: payment.amount,
      reference,
      callbackUrl,
      metadata: {
        schoolId: String(school._id),
        schoolName: school.name,
        billingCycle,
        studentCount,
      },
    });

    payment.checkoutUrl = result.authorization_url;
    payment.status = 'processing';
    payment.paystackRawResponse = result;
    await payment.save();

    logAction(req, {
      action: AUDIT_ACTIONS.CREATE,
      resource: AUDIT_RESOURCES.PAYMENT,
      resourceId: payment._id,
      meta: {
        provider: 'paystack',
        merchantReference: reference,
        amount: payment.amount,
      },
    });

    return sendSuccess(res, {
      checkout: {
        provider: 'paystack',
        merchantReference: reference,
        amount: payment.amount,
        currency: payment.currency,
        redirectUrl: result.authorization_url,
        accessCode: result.access_code,
      },
    });
  } catch (err) {
    payment.status = 'failed';
    payment.paystackRawResponse = { error: err.message, payload: err.payload ?? null };
    await payment.save();
    return sendError(res, `Unable to initialize Paystack checkout: ${err.message}`, 502);
  }
});

/**
 * GET /api/v1/subscriptions/paystack/status/:merchantReference
 * Verifies the transaction with Paystack and syncs the payment record.
 */
export const getPaystackStatus = asyncHandler(async (req, res) => {
  const payment = await SubscriptionPayment.findOne({
    schoolId: req.user.schoolId,
    merchantReference: req.params.merchantReference,
  });
  if (!payment) return sendError(res, 'Subscription payment not found.', 404);

  if (payment.status !== 'completed') {
    try {
      const result = await verifyTransaction(payment.merchantReference);
      payment.paystackRawResponse = result;

      const paystackStatus = result?.status;
      if (paystackStatus === 'success') {
        payment.status = 'completed';
        if (!payment.paidAt) payment.paidAt = new Date();
        await payment.save();
        await activateSchool(payment);
      } else if (['failed', 'abandoned'].includes(paystackStatus)) {
        payment.status = 'failed';
        await payment.save();
      } else {
        await payment.save();
      }
    } catch {
      // Paystack verify failed — return current DB state
    }
  }

  const school = await School.findById(req.user.schoolId).select(
    'subscriptionStatus planTier trialExpiry name'
  );

  return sendSuccess(res, {
    payment: {
      _id: payment._id,
      merchantReference: payment.merchantReference,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      billingCycle: payment.billingCycle,
      studentCount: payment.studentCount,
      subtotalExVat: payment.subtotalExVat,
      vatAmount: payment.vatAmount,
      checkoutUrl: payment.checkoutUrl,
      paidAt: payment.paidAt,
      invoiceSnapshot: payment.invoiceSnapshot ?? null,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    },
    school,
  });
});

/**
 * GET /api/v1/subscriptions/payments
 * Returns paginated subscription payment history for the school.
 */
export const listPayments = asyncHandler(async (req, res) => {
  const schoolId = req.user.schoolId;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const skip = (page - 1) * limit;

  const [payments, total] = await Promise.all([
    SubscriptionPayment.find({ schoolId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-paystackRawResponse')
      .populate('initiatedByUserId', 'firstName lastName'),
    SubscriptionPayment.countDocuments({ schoolId }),
  ]);

  return sendSuccess(res, {
    payments,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  });
});

/**
 * POST /api/v1/subscriptions/paystack/webhook
 * Public route — verified via HMAC-SHA512 signature.
 */
export const paystackWebhook = asyncHandler(async (req, res) => {
  // Verify signature
  const signature = req.headers['x-paystack-signature'];
  const hash = crypto
    .createHmac('sha512', env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (signature !== hash) {
    return res.status(401).end();
  }

  const { event, data } = req.body;

  // Acknowledge immediately — Paystack expects a 200 fast
  res.status(200).end();

  if (event !== 'charge.success') return;

  const reference = data?.reference;
  if (!reference) return;

  // SMS credit top-up — handled separately from subscription payments
  const meta = data?.metadata ?? {};
  if (meta.type === 'sms_credits') {
    await handleSmsCreditTopUp({ reference, meta });
    return;
  }

  const payment = await SubscriptionPayment.findOne({ merchantReference: reference });
  if (!payment || payment.status === 'completed') return;

  payment.status = 'completed';
  payment.paidAt = new Date();
  payment.paystackRawResponse = data;
  await payment.save();

  await activateSchool(payment);
});

async function handleSmsCreditTopUp({ reference, meta }) {
  const { schoolId, credits, packId } = meta;
  if (!schoolId || !credits) return;
  try {
    await School.findByIdAndUpdate(schoolId, {
      $inc: {
        'smsCredits.purchasedRemaining': Number(credits),
        'smsCredits.totalPurchased':     Number(credits),
      },
    });
    logger.info('[SMS-CREDITS] Top-up applied', { schoolId, packId, credits, reference });
  } catch (err) {
    logger.error('[SMS-CREDITS] Failed to apply top-up', { schoolId, reference, err: err.message });
  }
}
