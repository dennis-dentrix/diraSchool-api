import crypto from 'node:crypto';
import School from '../schools/School.model.js';
import SubscriptionPayment from './SubscriptionPayment.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendError, sendSuccess } from '../../utils/response.js';
import { env } from '../../config/env.js';
import { getRedis } from '../../config/redis.js';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCES,
  FEATURE_ADDON_PRICING,
  FEATURE_ADDONS,
  PLAN_TIERS,
  SUBSCRIPTION_STATUSES,
} from '../../constants/index.js';
import { logAction } from '../../utils/auditLogger.js';
import { getPesapalTransactionStatus, submitPesapalOrder } from './pesapal.service.js';

const BASE_FEE = 8500;
const PER_STUDENT_RATE = 40;
const VAT_RATE = 0.16;
const MULTIPLIERS = {
  'per-term': 1,
  annual: 2.7,
  'multi-year': 2.55,
};

const toSafeString = (value) => (value === null || value === undefined ? '' : String(value));

const pick = (obj, keys, fallback = null) => {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return fallback;
};

const normalizeAddOns = (addOns = {}) => ({
  [FEATURE_ADDONS.LIBRARY]: Boolean(addOns?.[FEATURE_ADDONS.LIBRARY]),
  [FEATURE_ADDONS.TRANSPORT]: Boolean(addOns?.[FEATURE_ADDONS.TRANSPORT]),
  [FEATURE_ADDONS.SMS]: Boolean(addOns?.[FEATURE_ADDONS.SMS]),
});

const calcAmount = ({ studentCount, billingCycle, addOns }) => {
  const normalized = normalizeAddOns(addOns);
  const addOnsPerTerm = Object.entries(normalized).reduce(
    (sum, [key, enabled]) => (enabled ? sum + (FEATURE_ADDON_PRICING[key] ?? 0) : sum),
    0
  );
  const subtotal = BASE_FEE + studentCount * PER_STUDENT_RATE + addOnsPerTerm;
  const multiplier = MULTIPLIERS[billingCycle] ?? 1;
  const exVat = Math.round(subtotal * multiplier);
  const vat = Math.round(exVat * VAT_RATE);
  return {
    addOns: normalized,
    addOnsPerTerm,
    subtotalExVat: exVat,
    vatAmount: vat,
    total: exVat + vat,
  };
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

const mapPaymentState = (statusPayload) => {
  const statusCode = pick(statusPayload, ['status_code', 'statusCode', 'payment_status_code'], '');
  const desc = toSafeString(
    pick(statusPayload, ['payment_status_description', 'payment_status', 'paymentStatusDescription', 'status'])
  ).toLowerCase();

  const paidStates = ['completed', 'paid', 'settled'];
  const pendingStates = ['pending', 'processing', 'in-progress', 'queued'];
  const failedStates = ['failed', 'cancelled', 'invalid', 'reversed'];

  if (String(statusCode) === '1' || paidStates.some((s) => desc.includes(s))) return 'completed';
  if (pendingStates.some((s) => desc.includes(s))) return 'processing';
  if (failedStates.some((s) => desc.includes(s))) return 'failed';
  return 'pending';
};

const syncPaymentStatus = async (payment) => {
  if (!payment?.orderTrackingId) return payment;

  const payload = await getPesapalTransactionStatus(payment.orderTrackingId);
  const nextStatus = mapPaymentState(payload);
  const confirmationCode = pick(payload, ['confirmation_code', 'confirmationCode', 'payment_reference']);
  const paymentStatus = pick(payload, [
    'payment_status_description',
    'payment_status',
    'paymentStatusDescription',
    'status',
  ]);
  const statusCode = pick(payload, ['status_code', 'statusCode', 'payment_status_code']);

  payment.status = nextStatus;
  payment.pesapalConfirmationCode = confirmationCode ?? payment.pesapalConfirmationCode;
  payment.pesapalPaymentStatus = paymentStatus ?? payment.pesapalPaymentStatus;
  payment.pesapalStatusCode = statusCode ?? payment.pesapalStatusCode;
  payment.pesapalRawResponse = payload;

  if (nextStatus === 'completed' && !payment.paidAt) {
    payment.paidAt = new Date();
  }
  await payment.save();

  if (nextStatus === 'completed') {
    const school = await School.findById(payment.schoolId);
    if (school) {
      school.subscriptionStatus = SUBSCRIPTION_STATUSES.ACTIVE;
      school.planTier = payment.selectedPlanTier || PLAN_TIERS.STANDARD;
      school.trialExpiry = undefined;
      await school.save();
      await bustSchoolSubCache(school._id);
    }
  }

  return payment;
};

/**
 * POST /api/v1/subscriptions/pesapal/checkout
 */
export const createPesapalCheckout = asyncHandler(async (req, res) => {
  if (!env.PESAPAL_ENABLED) {
    return sendError(res, 'Pesapal is not enabled in this environment.', 400);
  }

  const school = await School.findById(req.user.schoolId);
  if (!school) return sendError(res, 'School not found.', 404);

  const { studentCount, billingCycle, planTier, description, addOns } = req.body;
  const amounts = calcAmount({ studentCount, billingCycle, addOns });
  const reference = merchantRef(school._id);

  const callbackUrl = `${env.CLIENT_URL.replace(/\/+$/, '')}/billing?provider=pesapal`;
  const payment = await SubscriptionPayment.create({
    schoolId: school._id,
    initiatedByUserId: req.user._id,
    merchantReference: reference,
    status: 'pending',
    billingCycle,
    studentCount,
    addOns: amounts.addOns,
    addOnsPerTerm: amounts.addOnsPerTerm,
    amount: amounts.total,
    subtotalExVat: amounts.subtotalExVat,
    vatAmount: amounts.vatAmount,
    currency: env.PESAPAL_CURRENCY || 'KES',
    selectedPlanTier: planTier || school.planTier || PLAN_TIERS.STANDARD,
    description: description || `DiraSchool subscription (${billingCycle})`,
  });

  try {
    const orderPayload = {
      id: reference,
      currency: payment.currency,
      amount: payment.amount,
      description: payment.description,
      callback_url: callbackUrl,
      notification_id: env.PESAPAL_NOTIFICATION_ID,
      billing_address: {
        email_address: school.email,
        phone_number: school.phone,
        country_code: 'KE',
        first_name: req.user.firstName || 'School',
        last_name: req.user.lastName || 'Admin',
        line_1: school.address || school.name,
      },
    };

    const result = await submitPesapalOrder(orderPayload);
    payment.orderTrackingId = pick(result, ['order_tracking_id', 'orderTrackingId']);
    payment.checkoutUrl = pick(result, ['redirect_url', 'redirectUrl']);
    payment.status = payment.orderTrackingId ? 'processing' : 'pending';
    payment.pesapalRawResponse = result;
    await payment.save();

    logAction(req, {
      action: AUDIT_ACTIONS.CREATE,
      resource: AUDIT_RESOURCES.PAYMENT,
      resourceId: payment._id,
      meta: {
        provider: 'pesapal',
        merchantReference: payment.merchantReference,
        orderTrackingId: payment.orderTrackingId ?? null,
        amount: payment.amount,
        addOns: payment.addOns,
        addOnsPerTerm: payment.addOnsPerTerm,
      },
    });

    return sendSuccess(res, {
      checkout: {
        provider: 'pesapal',
        merchantReference: payment.merchantReference,
        orderTrackingId: payment.orderTrackingId,
        amount: payment.amount,
        currency: payment.currency,
        addOns: payment.addOns,
        addOnsPerTerm: payment.addOnsPerTerm,
        redirectUrl: payment.checkoutUrl,
      },
    });
  } catch (err) {
    payment.status = 'failed';
    payment.pesapalRawResponse = { error: err.message, payload: err.payload ?? null };
    await payment.save();
    return sendError(res, `Unable to initialize Pesapal checkout: ${err.message}`, 502);
  }
});

/**
 * GET /api/v1/subscriptions/pesapal/status/:merchantReference
 */
export const getPesapalCheckoutStatus = asyncHandler(async (req, res) => {
  const payment = await SubscriptionPayment.findOne({
    schoolId: req.user.schoolId,
    merchantReference: req.params.merchantReference,
  });
  if (!payment) return sendError(res, 'Subscription payment not found.', 404);

  if (payment.orderTrackingId && payment.status !== 'completed') {
    await syncPaymentStatus(payment);
  }

  const school = await School.findById(req.user.schoolId).select(
    'subscriptionStatus planTier trialExpiry name'
  );

  return sendSuccess(res, {
    payment: {
      _id: payment._id,
      merchantReference: payment.merchantReference,
      orderTrackingId: payment.orderTrackingId,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      billingCycle: payment.billingCycle,
      studentCount: payment.studentCount,
      addOns: payment.addOns,
      addOnsPerTerm: payment.addOnsPerTerm,
      checkoutUrl: payment.checkoutUrl,
      paidAt: payment.paidAt,
      pesapalStatusCode: payment.pesapalStatusCode,
      pesapalPaymentStatus: payment.pesapalPaymentStatus,
      pesapalConfirmationCode: payment.pesapalConfirmationCode,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    },
    school,
  });
});

/**
 * GET|POST /api/v1/subscriptions/pesapal/ipn
 */
export const pesapalIpnCallback = asyncHandler(async (req, res) => {
  const params = { ...(req.query || {}), ...(req.body || {}) };
  const merchantReference = pick(params, [
    'OrderMerchantReference',
    'orderMerchantReference',
    'order_merchant_reference',
  ]);
  const orderTrackingId = pick(params, ['OrderTrackingId', 'orderTrackingId', 'order_tracking_id']);
  const notificationType = pick(params, [
    'OrderNotificationType',
    'orderNotificationType',
    'order_notification_type',
  ]);

  if (!merchantReference && !orderTrackingId) {
    return sendError(res, 'Missing Pesapal identifiers in callback payload.', 400);
  }

  const payment = await SubscriptionPayment.findOne({
    $or: [
      ...(merchantReference ? [{ merchantReference }] : []),
      ...(orderTrackingId ? [{ orderTrackingId }] : []),
    ],
  });

  if (!payment) {
    return res.status(200).json({
      orderNotificationType: notificationType || 'IPNCHANGE',
      orderTrackingId: orderTrackingId || null,
      orderMerchantReference: merchantReference || null,
      status: 200,
    });
  }

  if (!payment.orderTrackingId && orderTrackingId) {
    payment.orderTrackingId = orderTrackingId;
    await payment.save();
  }

  await syncPaymentStatus(payment);

  return res.status(200).json({
    orderNotificationType: notificationType || 'IPNCHANGE',
    orderTrackingId: payment.orderTrackingId || null,
    orderMerchantReference: payment.merchantReference,
    status: 200,
  });
});
