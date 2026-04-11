import mongoose from 'mongoose';
import { SUBSCRIPTION_STATUSES, PLAN_TIERS } from '../../constants/index.js';

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
  },
  { timestamps: true }
);

schoolSchema.index({ email: 1 }, { unique: true });

export default mongoose.models.School || mongoose.model('School', schoolSchema);
