import mongoose from 'mongoose';
import { TERMS } from '../../constants/index.js';

const termDateSchema = new mongoose.Schema(
  {
    name:      { type: String, enum: TERMS, required: true },
    startDate: { type: Date, required: true },
    endDate:   { type: Date, required: true },
  },
  { _id: false }
);

// Singleton — only one document exists (no schoolId)
const systemSettingsSchema = new mongoose.Schema(
  {
    currentAcademicYear: {
      type: String,
      match: [/^\d{4}$/, 'Academic year must be a 4-digit year'],
    },
    terms: {
      type: [termDateSchema],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.models.SystemSettings ||
  mongoose.model('SystemSettings', systemSettingsSchema);
