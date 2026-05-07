import mongoose from 'mongoose';
import { SMS_DELIVERY_STATUS, SMS_CREDIT_TYPE, SMS_TRIGGER_TYPES, TERMS } from '../../constants/index.js';

const SmsDeliverySchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true,
    },
    smsLogId: {
      type: mongoose.Schema.Types.ObjectId, ref: 'SmsLog', required: true,
    },
    phone: {
      type: String, required: true,
    },
    // AT message ID returned after a successful send — used to match DLR callbacks
    messageId: {
      type: String, index: true, sparse: true,
    },
    trigger: {
      type: String, enum: Object.values(SMS_TRIGGER_TYPES),
    },
    term: {
      type: String, enum: TERMS,
    },
    academicYear: {
      type: String,
    },
    creditType: {
      type: String,
      enum: Object.values(SMS_CREDIT_TYPE),
      default: SMS_CREDIT_TYPE.INCLUDED,
    },
    deliveryStatus: {
      type: String,
      enum: Object.values(SMS_DELIVERY_STATUS),
      default: SMS_DELIVERY_STATUS.QUEUED,
    },
    failureReason: {
      type: String,
    },
  },
  { timestamps: true }
);

// Per-parent cap check: count per phone per school per term
SmsDeliverySchema.index({ schoolId: 1, phone: 1, term: 1, academicYear: 1 });
// Admin analytics: aggregate by school
SmsDeliverySchema.index({ schoolId: 1, term: 1, academicYear: 1, deliveryStatus: 1 });

export default mongoose.model('SmsDelivery', SmsDeliverySchema);
