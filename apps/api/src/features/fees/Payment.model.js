import mongoose from 'mongoose';
import { PAYMENT_METHODS, PAYMENT_STATUSES, TERMS } from '../../constants/index.js';

const paymentSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
      index: true,
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      match: [/^\d{4}$/, 'Academic year must be a 4-digit year'],
    },
    term: {
      type: String,
      enum: TERMS,
      required: [true, 'Term is required'],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [1, 'Payment amount must be at least 1'],
    },
    method: {
      type: String,
      enum: Object.values(PAYMENT_METHODS),
      required: [true, 'Payment method is required'],
    },
    // Receipt number, M-Pesa transaction code, bank slip number, etc.
    reference: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUSES),
      default: PAYMENT_STATUSES.COMPLETED,
    },
    // Staff member who recorded the payment
    recordedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    // Populated when status = reversed
    reversalReason: {
      type: String,
      trim: true,
    },
    reversedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reversedAt: {
      type: Date,
    },
    // Actual date the payment was made (may differ from createdAt if recorded later)
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    // Cloudinary URL of the generated PDF receipt (populated asynchronously by receipt worker)
    receiptUrl: {
      type: String,
    },
    // Auto-generated sequential receipt tracking number per school (e.g. RCT-2025-00001)
    receiptNumber: {
      type: String,
      trim: true,
      index: true,
    },
    // Staff member who issued the printed receipt (secretary/accountant only)
    receiptIssuedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    receiptIssuedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Composite index for fetching a student's payments in a given term
paymentSchema.index({ schoolId: 1, studentId: 1, academicYear: 1, term: 1 });

// Auto-assign a sequential receipt number before first save
paymentSchema.pre('save', async function (next) {
  if (this.isNew && !this.receiptNumber) {
    try {
      const count = await mongoose.model('Payment').countDocuments({ schoolId: this.schoolId });
      const year = new Date().getFullYear();
      this.receiptNumber = `RCT-${year}-${String(count + 1).padStart(5, '0')}`;
    } catch {
      // Non-fatal — receipt number may be empty; payment still records
    }
  }
  next();
});

export default mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
