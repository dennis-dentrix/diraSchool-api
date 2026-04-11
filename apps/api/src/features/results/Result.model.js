import mongoose from 'mongoose';

const resultSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: true,
      index: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
      index: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    // Denormalized from Exam — enables querying results by term/year without joins
    term: {
      type: String,
      required: true,
      index: true,
    },
    academicYear: {
      type: String,
      required: true,
    },
    marks: {
      type: Number,
      required: true,
      min: 0,
    },
    totalMarks: {
      type: Number,
      required: true,
      min: 1,
    },
    percentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    grade: {
      type: String,
      trim: true,
    },
    points: {
      type: Number,
      min: 1,
      max: 8,
    },
  },
  { timestamps: true }
);

resultSchema.index({ schoolId: 1, examId: 1, studentId: 1 }, { unique: true });

export default mongoose.models.Result || mongoose.model('Result', resultSchema);
