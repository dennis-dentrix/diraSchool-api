import mongoose from 'mongoose';

const bookSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },
    title:  { type: String, required: [true, 'Book title is required'], trim: true },
    author: { type: String, trim: true },
    isbn:   { type: String, trim: true },
    category: { type: String, trim: true },  // e.g. 'Textbook', 'Fiction', 'Reference'
    totalCopies:     { type: Number, required: true, min: 1 },
    availableCopies: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Prevent duplicate ISBN within the same school (ISBN can repeat across schools)
bookSchema.index({ schoolId: 1, isbn: 1 }, {
  unique: true,
  partialFilterExpression: { isbn: { $exists: true, $ne: '' } },
});

export default mongoose.models.Book || mongoose.model('Book', bookSchema);
