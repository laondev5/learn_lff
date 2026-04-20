import "server-only"
import mongoose, { Document, Model, Schema, Types } from "mongoose"

export interface IQuestionAnswer extends Document {
  author: Types.ObjectId
  content: string
  createdAt: Date
  updatedAt: Date
}

const AnswerSchema = new Schema<IQuestionAnswer>(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true },
  },
  { timestamps: true }
)

export interface ICourseQuestion extends Document {
  course: Types.ObjectId
  author: Types.ObjectId
  title: string
  content: string
  isUrgent: boolean
  answers: IQuestionAnswer[]
  isResolved: boolean
  createdAt: Date
  updatedAt: Date
}

const CourseQuestionSchema = new Schema<ICourseQuestion>(
  {
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    isUrgent: { type: Boolean, default: false },
    answers: [AnswerSchema],
    isResolved: { type: Boolean, default: false },
  },
  { timestamps: true }
)

const CourseQuestion: Model<ICourseQuestion> =
  mongoose.models.CourseQuestion ??
  mongoose.model<ICourseQuestion>("CourseQuestion", CourseQuestionSchema)

export default CourseQuestion
