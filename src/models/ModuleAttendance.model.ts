import "server-only"
import mongoose, { Schema, Model, Types } from "mongoose"

export interface IModuleAttendance {
  _id: Types.ObjectId
  student: Types.ObjectId
  course: Types.ObjectId
  module: Types.ObjectId
  schedule: Types.ObjectId
  cohort: string
  opensAt: Date
  closesAt: Date
  lessonViews: Map<string, Date>
  completedAt?: Date
  evaluatedAt?: Date
  absent?: boolean
  missingLessons: string[]
  missingTests: string[]
  notificationStatus: "pending" | "leased" | "sent" | "none"
  notificationAttempts: number
  notificationLease?: string
  notificationLeaseUntil?: Date
  notificationNextAttemptAt?: Date
  notificationSentAt?: Date
}
const schema = new Schema<IModuleAttendance>({
  student: { type: Schema.Types.ObjectId, ref: "User", required: true },
  course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
  module: { type: Schema.Types.ObjectId, ref: "Module", required: true },
  schedule: { type: Schema.Types.ObjectId, ref: "CohortSchedule", required: true },
  cohort: { type: String, required: true }, opensAt: { type: Date, required: true }, closesAt: { type: Date, required: true },
  lessonViews: { type: Map, of: Date, default: {} }, completedAt: Date,
  evaluatedAt: Date, absent: Boolean, missingLessons: [String], missingTests: [String],
  notificationStatus: { type: String, enum: ["pending", "leased", "sent", "none"], default: "none" },
  notificationAttempts: { type: Number, default: 0 }, notificationLease: String,
  notificationLeaseUntil: Date, notificationNextAttemptAt: Date, notificationSentAt: Date,
}, { timestamps: true })
schema.index({ student: 1, schedule: 1, module: 1 }, { unique: true })
schema.index({ notificationStatus: 1, notificationNextAttemptAt: 1, notificationLeaseUntil: 1 })
const ModuleAttendance: Model<IModuleAttendance> = mongoose.models.ModuleAttendance ?? mongoose.model<IModuleAttendance>("ModuleAttendance", schema)
export default ModuleAttendance
