import mongoose from 'mongoose';
import { EXAM_TYPES, LEVEL_CATEGORIES, TERMS } from '../../constants/index.js';

const examSchema = new mongoose.Schema(
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
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Exam name is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(EXAM_TYPES),
      required: true,
    },
    term: {
      type: String,
      enum: TERMS,
      required: true,
    },
    academicYear: {
      type: String,
      required: true,
      match: [/^\d{4}$/, 'Academic year must be a 4-digit year'],
    },
    levelCategory: {
      type: String,
      enum: Object.values(LEVEL_CATEGORIES),
      required: true,
    },
    totalMarks: {
      type: Number,
      required: true,
      min: 1,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

examSchema.index(
  { schoolId: 1, classId: 1, subjectId: 1, name: 1, term: 1, academicYear: 1 },
  { unique: true }
);

export default mongoose.models.Exam || mongoose.model('Exam', examSchema);
