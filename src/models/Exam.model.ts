import mongoose, { Document, Model, Schema, Types } from "mongoose"
import { IQuestion, QuestionType } from "./Test.model"

export interface IExam extends Document {
  title: string
  course: Types.ObjectId
  questions: IQuestion[]
  passingScore: number
  maxAttempts: number
  durationMinutes?: number
  isPublished: boolean
  createdAt: Date
  updatedAt: Date
}

const QuestionSchema = new Schema({
  text: { type: String, required: true },
  type: { type: String, enum: ["mcq", "true_false", "short_answer"] as QuestionType[], required: true },
  options: [{ type: String }],
  correctAnswer: { type: String, required: true },
  points: { type: Number, required: true, default: 1 },
})

const ExamSchema = new Schema<IExam>(
  {
    title: { type: String, required: true, trim: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    questions: [QuestionSchema],
    passingScore: { type: Number, required: true, default: 70 },
    maxAttempts: { type: Number, default: 2 },
    durationMinutes: { type: Number },
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true }
)

const Exam: Model<IExam> =
  mongoose.models.Exam ?? mongoose.model<IExam>("Exam", ExamSchema)

export default Exam
