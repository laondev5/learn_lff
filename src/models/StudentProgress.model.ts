import "server-only"
import mongoose, { Document, Model, Schema, Types } from "mongoose"

export interface IStudentProgress extends Document {
  student: Types.ObjectId
  course: Types.ObjectId
  completedLessons: Types.ObjectId[]
  completedTests: Types.ObjectId[]
  completedModules: Types.ObjectId[]
  examPassed: boolean
  examScore?: number
  certificateIssued: boolean
  enrolledAt: Date
  updatedAt: Date
}

const StudentProgressSchema = new Schema<IStudentProgress>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    completedLessons: [{ type: Schema.Types.ObjectId, ref: "Lesson" }],
    completedTests: [{ type: Schema.Types.ObjectId, ref: "Test" }],
    completedModules: [{ type: Schema.Types.ObjectId, ref: "Module" }],
    examPassed: { type: Boolean, default: false },
    examScore: { type: Number },
    certificateIssued: { type: Boolean, default: false },
    enrolledAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

StudentProgressSchema.index({ student: 1, course: 1 }, { unique: true })

const StudentProgress: Model<IStudentProgress> =
  mongoose.models.StudentProgress ??
  mongoose.model<IStudentProgress>("StudentProgress", StudentProgressSchema)

export default StudentProgress
