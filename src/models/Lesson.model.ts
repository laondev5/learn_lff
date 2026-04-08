import mongoose, { Document, Model, Schema, Types } from "mongoose"

export interface ILesson extends Document {
  title: string
  module: Types.ObjectId
  course: Types.ObjectId
  order: number
  content: string
  videoUrl?: string
  duration?: number
  isPublished: boolean
  createdAt: Date
  updatedAt: Date
}

const LessonSchema = new Schema<ILesson>(
  {
    title: { type: String, required: true, trim: true },
    module: { type: Schema.Types.ObjectId, ref: "Module", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    order: { type: Number, required: true, default: 0 },
    content: { type: String, required: true },
    videoUrl: { type: String },
    duration: { type: Number },
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true }
)

LessonSchema.index({ module: 1, order: 1 })

const Lesson: Model<ILesson> =
  mongoose.models.Lesson ?? mongoose.model<ILesson>("Lesson", LessonSchema)

export default Lesson
