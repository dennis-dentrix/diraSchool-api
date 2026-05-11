import mongoose from 'mongoose';

const pricingAgreementSchema = new mongoose.Schema(
  {
    enabled: {
      type: Boolean,
      default: false,
    },
    baseFee: {
      type: Number,
      min: 0,
    },
    perStudentRate: {
      type: Number,
      min: 0,
    },
    currency: {
      type: String,
      default: 'KES',
      uppercase: true,
      trim: true,
    },
    agreementReference: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    startsAt: Date,
    expiresAt: Date,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedAt: Date,
  },
  { _id: false }
);

const schoolGroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Group name is required'],
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    contactPerson: {
      type: String,
      trim: true,
    },
    contactEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    // Optional negotiated pricing applied to every school in this billing group
    // unless a school has its own active pricingAgreement override.
    pricingAgreement: {
      type: pricingAgreementSchema,
      default: () => ({ enabled: false, currency: 'KES' }),
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

export default mongoose.models.SchoolGroup || mongoose.model('SchoolGroup', schoolGroupSchema);
