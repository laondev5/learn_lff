import "server-only"
import mongoose, { Document, Model, Schema, Types } from "mongoose"

export interface ISubmission extends Document {
  student: Types.ObjectId
  assessment: Types.ObjectId
  course: Types.ObjectId
  proctoringSession?: Types.ObjectId
  answers: IAnswer[]
  score: number
  maxScore: number
  percentageScore: number
  passed: boolean
  attemptNumber: number
  autoSubmitted: boolean
  autoSubmittedReason?: string
  submittedAt: Date
  gradedAt?: Date
  gradedBy?: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

export interface IAnswer {
  questionId: Types.ObjectId
  answer: string
  isCorrect?: boolean
  pointsAwarded?: number
}

const AnswerSchema = new Schema<IAnswer>(
  {
    questionId: { type: Schema.Types.ObjectId, required: true },
    answer: { type: String, required: true },
    isCorrect: { type: Boolean },
    pointsAwarded: { type: Number, min: 0 },
  },
  { _id: false }
)

const SubmissionSchema = new Schema<ISubmission>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assessment: {
      type: Schema.Types.ObjectId,
      ref: "Assessment",
      required: true,
    },
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    proctoringSession: {
      type: Schema.Types.ObjectId,
      ref: "ProctoringSession",
    },
    answers: [AnswerSchema],
    score: { type: Number, default: 0, min: 0 },
    maxScore: { type: Number, required: true, min: 0 },
    percentageScore: { type: Number, default: 0, min: 0, max: 100 },
    passed: { type: Boolean, default: false },
    attemptNumber: { type: Number, default: 1, min: 1 },
    autoSubmitted: { type: Boolean, default: false },
    autoSubmittedReason: { type: String },
    submittedAt: { type: Date, default: Date.now },
    gradedAt: { type: Date },
    gradedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
)

SubmissionSchema.index({ student: 1, assessment: 1 })
SubmissionSchema.index({ student: 1, course: 1 })
SubmissionSchema.index({ course: 1, submittedAt: -1 })

const Submission: Model<ISubmission> =
  mongoose.models.Submission ??
  mongoose.model<ISubmission>("Submission", SubmissionSchema)

export default Submission
