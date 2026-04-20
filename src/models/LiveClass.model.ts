import "server-only"
import mongoose, { Document, Model, Schema, Types } from "mongoose"

export interface ILiveClass extends Document {
  title: string
  description: string
  startTime: Date
  endTime: Date
  meetLink: string
  googleEventId: string
  instructor: Types.ObjectId
  course?: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const LiveClassSchema = new Schema<ILiveClass>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    meetLink: { type: String, required: true },
    googleEventId: { type: String, required: true },
    instructor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course" },
  },
  { timestamps: true }
)

const LiveClass: Model<ILiveClass> =
  mongoose.models.LiveClass ?? mongoose.model<ILiveClass>("LiveClass", LiveClassSchema)

export default LiveClass
