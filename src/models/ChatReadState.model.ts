import "server-only"
import mongoose, { Document, Model, Schema, Types } from "mongoose"

/** When a user last opened a chat group, used for WhatsApp-style unread counts. */
export interface IChatReadState extends Document {
  user: Types.ObjectId
  forum: Types.ObjectId
  lastReadAt: Date
}

const ChatReadStateSchema = new Schema<IChatReadState>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  forum: { type: Schema.Types.ObjectId, ref: "ChatForum", required: true },
  lastReadAt: { type: Date, required: true, default: Date.now },
})

ChatReadStateSchema.index({ user: 1, forum: 1 }, { unique: true })

const ChatReadState: Model<IChatReadState> =
  mongoose.models.ChatReadState ?? mongoose.model<IChatReadState>("ChatReadState", ChatReadStateSchema)

export default ChatReadState
