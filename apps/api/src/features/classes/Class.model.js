import mongoose from 'mongoose';
import { LEVEL_CATEGORIES, TERMS } from '../../constants/index.js';

const classSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Class name is required'],
      trim: true,
    },
    // Optional stream suffix, e.g. "North", "A", "Blue"
    stream: {
      type: String,
      trim: true,
    },
    levelCategory: {
      type: String,
      enum: Object.values(LEVEL_CATEGORIES),
      required: [true, 'Level category is required'],
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
    },
    // The class teacher assigned to this class
    classTeacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // Denormalized count — updated by Student pre-save/remove hooks
    studentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// A school cannot have two classes with same name + stream + year + term
classSchema.index(
  { schoolId: 1, name: 1, stream: 1, academicYear: 1, term: 1 },
  { unique: true }
);

export default mongoose.models.Class || mongoose.model('Class', classSchema);
