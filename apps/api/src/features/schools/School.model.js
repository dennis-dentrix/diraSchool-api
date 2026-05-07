import mongoose from 'mongoose';
import { SUBSCRIPTION_STATUSES, PLAN_TIERS, PAYMENT_SMS_PROVIDERS } from '../../constants/index.js';

const schoolSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'School name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'School email is required'],
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'School phone is required'],
      trim: true,
    },
    county: {
      type: String,
      trim: true,
    },
    constituency: {
      type: String,
      trim: true,
    },
    // Kenya Ministry of Education registration number
    registrationNumber: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    subscriptionStatus: {
      type: String,
      enum: Object.values(SUBSCRIPTION_STATUSES),
      default: SUBSCRIPTION_STATUSES.TRIAL,
    },
    trialExpiry: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
    // Subscription plan tier — controls which features are available.
    // Updated by superadmin when a school upgrades / downgrades.
    planTier: {
      type: String,
      enum: Object.values(PLAN_TIERS),
      default: PLAN_TIERS.TRIAL,
    },
    // Hard disable by superadmin — overrides subscription status
    isActive: {
      type: Boolean,
      default: true,
    },
    // Optional billing group — when set, this school shares a subscription with others in the group
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SchoolGroup',
      default: null,
    },
    // M-Pesa till/paybill number that receives parent payments.
    // Africa's Talking monitors SMS to this number and forwards to the inbound webhook.
    mpesaTillNumber: {
      type: String,
      trim: true,
    },
    // Direct Daraja C2B callback configuration. Money still goes directly to the
    // school's own Paybill; Diraschool only receives reconciliation callbacks.
    mpesa: {
      paybill: {
        type: String,
        trim: true,
      },
      authorized: {
        type: Boolean,
        default: false,
      },
      authorizedAt: Date,
      authorizationLetterUrl: {
        type: String,
        trim: true,
      },
      c2bRegistered: {
        type: Boolean,
        default: false,
      },
      c2bRegisteredAt: Date,
      active: {
        type: Boolean,
        default: false,
      },
      lastRegistrationResponse: {
        type: mongoose.Schema.Types.Mixed,
      },
    },
    // Interim payment automation: SMS notifications forwarded from the school
    // payment phone are parsed into fee payments when they match one student.
    paymentSmsSettings: {
      enabled: {
        type: Boolean,
        default: false,
      },
      provider: {
        type: String,
        enum: Object.values(PAYMENT_SMS_PROVIDERS),
        default: PAYMENT_SMS_PROVIDERS.MPESA,
      },
      phoneNumber: {
        type: String,
        trim: true,
      },
      bankName: {
        type: String,
        trim: true,
      },
    },
    // SMS credit balance — included credits are derived from the cap rule (5/parent/term).
    // Purchased credits let schools send beyond that cap; deducted atomically per send.
    smsCredits: {
      purchasedRemaining: { type: Number, default: 0, min: 0 },
      totalPurchased:     { type: Number, default: 0, min: 0 },
    },
    // SMS Settings — per-school sender ID management
    smsSettings: {
      senderIdRequested: {
        type: String,
        trim: true,
        uppercase: true,
        match: [/^[A-Z0-9_]{1,11}$/, 'Sender ID must be 1-11 alphanumeric chars'],
      },
      senderIdApproved: {
        type: String,
        trim: true,
        uppercase: true,
      },
      senderIdStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: null,
      },
      smsEnabled: {
        type: Boolean,
        default: false,
      },
      requestedAt: Date,
      approvedAt: Date,
      rejectionReason: String,
    },
  },
  { timestamps: true }
);

schoolSchema.index({ email: 1 }, { unique: true });
schoolSchema.index({ 'mpesa.paybill': 1 }, { sparse: true });
schoolSchema.index({ 'mpesa.paybill': 1, 'mpesa.active': 1 });

export default mongoose.models.School || mongoose.model('School', schoolSchema);
