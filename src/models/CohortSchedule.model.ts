import "server-only"
import mongoose, { Schema, Model, Types } from "mongoose"

export interface ICohortSchedule {
  _id: Types.ObjectId
  course: Types.ObjectId
  cohort: string
  startDate: string
  endDate: string
  startsAt: Date
  endsAt: Date
  /** Optional stored cutoff; legacy schedules fall back to startsAt + 7 days. */
  registrationClosesAt?: Date
  updatedBy: Types.ObjectId
}
const schema = new Schema<ICohortSchedule>({
  course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
  cohort: { type: String, required: true, trim: true },
  startDate: { type: String, required: true }, endDate: { type: String, required: true },
  startsAt: { type: Date, required: true }, endsAt: { type: Date, required: true },
  registrationClosesAt: { type: Date },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true })
schema.index({ course: 1, cohort: 1 }, { unique: true })
const CohortSchedule: Model<ICohortSchedule> = mongoose.models.CohortSchedule ?? mongoose.model<ICohortSchedule>("CohortSchedule", schema)
export default CohortSchedule
