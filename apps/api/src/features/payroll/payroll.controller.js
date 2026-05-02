import User from '../users/User.model.js';
import SalaryGrade from './SalaryGrade.model.js';
import PayrollRun from './PayrollRun.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { computeDeductions } from './payroll.deductions.js';
import { ROLES } from '../../constants/index.js';

// ── Salary Grades ─────────────────────────────────────────────────────────────

export const listSalaryGrades = asyncHandler(async (req, res) => {
  const grades = await SalaryGrade.find({ schoolId: req.user.schoolId }).sort({ name: 1 }).lean();
  return sendSuccess(res, { salaryGrades: grades });
});

export const createSalaryGrade = asyncHandler(async (req, res) => {
  const { name, basicSalary, houseAllowance, transportAllowance, medicalAllowance, otherAllowances } = req.body;
  if (!name || basicSalary == null) return sendError(res, 'Name and basicSalary are required.', 400);

  const grade = await SalaryGrade.create({
    schoolId: req.user.schoolId,
    name: name.trim(),
    basicSalary,
    houseAllowance: houseAllowance ?? 0,
    transportAllowance: transportAllowance ?? 0,
    medicalAllowance: medicalAllowance ?? 0,
    otherAllowances: otherAllowances ?? 0,
  });
  return sendSuccess(res, { salaryGrade: grade }, 201);
});

export const updateSalaryGrade = asyncHandler(async (req, res) => {
  const grade = await SalaryGrade.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!grade) return sendError(res, 'Salary grade not found.', 404);

  const fields = ['name', 'basicSalary', 'houseAllowance', 'transportAllowance', 'medicalAllowance', 'otherAllowances'];
  fields.forEach((f) => { if (req.body[f] !== undefined) grade[f] = req.body[f]; });
  await grade.save();
  return sendSuccess(res, { salaryGrade: grade });
});

export const deleteSalaryGrade = asyncHandler(async (req, res) => {
  const grade = await SalaryGrade.findOneAndDelete({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!grade) return sendError(res, 'Salary grade not found.', 404);
  return sendSuccess(res, { message: 'Salary grade deleted.' });
});

// ── Payroll Runs ──────────────────────────────────────────────────────────────

export const listPayrollRuns = asyncHandler(async (req, res) => {
  const runs = await PayrollRun.find({ schoolId: req.user.schoolId })
    .sort({ year: -1, month: -1 })
    .limit(24)
    .select('-payslips')
    .lean();
  return sendSuccess(res, { runs });
});

export const getPayrollRun = asyncHandler(async (req, res) => {
  const run = await PayrollRun.findOne({ _id: req.params.id, schoolId: req.user.schoolId })
    .populate('payslips.staffId', 'firstName lastName email staffId employmentType')
    .lean();
  if (!run) return sendError(res, 'Payroll run not found.', 404);
  return sendSuccess(res, { run });
});

/**
 * POST /payroll/runs
 * Generate a draft payroll run for the given month/year.
 * For TSC staff — we record but skip school payroll (government pays them).
 */
export const generatePayrollRun = asyncHandler(async (req, res) => {
  const { month, year } = req.body;
  if (!month || !year) return sendError(res, 'month and year are required.', 400);
  if (month < 1 || month > 12) return sendError(res, 'month must be 1–12.', 400);

  const existing = await PayrollRun.findOne({ schoolId: req.user.schoolId, month, year });
  if (existing) return sendError(res, `A payroll run for ${month}/${year} already exists.`, 409);

  // Fetch all non-TSC active staff
  const staff = await User.find({
    schoolId: req.user.schoolId,
    isActive: true,
    role: { $ne: ROLES.PARENT },
    employmentType: { $ne: 'TSC' }, // TSC staff are paid by government
  }).lean();

  const grades = await SalaryGrade.find({ schoolId: req.user.schoolId }).lean();
  const gradeMap = Object.fromEntries(grades.map((g) => [g.name, g]));

  const payslips = staff.map((member) => {
    const grade = gradeMap[member.salaryGrade] ?? null;
    const basicSalary      = grade?.basicSalary ?? 0;
    const houseAllowance   = grade?.houseAllowance ?? 0;
    const transportAllowance = grade?.transportAllowance ?? 0;
    const medicalAllowance = grade?.medicalAllowance ?? 0;
    const otherAllowances  = grade?.otherAllowances ?? 0;
    const grossPay = basicSalary + houseAllowance + transportAllowance + medicalAllowance + otherAllowances;

    const { nhif, nssf, paye } = computeDeductions(grossPay);
    const totalDeductions = nhif + nssf + paye;
    const netPay = grossPay - totalDeductions;

    return {
      staffId: member._id,
      basicSalary,
      houseAllowance,
      transportAllowance,
      medicalAllowance,
      otherAllowances,
      grossPay,
      nhif,
      nssf,
      paye,
      otherDeductions: 0,
      totalDeductions,
      netPay,
      employmentType: member.employmentType,
      salaryGrade: member.salaryGrade,
    };
  });

  const totalGross = payslips.reduce((s, p) => s + p.grossPay, 0);
  const totalNet   = payslips.reduce((s, p) => s + p.netPay, 0);

  const run = await PayrollRun.create({
    schoolId: req.user.schoolId,
    month,
    year,
    status: 'draft',
    payslips,
    totalGross,
    totalNet,
    createdBy: req.user._id,
  });

  return sendSuccess(res, { run }, 201);
});

export const approvePayrollRun = asyncHandler(async (req, res) => {
  const run = await PayrollRun.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!run) return sendError(res, 'Payroll run not found.', 404);
  if (run.status !== 'draft') return sendError(res, `Run is already ${run.status}.`, 400);

  run.status = 'approved';
  run.approvedBy = req.user._id;
  run.approvedAt = new Date();
  await run.save();
  return sendSuccess(res, { run });
});

export const markPayrollPaid = asyncHandler(async (req, res) => {
  const run = await PayrollRun.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!run) return sendError(res, 'Payroll run not found.', 404);
  if (run.status !== 'approved') return sendError(res, 'Only approved runs can be marked as paid.', 400);

  run.status = 'paid';
  await run.save();
  return sendSuccess(res, { run });
});

export const deletePayrollRun = asyncHandler(async (req, res) => {
  const run = await PayrollRun.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!run) return sendError(res, 'Payroll run not found.', 404);
  if (run.status !== 'draft') return sendError(res, 'Only draft runs can be deleted.', 400);
  await run.deleteOne();
  return sendSuccess(res, { message: 'Payroll run deleted.' });
});
