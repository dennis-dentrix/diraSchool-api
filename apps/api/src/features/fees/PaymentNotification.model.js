import mongoose from 'mongoose';
import { PAYMENT_SMS_PROVIDERS } from '../../constants/index.js';

const paymentNotificationSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: Object.values(PAYMENT_SMS_PROVIDERS),
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['matched', 'unmatched', 'duplicate', 'parse_failed', 'ambiguous'],
      required: true,
      index: true,
    },
    messageId: {
      type: String,
      trim: true,
    },
    from: {
      type: String,
      trim: true,
    },
    to: {
      type: String,
      trim: true,
    },
    rawText: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      min: 0,
    },
    senderPhone: {
      type: String,
      trim: true,
    },
    payerName: {
      type: String,
      trim: true,
    },
    transactionId: {
      type: String,
      trim: true,
      uppercase: true,
    },
    accountReference: {
      type: String,
      trim: true,
      uppercase: true,
    },
    matchedStudentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
    },
    reason: {
      type: String,
      trim: true,
    },
    parsedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

paymentNotificationSchema.index(
  { schoolId: 1, provider: 1, transactionId: 1 },
  {
    unique: true,
    partialFilterExpression: { transactionId: { $type: 'string' } },
  }
);

export default mongoose.models.PaymentNotification ||
  mongoose.model('PaymentNotification', paymentNotificationSchema);
