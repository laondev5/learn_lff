import "server-only"
import mongoose, { Document, Model, Schema, Types } from "mongoose"
import { ViolationType } from "./Assessment.model"

export type SessionStatus = "active" | "submitted" | "terminated" | "expired"

export type ViolationEvent = {
  type: ViolationType
  timestamp: Date
  details?: string
}

export interface IProctoringSession extends Document {
  assessment: Types.ObjectId
  student: Types.ObjectId
  course: Types.ObjectId
  status: SessionStatus
  startTime: Date
  endTime?: Date
  warnings: number
  maxWarnings: number
  violationLog: ViolationEvent[]
  microphoneActive: boolean
  fullscreenActive: boolean
  tabHidden: boolean
  lastPolledAt?: Date
  answersSnapshot: Record<string, string>
  submittedAnswerIds: Types.ObjectId[]
  createdAt: Date
  updatedAt: Date
}

const ViolationEventSchema = new Schema<ViolationEvent>(
  {
    type: {
      type: String,
      enum: [
        "tab_switch",
        "fullscreen_exit",
        "microphone_inactive",
        "copy_paste",
        "right_click",
      ] as ViolationType[],
      required: true,
    },
    timestamp: { type: Date, default: Date.now, required: true },
    details: { type: String },
  },
  { _id: false }
)

const ProctoringSessionSchema = new Schema<IProctoringSession>(
  {
    assessment: {
      type: Schema.Types.ObjectId,
      ref: "Assessment",
      required: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "submitted", "terminated", "expired"] as SessionStatus[],
      default: "active",
    },
    startTime: { type: Date, default: Date.now, required: true },
    endTime: { type: Date },
    warnings: { type: Number, default: 0, min: 0 },
    maxWarnings: { type: Number, default: 3, min: 1 },
    violationLog: [ViolationEventSchema],
    microphoneActive: { type: Boolean, default: false },
    fullscreenActive: { type: Boolean, default: false },
    tabHidden: { type: Boolean, default: false },
    lastPolledAt: { type: Date },
    answersSnapshot: {
      type: Schema.Types.Mixed,
      default: {},
    },
    submittedAnswerIds: [
      { type: Schema.Types.ObjectId, ref: "Assessment" },
    ],
  },
  { timestamps: true }
)

ProctoringSessionSchema.index({ assessment: 1, student: 1 }, { unique: true })
ProctoringSessionSchema.index({ assessment: 1, status: 1 })
ProctoringSessionSchema.index({ student: 1, status: 1 })
ProctoringSessionSchema.index({ endTime: 1 }, { sparse: true })

const ProctoringSession: Model<IProctoringSession> =
  mongoose.models.ProctoringSession ??
  mongoose.model<IProctoringSession>(
    "ProctoringSession",
    ProctoringSessionSchema
  )

export default ProctoringSession
