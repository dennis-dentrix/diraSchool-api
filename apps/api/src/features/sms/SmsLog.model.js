import mongoose from 'mongoose';
import { SMS_TRIGGER_TYPES } from '../../constants/index.js';

const SmsLogSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true,
    },
    trigger: {
      type: String,
      enum: Object.values(SMS_TRIGGER_TYPES),
      required: true,
    },
    target: {
      type: String,
      enum: ['single', 'class_parents', 'all_parents', 'all_staff'],
      required: true,
    },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    message: { type: String, required: true, maxlength: 480 },
    recipientCount: { type: Number, default: 0 },
    sentByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['queued', 'sent', 'partial', 'failed'],
      default: 'queued',
    },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model('SmsLog', SmsLogSchema);
