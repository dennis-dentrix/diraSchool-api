import mongoose from 'mongoose';
import { LOAN_STATUSES, BORROWER_TYPES } from '../../constants/index.js';

const bookLoanSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
      index: true,
    },
    borrowerType: {
      type: String,
      enum: Object.values(BORROWER_TYPES),
      required: true,
    },
    // Polymorphic — points to a Student or User document depending on borrowerType
    borrowerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    // Snapshot so borrower details survive a delete
    borrowerName: { type: String, trim: true },
    dueDate:      { type: Date, required: true },
    returnedAt:   { type: Date },
    status: {
      type: String,
      enum: Object.values(LOAN_STATUSES),
      default: LOAN_STATUSES.ACTIVE,
      index: true,
    },
    notes: { type: String, trim: true },
    // Staff member who issued the book
    issuedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    returnedToUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// Index for "all active loans for this book" (needed for copy count integrity)
bookLoanSchema.index({ bookId: 1, status: 1 });

export default mongoose.models.BookLoan ||
  mongoose.model('BookLoan', bookLoanSchema);
