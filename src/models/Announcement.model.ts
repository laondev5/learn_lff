import "server-only"
import mongoose, { Document, Model, Schema, Types } from "mongoose"

export interface IAnnouncement extends Document {
  title: string
  content: string
  course: Types.ObjectId
  teacher: Types.ObjectId
  isPublished: boolean
  createdAt: Date
  updatedAt: Date
}

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    teacher: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
)

AnnouncementSchema.index({ course: 1, createdAt: -1 })

const Announcement: Model<IAnnouncement> =
  mongoose.models.Announcement ??
  mongoose.model<IAnnouncement>("Announcement", AnnouncementSchema)

export default Announcement
