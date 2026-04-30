import mongoose from 'mongoose';

const visitorSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },
    visitDate: {
      type: Date,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Visitor name is required'],
      trim: true,
    },
    reason: {
      type: String,
      required: [true, 'Reason for visit is required'],
      trim: true,
    },
    comment: {
      type: String,
      trim: true,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

visitorSchema.index({ schoolId: 1, visitDate: -1 });

export default mongoose.models.Visitor || mongoose.model('Visitor', visitorSchema);
