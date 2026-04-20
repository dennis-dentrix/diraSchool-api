import mongoose from 'mongoose';
import { LEVEL_CATEGORIES, TERMS } from '../../constants/index.js';

// ── Sub-schemas (stored as snapshots, not references) ────────────────────────

// A single exam entry within a subject summary
const examEntrySchema = new mongoose.Schema(
  {
    examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
    examName: { type: String, required: true },     // snapshot
    examType: { type: String, required: true },     // snapshot: opener / midterm / endterm / sba
    marks: { type: Number, required: true, min: 0 },
    totalMarks: { type: Number, required: true, min: 1 },
    percentage: { type: Number, required: true },
    grade: { type: String },
    points: { type: Number },
  },
  { _id: false }
);

// Aggregated performance for one subject across all exams in the term
const subjectSummarySchema = new mongoose.Schema(
  {
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    subjectName: { type: String, required: true },  // snapshot
    subjectCode: { type: String },                  // snapshot
    exams: [examEntrySchema],
    // Weighted-average percentage across all exams (weighted by totalMarks)
    averagePercentage: { type: Number, required: true },
    grade: { type: String },   // derived from averagePercentage + levelCategory
    points: { type: Number },  // 1-8 (or 1-4 for Grades 1-6)
    // Teacher's per-subject remark for this student (e.g. "Needs improvement in fractions")
    teacherRemark: { type: String, trim: true },
  },
  { _id: false }
);

// Attendance counts pulled from submitted registers at generation time
const attendanceSummarySchema = new mongoose.Schema(
  {
    totalDays: { type: Number, default: 0 },
    present: { type: Number, default: 0 },
    absent: { type: Number, default: 0 },
    late: { type: Number, default: 0 },
    excused: { type: Number, default: 0 },
  },
  { _id: false }
);

// ── Main schema ───────────────────────────────────────────────────────────────

const reportCardSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
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
    // Snapshot of the class level — determines grading rubric
    levelCategory: {
      type: String,
      enum: Object.values(LEVEL_CATEGORIES),
      required: true,
    },
    subjects: [subjectSummarySchema],
    // Derived from subject points
    totalPoints: { type: Number, default: 0 },
    averagePoints: { type: Number, default: 0 },
    // Grade derived from averagePoints using the same CBC rubric
    overallGrade: { type: String },
    // Attendance summary from submitted registers for this class+term+year
    attendanceSummary: { type: attendanceSummarySchema, default: () => ({}) },
    // Staff remarks — editable until published
    teacherRemarks: { type: String, trim: true },
    principalRemarks: { type: String, trim: true },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
      index: true,
    },
    // Generated PDF location (Cloudinary raw file URL).
    pdfUrl: { type: String, trim: true },
    pdfPublicId: { type: String, trim: true },
    pdfStatus: {
      type: String,
      enum: ['not_requested', 'queued', 'processing', 'ready', 'failed'],
      default: 'not_requested',
      index: true,
    },
    pdfGeneratedAt: { type: Date },
    pdfError: { type: String, trim: true },
    publishedAt: { type: Date },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One report card per student per term per year
reportCardSchema.index(
  { schoolId: 1, studentId: 1, academicYear: 1, term: 1 },
  { unique: true }
);

export default mongoose.models.ReportCard ||
  mongoose.model('ReportCard', reportCardSchema);
