import mongoose, { Document, Model, Schema, Types } from "mongoose"

export interface IAnswerEntry {
  questionId: Types.ObjectId
  answer: string
}

export interface ITestSubmission extends Document {
  student: Types.ObjectId
  test: Types.ObjectId
  lesson: Types.ObjectId
  course: Types.ObjectId
  answers: IAnswerEntry[]
  score: number
  passed: boolean
  attemptNumber: number
  submittedAt: Date
}

const AnswerEntrySchema = new Schema<IAnswerEntry>({
  questionId: { type: Schema.Types.ObjectId, required: true },
  answer: { type: String, required: true },
})

const TestSubmissionSchema = new Schema<ITestSubmission>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    test: { type: Schema.Types.ObjectId, ref: "Test", required: true },
    lesson: { type: Schema.Types.ObjectId, ref: "Lesson", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    answers: [AnswerEntrySchema],
    score: { type: Number, required: true },
    passed: { type: Boolean, required: true },
    attemptNumber: { type: Number, required: true, default: 1 },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

TestSubmissionSchema.index({ student: 1, test: 1 })

const TestSubmission: Model<ITestSubmission> =
  mongoose.models.TestSubmission ??
  mongoose.model<ITestSubmission>("TestSubmission", TestSubmissionSchema)

export default TestSubmission
