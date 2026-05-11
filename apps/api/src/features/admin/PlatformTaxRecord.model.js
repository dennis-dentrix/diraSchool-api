import mongoose from 'mongoose';

export const PLATFORM_TAX_TYPES = [
  'vat',
  'corporation_tax',
  'installment_tax',
  'paye',
  'withholding_tax',
  'withholding_vat',
  'affordable_housing_levy',
  'nssf',
  'shif',
  'fringe_benefit_tax',
  'advance_tax',
  'excise_duty',
  'digital_service_tax',
  'other',
];

const platformTaxRecordSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    taxType: {
      type: String,
      enum: PLATFORM_TAX_TYPES,
      required: true,
      index: true,
    },
    treatment: {
      type: String,
      enum: ['payable', 'credit'],
      default: 'payable',
      index: true,
    },
    periodStart: {
      type: Date,
      index: true,
    },
    periodEnd: {
      type: Date,
      index: true,
    },
    dueDate: {
      type: Date,
      index: true,
    },
    amountDue: {
      type: Number,
      required: true,
      min: 0,
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: 'KES',
      uppercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'overdue', 'cancelled'],
      default: 'pending',
      index: true,
    },
    paymentDate: {
      type: Date,
    },
    reference: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    attachmentUrl: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    recordedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

platformTaxRecordSchema.index({ dueDate: 1, taxType: 1 });
platformTaxRecordSchema.index({ periodStart: 1, periodEnd: 1 });

export default mongoose.models.PlatformTaxRecord
  || mongoose.model('PlatformTaxRecord', platformTaxRecordSchema);
