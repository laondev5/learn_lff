import "server-only"
import mongoose, { Document, Model, Schema } from "mongoose"

export type SecurityAuditEvent =
  | "account_created"
  | "onboarding_email_sent"
  | "onboarding_email_failed"
  | "temporary_password_login_blocked"
  | "password_changed"

export interface ISecurityAuditLog extends Document {
  event: SecurityAuditEvent
  actorUserId?: string
  targetUserId?: string
  email?: string
  role?: string
  status: "success" | "failure" | "blocked"
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

const SecurityAuditLogSchema = new Schema<ISecurityAuditLog>(
  {
    event: {
      type: String,
      enum: [
        "account_created",
        "onboarding_email_sent",
        "onboarding_email_failed",
        "temporary_password_login_blocked",
        "password_changed",
      ],
      required: true,
    },
    actorUserId: { type: String, trim: true },
    targetUserId: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    role: { type: String, trim: true },
    status: {
      type: String,
      enum: ["success", "failure", "blocked"],
      required: true,
    },
    ipAddress: { type: String, trim: true },
    userAgent: { type: String, trim: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
)

const SecurityAuditLog: Model<ISecurityAuditLog> =
  mongoose.models.SecurityAuditLog ??
  mongoose.model<ISecurityAuditLog>("SecurityAuditLog", SecurityAuditLogSchema)

export default SecurityAuditLog
