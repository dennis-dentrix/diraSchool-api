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
  ROLES,
  SUBSCRIPTION_STATUSES,
} from '../../constants/index.js';
import { logAction } from '../../utils/auditLogger.js';
import { initializeTransaction, verifyTransaction } from './paystack.service.js';
import { sendSubscriptionConfirmationEmail } from '../../services/email.service.js';
import logger from '../../config/logger.js';
import {
  calculateSubscriptionAmount,
  DEFAULT_VAT_RATE,
  pricingAgreementSnapshot,
  resolvePricingTermsForSchool,
} from './pricing.js';

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

const buildInvoiceSnapshot = (payment, school) => {
  const pricing = payment.pricingAgreementSnapshot || {
    source: payment.pricingSource || 'standard',
  };

  const isSmsCredits = payment.paymentType === 'sms_credits';

  return {
    invoiceNumber: `INV-${String(payment._id).slice(-8).toUpperCase()}`,
    issuedAt: payment.paidAt || new Date(),
    paidAt: payment.paidAt || null,
    school: {
      id: school._id,
      name: school.name,
      email: school.email,
      phone: school.phone,
      address: school.address || null,
      county: school.county || null,
      registrationNumber: school.registrationNumber || null,
      groupId: school.groupId || null,
    },
    billingCycle: payment.billingCycle,
    studentCount: isSmsCredits ? null : payment.studentCount,
    subtotalExVat: payment.subtotalExVat,
    vatAmount: payment.vatAmount,
    vatRate: payment.vatRate ?? DEFAULT_VAT_RATE,
    total: payment.amount,
    currency: payment.currency || 'KES',
    merchantReference: payment.merchantReference,
    description: payment.description,
    paymentType: payment.paymentType || 'subscription',
    metadata: payment.metadata || {},
    pricing,
    payment: {
      provider: 'paystack',
      status: payment.status,
      reference: payment.merchantReference,
    },
  };
};

async function countBillableStudents(school) {
  if (school.groupId) {
    const groupSchools = await School.find({ groupId: school.groupId }).select('_id');
    const groupSchoolIds = groupSchools.map((s) => s._id);
    return Student.countDocuments({ schoolId: { $in: groupSchoolIds }, status: 'active' });
  }
  return Student.countDocuments({ schoolId: school._id, status: 'active' });
}

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

  const pricingTerms = await resolvePricingTermsForSchool(school);
  const pricingSnapshot = pricingAgreementSnapshot(pricingTerms);
  const amounts = calculateSubscriptionAmount({ studentCount, billingCycle, terms: pricingTerms });
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
    vatRate: amounts.vatRate,
    currency: amounts.currency,
    selectedPlanTier: planTier || school.planTier || PLAN_TIERS.STANDARD,
    pricingSource: pricingTerms.source,
    pricingAgreementSnapshot: pricingSnapshot,
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
        pricingSource: pricingTerms.source,
        agreementReference: pricingTerms.agreementReference || undefined,
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
 * GET /api/v1/subscriptions/pricing
 * Returns the authenticated school's effective subscription pricing.
 */
export const getSubscriptionPricing = asyncHandler(async (req, res) => {
  const school = await School.findById(req.user.schoolId);
  if (!school) return sendError(res, 'School not found.', 404);

  const billingCycle = ['per-term', 'annual', 'multi-year'].includes(req.query.billingCycle)
    ? req.query.billingCycle
    : 'per-term';

  let studentCount = parseInt(req.query.studentCount, 10);
  if (!studentCount || studentCount < 1 || school.groupId) {
    studentCount = await countBillableStudents(school);
  }
  studentCount = Math.max(studentCount || 1, 1);

  const terms = await resolvePricingTermsForSchool(school);
  const quote = calculateSubscriptionAmount({ studentCount, billingCycle, terms });

  return sendSuccess(res, {
    billingCycle,
    studentCount,
    terms,
    quote,
  });
});

/**
 * GET /api/v1/subscriptions/paystack/status/:merchantReference
 * Verifies the transaction with Paystack and syncs the payment record.
 */
export const getPaystackStatus = asyncHandler(async (req, res) => {
  const paymentFilter = req.user.role === ROLES.SUPERADMIN
    ? { merchantReference: req.params.merchantReference }
    : {
      schoolId: req.user.schoolId,
      merchantReference: req.params.merchantReference,
    };
  const payment = await SubscriptionPayment.findOne(paymentFilter);
  if (!payment) return sendError(res, 'Subscription payment not found.', 404);

  if (payment.status !== 'completed') {
    try {
      const result = await verifyTransaction(payment.merchantReference);
      payment.paystackRawResponse = result;

      const paystackStatus = result?.status;
      if (paystackStatus === 'success') {
        if (payment.paymentType === 'sms_credits') {
          if (!payment.paidAt) payment.paidAt = new Date();
          await payment.save();
          await handleSmsCreditTopUp({
            reference: payment.merchantReference,
            meta: payment.metadata ?? result?.metadata ?? {},
            data: result,
          });
        } else {
          payment.status = 'completed';
          if (!payment.paidAt) payment.paidAt = new Date();
          await payment.save();
          await activateSchool(payment);
        }
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

  const school = await School.findById(
    req.user.role === ROLES.SUPERADMIN ? payment.schoolId : req.user.schoolId
  ).select(
    'subscriptionStatus planTier trialExpiry name email phone address county registrationNumber'
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
    await handleSmsCreditTopUp({ reference, meta, data });
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

async function handleSmsCreditTopUp({ reference, meta, data }) {
  const { schoolId, credits, packId } = meta;
  if (!schoolId || !credits) return;
  try {
    const payment = await SubscriptionPayment.findOne({ merchantReference: reference });
    if (payment?.status === 'completed') {
      logger.info('[SMS-CREDITS] Duplicate completed top-up skipped', { schoolId, packId, credits, reference });
      return;
    }

    const school = await School.findByIdAndUpdate(schoolId, {
      $inc: {
        'smsCredits.purchasedRemaining': Number(credits),
        'smsCredits.totalPurchased':     Number(credits),
      },
    }, { new: true });

    if (payment) {
      payment.status = 'completed';
      if (!payment.paidAt) payment.paidAt = new Date();
      payment.paystackRawResponse = data ?? payment.paystackRawResponse;
      payment.metadata = { ...(payment.metadata ?? {}), ...meta };
      if (school && !payment.invoiceSnapshot) {
        payment.invoiceSnapshot = buildInvoiceSnapshot(payment, school);
      }
      await payment.save();
    }

    logger.info('[SMS-CREDITS] Top-up applied', { schoolId, packId, credits, reference });
  } catch (err) {
    logger.error('[SMS-CREDITS] Failed to apply top-up', { schoolId, reference, err: err.message });
  }
}
