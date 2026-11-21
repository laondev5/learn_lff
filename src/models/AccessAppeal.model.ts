import "server-only"
import mongoose, { Schema, Model, Types } from "mongoose"

export interface IAccessAppeal {
  _id: Types.ObjectId
  student: Types.ObjectId
  course: Types.ObjectId
  module: Types.ObjectId
  cohort: string
  schedule: Types.ObjectId
  reason: string
  superiorName: string
  superiorRole: string
  superiorEmail: string
  superiorPhone: string
  status: "pending" | "approved" | "rejected"
  decidedBy?: Types.ObjectId
  decidedAt?: Date
  accessOpensAt?: Date
  accessClosesAt?: Date
  courseEndsAt?: Date
  createdAt: Date
}
const schema = new Schema<IAccessAppeal>({
  student: { type: Schema.Types.ObjectId, ref: "User", required: true },
  course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
  module: { type: Schema.Types.ObjectId, ref: "Module", required: true },
  schedule: { type: Schema.Types.ObjectId, ref: "CohortSchedule", required: true },
  cohort: { type: String, required: true }, reason: { type: String, required: true, maxlength: 3000 },
  superiorName: { type: String, required: true, maxlength: 150 },
  superiorRole: { type: String, required: true, maxlength: 150 },
  superiorEmail: { type: String, default: "", maxlength: 254 },
  superiorPhone: { type: String, default: "", maxlength: 40 },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  decidedBy: { type: Schema.Types.ObjectId, ref: "User" }, decidedAt: Date,
  accessOpensAt: Date, accessClosesAt: Date, courseEndsAt: Date,
}, { timestamps: true })
schema.index({ student: 1, course: 1, module: 1, cohort: 1 }, { unique: true, partialFilterExpression: { status: "pending" } })
schema.index({ student: 1, course: 1, cohort: 1, status: 1, courseEndsAt: -1 })
const AccessAppeal: Model<IAccessAppeal> = mongoose.models.AccessAppeal ?? mongoose.model<IAccessAppeal>("AccessAppeal", schema)
export default AccessAppeal
