import mongoose from 'mongoose';

const platformExpenseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    category: {
      type: String,
      enum: [
        'hosting',
        'sms',
        'email',
        'storage',
        'software',
        'payroll',
        'marketing',
        'tax',
        'office',
        'professional_services',
        'other',
      ],
      default: 'other',
      index: true,
    },
    vendor: {
      type: String,
      trim: true,
      maxlength: 160,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    vatAmount: {
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
    paymentDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'cancelled'],
      default: 'paid',
      index: true,
    },
    paymentMethod: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    reference: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    receiptUrl: {
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

platformExpenseSchema.index({ paymentDate: -1, createdAt: -1 });

export default mongoose.models.PlatformExpense
  || mongoose.model('PlatformExpense', platformExpenseSchema);
