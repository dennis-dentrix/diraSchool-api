import mongoose from 'mongoose';

const salaryGradeSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    basicSalary: {
      type: Number,
      required: true,
      min: 0,
    },
    houseAllowance: { type: Number, default: 0, min: 0 },
    transportAllowance: { type: Number, default: 0, min: 0 },
    medicalAllowance: { type: Number, default: 0, min: 0 },
    otherAllowances: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

salaryGradeSchema.index({ schoolId: 1, name: 1 }, { unique: true });

export default mongoose.models.SalaryGrade || mongoose.model('SalaryGrade', salaryGradeSchema);
