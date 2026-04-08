import mongoose, { Document, Model, Schema, Types } from "mongoose"

export interface ICourse extends Document {
  title: string
  description: string
  teacher: Types.ObjectId
  coverImageUrl?: string
  isPublished: boolean
  createdAt: Date
  updatedAt: Date
}

const CourseSchema = new Schema<ICourse>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    teacher: { type: Schema.Types.ObjectId, ref: "User", required: true },
    coverImageUrl: { type: String },
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true }
)

const Course: Model<ICourse> =
  mongoose.models.Course ?? mongoose.model<ICourse>("Course", CourseSchema)

export default Course
