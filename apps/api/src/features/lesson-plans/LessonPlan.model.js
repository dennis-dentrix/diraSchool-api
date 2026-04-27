import mongoose from 'mongoose';
import { TERMS } from '../../constants/index.js';

const lessonPlanSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ['lesson_plan', 'work_schedule'],
      required: true,
      default: 'lesson_plan',
    },
    academicYear: {
      type: String,
      required: true,
      match: [/^\d{4}$/, 'Academic year must be 4 digits'],
    },
    term: {
      type: String,
      enum: TERMS,
      required: true,
    },
    weekNumber: {
      type: Number,
      min: 1,
      max: 52,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    imagePublicId: {
      type: String,
      trim: true,
    },
    // Teachers this plan has been shared with (beyond the original uploader)
    sharedWith: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

lessonPlanSchema.index({ schoolId: 1, teacherId: 1, academicYear: 1, term: 1 });

export default mongoose.models.LessonPlan ||
  mongoose.model('LessonPlan', lessonPlanSchema);
