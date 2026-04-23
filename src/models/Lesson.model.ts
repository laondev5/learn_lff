import "server-only"
import mongoose, { Document, Model, Schema, Types } from "mongoose"

export interface IVideoCueQuestion {
  text: string
  type: "mcq" | "true_false" | "short_answer"
  options?: string[]
  correctAnswer: string
  points: number
}

export interface IVideoCue {
  _id?: Types.ObjectId
  timestamp: number // seconds into the video
  title: string
  questions: IVideoCueQuestion[]
}

export interface ILesson extends Document {
  title: string
  module: Types.ObjectId
  course: Types.ObjectId
  order: number
  lessonType: "video" | "text"
  content: string
  studentNotes?: string
  videoUrl?: string
  youtubeVideoId?: string
  videoCues: IVideoCue[]
  duration?: number
  isPublished: boolean
  createdAt: Date
  updatedAt: Date
}

const VideoCueQuestionSchema = new Schema<IVideoCueQuestion>(
  {
    text: { type: String, required: true },
    type: { type: String, enum: ["mcq", "true_false", "short_answer"], required: true },
    options: [{ type: String }],
    correctAnswer: { type: String, required: true },
    points: { type: Number, default: 1 },
  },
  { _id: false }
)

const VideoCueSchema = new Schema<IVideoCue>({
  timestamp: { type: Number, required: true },
  title: { type: String, required: true },
  questions: [VideoCueQuestionSchema],
})

const LessonSchema = new Schema<ILesson>(
  {
    title: { type: String, required: true, trim: true },
    module: { type: Schema.Types.ObjectId, ref: "Module", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    order: { type: Number, required: true, default: 0 },
    lessonType: { type: String, enum: ["video", "text"], default: "text" },
    content: { type: String, default: "" },
    studentNotes: { type: String, default: "" },
    videoUrl: { type: String },
    youtubeVideoId: { type: String },
    videoCues: [VideoCueSchema],
    duration: { type: Number },
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true }
)

LessonSchema.index({ module: 1, order: 1 })

const Lesson: Model<ILesson> =
  mongoose.models.Lesson ?? mongoose.model<ILesson>("Lesson", LessonSchema)

export default Lesson
