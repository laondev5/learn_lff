import "server-only"
import mongoose, { Document, Model, Schema, Types } from "mongoose"

export interface ICourseSettings extends Document {
  course: Types.ObjectId
  caWeight: number
  examWeight: number
  proctoringEnabled: boolean
  maxWarnings: number
  createdBy: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const CourseSettingsSchema = new Schema<ICourseSettings>(
  {
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      unique: true,
    },
    caWeight: {
      type: Number,
      required: true,
      default: 40,
      min: 0,
      max: 100,
    },
    examWeight: {
      type: Number,
      required: true,
      default: 60,
      min: 0,
      max: 100,
    },
    proctoringEnabled: {
      type: Boolean,
      default: false,
    },
    maxWarnings: {
      type: Number,
      default: 3,
      min: 1,
      max: 10,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
)


const CourseSettings: Model<ICourseSettings> =
  mongoose.models.CourseSettings ??
  mongoose.model<ICourseSettings>("CourseSettings", CourseSettingsSchema)

export default CourseSettings
