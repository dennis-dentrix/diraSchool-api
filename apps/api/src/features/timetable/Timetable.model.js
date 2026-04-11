import mongoose from 'mongoose';
import { TERMS, DAYS_OF_WEEK } from '../../constants/index.js';

const slotSchema = new mongoose.Schema(
  {
    day:       { type: String, enum: DAYS_OF_WEEK, required: true },
    period:    { type: Number, min: 1, max: 12, required: true }, // period/lesson number for the day
    startTime: { type: String, match: [/^\d{2}:\d{2}$/, 'Time must be HH:MM'], required: true },
    endTime:   { type: String, match: [/^\d{2}:\d{2}$/, 'Time must be HH:MM'], required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    room:      { type: String, trim: true },
  },
  { _id: false }
);

const timetableSchema = new mongoose.Schema(
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
    academicYear: {
      type: String,
      required: true,
      match: [/^\d{4}$/, 'Academic year must be a 4-digit year'],
    },
    term: {
      type: String,
      enum: TERMS,
      required: true,
    },
    slots: {
      type: [slotSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// One timetable per class per term per year
timetableSchema.index(
  { schoolId: 1, classId: 1, academicYear: 1, term: 1 },
  { unique: true }
);

export default mongoose.models.Timetable ||
  mongoose.model('Timetable', timetableSchema);
