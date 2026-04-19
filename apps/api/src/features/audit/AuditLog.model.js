import mongoose from 'mongoose';
const auditLogSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      index: true,
      // null for superadmin actions
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userRole: { type: String, trim: true },
    action: {
      type: String,
      required: true,
      index: true,
    },
    resource: {
      type: String,
      required: true,
      index: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    // Flexible payload — store whatever is relevant to the action
    // e.g. { amount: 5000, method: 'mpesa' } for a payment, { from: 'Grade 3', to: 'Grade 4' } for a transfer
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ip:        { type: String },
    userAgent: { type: String },
  },
  {
    timestamps: true,
    // Audit logs are append-only — never update an existing entry
    // TTL index: auto-delete entries older than 2 years (optional, adjust as needed)
    // To enable: add  { expires: '730d' }  to the createdAt index below
  }
);

// Composite index for the most common admin query: "all actions for this school, newest first"
auditLogSchema.index({ schoolId: 1, createdAt: -1 });
// Support filtering by resource type + id
auditLogSchema.index({ schoolId: 1, resource: 1, resourceId: 1 });

export default mongoose.models.AuditLog ||
  mongoose.model('AuditLog', auditLogSchema);
