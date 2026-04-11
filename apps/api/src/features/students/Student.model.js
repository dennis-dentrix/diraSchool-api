import mongoose from 'mongoose';
import { STUDENT_STATUSES } from '../../constants/index.js';

const studentSchema = new mongoose.Schema(
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
    // Admission number must be unique within the school
    admissionNumber: {
      type: String,
      required: [true, 'Admission number is required'],
      trim: true,
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    gender: {
      type: String,
      enum: ['male', 'female'],
      required: [true, 'Gender is required'],
    },
    dateOfBirth: {
      type: Date,
    },
    // Parent/guardian users linked to this student
    parentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    status: {
      type: String,
      enum: Object.values(STUDENT_STATUSES),
      default: STUDENT_STATUSES.ACTIVE,
    },
    // Populated when status = transferred
    transferNote: {
      type: String,
      trim: true,
    },
    photo: {
      type: String, // URL / path — populated later
    },
    // Transport route assigned to this student (optional)
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TransportRoute',
    },
  },
  { timestamps: true }
);

// Admission number is unique per school
studentSchema.index({ schoolId: 1, admissionNumber: 1 }, { unique: true });

// ── Hooks — keep Class.studentCount in sync ───────────────────────────────────

studentSchema.post('save', async function (_doc, _next) {
  // Only increment on first save (creation), not on subsequent updates
  if (!this.wasNew) return;
  const Class = mongoose.model('Class');
  await Class.updateOne(
    { _id: this.classId },
    { $inc: { studentCount: 1 } }
  );
});

// Mark isNew before save so we can check it in post hook
studentSchema.pre('save', function (next) {
  this.wasNew = this.isNew;
  next();
});

studentSchema.post('deleteOne', { document: true, query: false }, async function () {
  const Class = mongoose.model('Class');
  await Class.updateOne(
    { _id: this.classId },
    { $inc: { studentCount: -1 } }
  );
});

export default mongoose.models.Student || mongoose.model('Student', studentSchema);
