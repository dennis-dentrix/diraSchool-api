import mongoose from 'mongoose';

const emailEventSchema = new mongoose.Schema(
  {
    to: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    template: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ['zeptomail', 'resend'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['sent', 'failed', 'delivered', 'queued'],
      required: true,
      default: 'queued',
      index: true,
    },
    providerStatus: {
      type: String,
      trim: true,
    },
    providerMessageId: {
      type: String,
      trim: true,
      index: true,
    },
    accepted: {
      type: [String],
      default: [],
    },
    rejected: {
      type: [String],
      default: [],
    },
    errorMessage: {
      type: String,
      trim: true,
    },
    errorCode: {
      type: String,
      trim: true,
    },
    fallbackUsed: {
      type: Boolean,
      default: false,
    },
    attemptOrder: {
      type: Number,
      default: 1,
    },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    deliveredAt: {
      type: Date,
    },
    lastCheckedAt: {
      type: Date,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

emailEventSchema.index({ schoolId: 1, createdAt: -1 });
emailEventSchema.index({ to: 1, template: 1, createdAt: -1 });

export default mongoose.models.EmailEvent || mongoose.model('EmailEvent', emailEventSchema);
