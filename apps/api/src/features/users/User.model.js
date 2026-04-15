import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES } from '../../constants/index.js';

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    staffId: {
      type: String,
      trim: true,
    },
    tscNumber: {
      type: String,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 8,
      select: false, // never returned in queries by default
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      required: [true, 'Role is required'],
    },
    // null only for superadmin
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      index: true,
    },
    // Only populated for teachers — their assigned class
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
    },
    // Only populated for parents — their children
    children: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
      },
    ],
    // Forces password change before any other action (set on account creation)
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
    },
    // ── Email verification ────────────────────────────────────────────────────
    // Required for school admins on self-registration.
    // Staff accounts created by admins skip this (invite flow handles activation).
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpiry: {
      type: Date,
      select: false,
    },

    // ── Password reset ────────────────────────────────────────────────────────
    // Raw token is sent to the user via email. Only the SHA-256 hash is stored
    // so a DB leak cannot be used to reset passwords.
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpiry: {
      type: Date,
      select: false,
    },
    // ── Account invite ────────────────────────────────────────────────────────
    // Sent when an admin creates a new staff account. User clicks the email link
    // to set their own password. Raw token is emailed; only hash stored here.
    // Also reused for admin "re-send invite" / "reset password" actions.
    inviteToken: {
      type: String,
      select: false,
    },
    inviteTokenExpiry: {
      type: Date,
      select: false,
    },
    // True until the user accepts their invite (sets their own password).
    // Blocks login — user must complete invite flow first.
    invitePending: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// ── Indexes ──────────────────────────────────────────────────────────────────

// Email is unique per school — same email can exist in different schools
userSchema.index({ schoolId: 1, email: 1 }, { unique: true });

// Superadmins have no schoolId — their email must be globally unique
// partialFilterExpression allows multiple null schoolIds without violating uniqueness
userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { schoolId: { $exists: false } },
  }
);

// ── Hooks ────────────────────────────────────────────────────────────────────

// Hash password before save (only if modified)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// ── Instance methods ──────────────────────────────────────────────────────────

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export default mongoose.models.User || mongoose.model('User', userSchema);
