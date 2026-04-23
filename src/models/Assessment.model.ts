import "server-only"
import mongoose, { Document, Model, Schema, Types } from "mongoose"

export type AssessmentType = "quiz" | "test" | "attendance" | "exam"

export interface IAssessmentQuestion {
  _id: Types.ObjectId
  text: string
  type: "mcq" | "true_false" | "short_answer"
  options?: string[]
  correctAnswer: string
  points: number
}

export interface IAssessment extends Document {
  title: string
  course: Types.ObjectId
  module?: Types.ObjectId
  type: AssessmentType
  totalMarks: number
  passingMarks: number
  maxAttempts: number
  questions: IAssessmentQuestion[]
  weight: number
  durationMinutes: number
  proctoringEnabled: boolean
  allowedViolations: ViolationType[]
  isPublished: boolean
  createdBy: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

export type ViolationType =
  | "tab_switch"
  | "fullscreen_exit"
  | "microphone_inactive"
  | "copy_paste"
  | "right_click"

const AssessmentQuestionSchema = new Schema<IAssessmentQuestion>(
  {
    text: { type: String, required: true },
    type: {
      type: String,
      enum: ["mcq", "true_false", "short_answer"],
      required: true,
    },
    options: [{ type: String }],
    correctAnswer: { type: String, required: true },
    points: { type: Number, required: true, default: 1, min: 0 },
  },
  { _id: true }
)

const AssessmentSchema = new Schema<IAssessment>(
  {
    title: { type: String, required: true, trim: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    module: { type: Schema.Types.ObjectId, ref: "Module" },
    type: {
      type: String,
      enum: ["quiz", "test", "attendance", "exam"] as AssessmentType[],
      required: true,
    },
    totalMarks: { type: Number, required: true, min: 0 },
    passingMarks: { type: Number, required: true, min: 0 },
    maxAttempts: { type: Number, required: true, default: 1, min: 1 },
    questions: [AssessmentQuestionSchema],
    weight: { type: Number, default: 1, min: 0 },
    durationMinutes: { type: Number, required: true, min: 1 },
    proctoringEnabled: { type: Boolean, default: false },
    allowedViolations: {
      type: [String],
      enum: [
        "tab_switch",
        "fullscreen_exit",
        "microphone_inactive",
        "copy_paste",
        "right_click",
      ] as ViolationType[],
      default: ["tab_switch", "fullscreen_exit"],
    },
    isPublished: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

AssessmentSchema.index({ course: 1, module: 1 })
AssessmentSchema.index({ course: 1, type: 1 })
AssessmentSchema.index({ createdBy: 1 })

const Assessment: Model<IAssessment> =
  mongoose.models.Assessment ??
  mongoose.model<IAssessment>("Assessment", AssessmentSchema)

export default Assessment
