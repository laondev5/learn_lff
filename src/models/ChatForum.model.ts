import "server-only"
import mongoose, { Document, Model, Schema, Types } from "mongoose"

export type ForumType = "cohort" | "general"

export interface IChatForum extends Document {
  name: string
  type: ForumType
  cohort?: string
  description?: string
  createdAt: Date
  updatedAt: Date
}

const ChatForumSchema = new Schema<IChatForum>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["cohort", "general"], required: true },
    cohort: { type: String, trim: true },
    description: { type: String },
  },
  { timestamps: true }
)

const ChatForum: Model<IChatForum> =
  mongoose.models.ChatForum ?? mongoose.model<IChatForum>("ChatForum", ChatForumSchema)

export default ChatForum
