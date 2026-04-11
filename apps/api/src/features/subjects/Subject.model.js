import mongoose from 'mongoose';

const subjectSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Subject name is required'],
      trim: true,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
    },
    // Teacher assigned to deliver this subject (optional — may differ from class teacher)
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Prevent duplicate subject names in the same class.
subjectSchema.index({ schoolId: 1, classId: 1, name: 1 }, { unique: true });

export default mongoose.models.Subject || mongoose.model('Subject', subjectSchema);
