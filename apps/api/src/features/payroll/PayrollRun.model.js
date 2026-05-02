import mongoose from 'mongoose';

// Individual payslip embedded in a payroll run
const payslipSchema = new mongoose.Schema(
  {
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Gross components
    basicSalary: { type: Number, default: 0 },
    houseAllowance: { type: Number, default: 0 },
    transportAllowance: { type: Number, default: 0 },
    medicalAllowance: { type: Number, default: 0 },
    otherAllowances: { type: Number, default: 0 },
    grossPay: { type: Number, default: 0 },
    // Statutory deductions (Kenya)
    nhif: { type: Number, default: 0 },
    nssf: { type: Number, default: 0 },
    paye: { type: Number, default: 0 },
    // Other deductions
    otherDeductions: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    netPay: { type: Number, default: 0 },
    // Employment type snapshot
    employmentType: { type: String },
    salaryGrade: { type: String },
  },
  { _id: false }
);

const payrollRunSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },
    month: {
      type: Number, // 1-12
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'approved', 'paid'],
      default: 'draft',
    },
    payslips: [payslipSchema],
    totalGross: { type: Number, default: 0 },
    totalNet:   { type: Number, default: 0 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: { type: Date },
  },
  { timestamps: true }
);

payrollRunSchema.index({ schoolId: 1, year: 1, month: 1 }, { unique: true });

export default mongoose.models.PayrollRun || mongoose.model('PayrollRun', payrollRunSchema);
