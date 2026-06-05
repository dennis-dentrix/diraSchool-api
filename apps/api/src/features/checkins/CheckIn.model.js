import mongoose from 'mongoose';

const checkInSchema = new mongoose.Schema(
  {
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },
    // GPS coordinates captured at check-in time (optional for devices without GPS)
    latitude:  { type: Number },
    longitude: { type: Number },
    accuracy:  { type: Number }, // metres reported by browser

    // Calculated server-side using Haversine (0 if no GPS)
    distance_from_center: { type: Number, default: 0 },

    // Flag indicating whether location data was available at check-in
    locationAvailable: { type: Boolean, default: false },

    // on_time | late
    status: {
      type: String,
      enum: ['on_time', 'late'],
      required: true,
    },

    // morning_in | evening_out
    check_in_type: {
      type: String,
      enum: ['morning_in', 'evening_out'],
      default: 'morning_in',
    },

    // Principal off-site allowance
    off_site:        { type: Boolean, default: false },
    off_site_reason: { type: String, trim: true },

    // Offline sync tracking
    synced_offline: { type: Boolean, default: false },

    // Client-reported timestamp (may differ from server createdAt for offline syncs)
    client_timestamp: { type: Date },
  },
  { timestamps: true }
);

// Compound index for daily lookups and duplicate prevention
checkInSchema.index({ schoolId: 1, staffId: 1, check_in_type: 1, createdAt: -1 });
// Index for admin daily roster view
checkInSchema.index({ schoolId: 1, createdAt: -1 });

export default mongoose.models.CheckIn || mongoose.model('CheckIn', checkInSchema);
