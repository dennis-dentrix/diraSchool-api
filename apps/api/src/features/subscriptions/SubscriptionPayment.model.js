import mongoose from 'mongoose';
import { PLAN_TIERS } from '../../constants/index.js';

const subscriptionPaymentSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },
    initiatedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    merchantReference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    paymentType: {
      type: String,
      enum: ['subscription', 'sms_credits'],
      default: 'subscription',
      index: true,
    },
    billingCycle: {
      type: String,
      enum: ['per-term', 'annual', 'multi-year'],
      default: 'per-term',
    },
    currency: {
      type: String,
      default: 'KES',
      uppercase: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    studentCount: {
      type: Number,
      required: true,
      min: 1,
    },
    subtotalExVat: {
      type: Number,
      required: true,
      min: 0,
    },
    vatAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    vatRate: {
      type: Number,
      default: 0.16,
      min: 0,
    },
    selectedPlanTier: {
      type: String,
      enum: Object.values(PLAN_TIERS),
      default: PLAN_TIERS.STANDARD,
    },
    pricingSource: {
      type: String,
      enum: ['standard', 'school', 'group'],
      default: 'standard',
      index: true,
    },
    pricingAgreementSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 240,
    },
    checkoutUrl: {
      type: String,
      trim: true,
    },
    paidAt: Date,
    paystackRawResponse: {
      type: mongoose.Schema.Types.Mixed,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Frozen copy of the invoice data captured at time of payment confirmation.
    // This ensures the invoice is immutable even if pricing logic or school details change later.
    invoiceSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

subscriptionPaymentSchema.index({ schoolId: 1, createdAt: -1 });

export default mongoose.models.SubscriptionPayment
  || mongoose.model('SubscriptionPayment', subscriptionPaymentSchema);
