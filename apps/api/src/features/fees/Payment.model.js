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
    // Cloudinary URL of the generated PDF receipt (populated asynchronously by receipt worker)
    receiptUrl: {
      type: String,
    },
  },
  { timestamps: true }
);

// Composite index for fetching a student's payments in a given term
paymentSchema.index({ schoolId: 1, studentId: 1, academicYear: 1, term: 1 });

export default mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
