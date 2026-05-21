import mongoose from 'mongoose';

const systemEventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    type: {
      type: String,
      enum: ['maintenance', 'update', 'announcement', 'outage', 'other'],
      default: 'announcement',
    },
    scheduledAt: { type: Date, default: null },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    broadcastEmail: { type: Boolean, default: false },
    broadcastNotification: { type: Boolean, default: false },
    broadcastAt: { type: Date, default: null },
    recipientCount: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.models.SystemEvent ||
  mongoose.model('SystemEvent', systemEventSchema);
