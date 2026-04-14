import "server-only"
import mongoose, { Document, Model, Schema, Types } from "mongoose"
import { IAnswerEntry } from "./TestSubmission.model"

export interface IExamSubmission extends Document {
  student: Types.ObjectId
  exam: Types.ObjectId
  course: Types.ObjectId
  answers: IAnswerEntry[]
  score: number
  passed: boolean
  attemptNumber: number
  submittedAt: Date
}

const AnswerEntrySchema = new Schema({
  questionId: { type: Schema.Types.ObjectId, required: true },
  answer: { type: String, required: true },
})

const ExamSubmissionSchema = new Schema<IExamSubmission>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    exam: { type: Schema.Types.ObjectId, ref: "Exam", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    answers: [AnswerEntrySchema],
    score: { type: Number, required: true },
    passed: { type: Boolean, required: true },
    attemptNumber: { type: Number, required: true, default: 1 },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

ExamSubmissionSchema.index({ student: 1, exam: 1 })

const ExamSubmission: Model<IExamSubmission> =
  mongoose.models.ExamSubmission ??
  mongoose.model<IExamSubmission>("ExamSubmission", ExamSubmissionSchema)

export default ExamSubmission
