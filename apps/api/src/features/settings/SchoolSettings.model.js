import mongoose from 'mongoose';
import { DAYS_OF_WEEK, TERMS } from '../../constants/index.js';

const termDateSchema = new mongoose.Schema(
  {
    name:      { type: String, enum: TERMS, required: true },
    startDate: { type: Date, required: true },
    endDate:   { type: Date, required: true },
  },
  { _id: false }
);

const holidaySchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    date:        { type: Date, required: true },
    description: { type: String, trim: true },
  },
  { timestamps: false }
  // _id is auto-assigned so we can reference holidays by id for DELETE
);

const schoolSettingsSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      unique: true,
      index: true,
    },
    currentAcademicYear: {
      type: String,
      match: [/^\d{4}$/, 'Academic year must be a 4-digit year'],
    },
    // Term date windows — used to validate attendance dates, lock report card periods, etc.
    terms: {
      type: [termDateSchema],
      default: [],
    },
    // School holidays (no attendance taken, timetable suspended)
    holidays: {
      type: [holidaySchema],
      default: [],
    },
    // Days the school operates — defaults Mon–Fri
    workingDays: {
      type: [String],
      enum: DAYS_OF_WEEK,
      default: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    },
    // Branding / report card header data
    logo:          { type: String },       // Cloudinary URL
    motto:         { type: String, trim: true },
    principalName: { type: String, trim: true },
    // Override the address stored on the School record (optional)
    physicalAddress: { type: String, trim: true },
  },
  { timestamps: true }
);

export default mongoose.models.SchoolSettings ||
  mongoose.model('SchoolSettings', schoolSettingsSchema);
