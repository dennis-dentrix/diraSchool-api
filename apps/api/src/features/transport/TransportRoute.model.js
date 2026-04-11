import mongoose from 'mongoose';

const stopSchema = new mongoose.Schema(
  {
    name:  { type: String, required: true, trim: true },
    order: { type: Number, required: true, min: 1 },
    // Optional GPS coordinates for future map integration
    lat: { type: Number },
    lng: { type: Number },
  },
  { _id: false }
);

const transportRouteSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },
    name:        { type: String, required: [true, 'Route name is required'], trim: true },
    description: { type: String, trim: true },
    vehicleReg:  { type: String, trim: true },   // e.g. "KBZ 123A"
    driverName:  { type: String, trim: true },
    driverPhone: { type: String, trim: true },
    capacity:    { type: Number, min: 1 },        // max seats on this vehicle
    stops: {
      type: [stopSchema],
      default: [],
    },
    // Morning (to school) and afternoon (from school) departure times
    morningDeparture:   { type: String, match: [/^\d{2}:\d{2}$/, 'Time must be HH:MM'] },
    afternoonDeparture: { type: String, match: [/^\d{2}:\d{2}$/, 'Time must be HH:MM'] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Route names must be unique within a school
transportRouteSchema.index({ schoolId: 1, name: 1 }, { unique: true });

export default mongoose.models.TransportRoute ||
  mongoose.model('TransportRoute', transportRouteSchema);
