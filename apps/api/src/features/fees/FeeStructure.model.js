import mongoose from 'mongoose';
import { TERMS } from '../../constants/index.js';

const feeItemSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      trim: true,
      default: 'School Fees',
    },
    name: {
      type: String,
      required: [true, 'Fee item name is required'],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Fee item amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
  },
  { _id: false }
);

const feeStructureSchema = new mongoose.Schema(
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
      required: [true, 'Academic year is required'],
      match: [/^\d{4}$/, 'Academic year must be a 4-digit year'],
    },
    term: {
      type: String,
      enum: TERMS,
      required: [true, 'Term is required'],
    },
    // Individual fee line items (e.g. Tuition, Activity, Transport)
    items: {
      type: [feeItemSchema],
      validate: {
        validator: (v) => v.length > 0,
        message: 'At least one fee item is required',
      },
    },
    // Denormalized sum of all item amounts — kept in sync by pre-save hook
    totalAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// One fee structure per class per term per year
feeStructureSchema.index(
  { schoolId: 1, classId: 1, academicYear: 1, term: 1 },
  { unique: true }
);

// Keep totalAmount in sync whenever items are saved
feeStructureSchema.pre('save', function (next) {
  this.totalAmount = this.items.reduce((sum, item) => sum + item.amount, 0);
  next();
});

export default mongoose.models.FeeStructure ||
  mongoose.model('FeeStructure', feeStructureSchema);
