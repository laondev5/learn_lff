import "server-only"
import mongoose, { Schema, Model, Types } from "mongoose"

export interface ICohortApplication {
  _id: Types.ObjectId
  student: Types.ObjectId
  course: Types.ObjectId
  schedule: Types.ObjectId
  cohort: string
  status: "pending" | "accepted" | "rejected"
  partnerName: string
  partnerEmail: string
  partnerPhone: string
  partnerInformed: boolean
  state?: string
  district?: string
  church?: string
  /** True when the account was created by the application form and has no password yet. */
  passwordSetupRequired: boolean
  passwordSetupEmailStatus?: "pending" | "sent" | "failed"
  tokenHash?: string
  tokenExpiresAt: Date
  emailStatus: "pending" | "sent" | "failed"
  respondedAt?: Date
  createdAt: Date
}
const schema = new Schema<ICohortApplication>({
  student: { type: Schema.Types.ObjectId, ref: "User", required: true },
  course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
  schedule: { type: Schema.Types.ObjectId, ref: "CohortSchedule", required: true },
  cohort: { type: String, required: true },
  status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
  partnerName: { type: String, required: true, maxlength: 150 },
  partnerEmail: { type: String, required: true, lowercase: true, maxlength: 254 },
  partnerPhone: { type: String, required: true, maxlength: 40 },
  partnerInformed: { type: Boolean, required: true },
  state: { type: String, trim: true, maxlength: 100 },
  district: { type: String, trim: true, maxlength: 150 },
  church: { type: String, trim: true, maxlength: 150 },
  passwordSetupRequired: { type: Boolean, default: false },
  passwordSetupEmailStatus: { type: String, enum: ["pending", "sent", "failed"] },
  tokenHash: { type: String, select: false }, tokenExpiresAt: { type: Date, required: true },
  emailStatus: { type: String, enum: ["pending", "sent", "failed"], default: "pending" },
  respondedAt: Date,
}, { timestamps: true })
schema.index({ student: 1, schedule: 1 }, { unique: true })
schema.index({ tokenHash: 1 }, { unique: true, sparse: true })
schema.index({ student: 1, course: 1, status: 1 })
const CohortApplication: Model<ICohortApplication> = mongoose.models.CohortApplication ?? mongoose.model<ICohortApplication>("CohortApplication", schema)
export default CohortApplication
