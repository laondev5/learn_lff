import "server-only"
import mongoose, { Document, Model, Schema, Types } from "mongoose"

export type QuestionType = "mcq" | "true_false" | "short_answer"

export interface IQuestion {
  _id: Types.ObjectId
  text: string
  type: QuestionType
  options?: string[]
  correctAnswer: string
  points: number
}

export interface ITest extends Document {
  title: string
  lesson: Types.ObjectId
  course: Types.ObjectId
  questions: IQuestion[]
  passingScore: number
  maxAttempts: number
  isPublished: boolean
  createdAt: Date
  updatedAt: Date
}

const QuestionSchema = new Schema<IQuestion>({
  text: { type: String, required: true },
  type: { type: String, enum: ["mcq", "true_false", "short_answer"], required: true },
  options: [{ type: String }],
  correctAnswer: { type: String, required: true },
  points: { type: Number, required: true, default: 1 },
})

const TestSchema = new Schema<ITest>(
  {
    title: { type: String, required: true, trim: true },
    lesson: { type: Schema.Types.ObjectId, ref: "Lesson", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    questions: [QuestionSchema],
    passingScore: { type: Number, required: true, default: 70 },
    maxAttempts: { type: Number, default: 3 },
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true }
)

const Test: Model<ITest> =
  mongoose.models.Test ?? mongoose.model<ITest>("Test", TestSchema)

export default Test
