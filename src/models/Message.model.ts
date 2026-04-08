import mongoose, { Document, Model, Schema, Types } from "mongoose"

export interface IMessage extends Document {
  forum: Types.ObjectId
  sender: Types.ObjectId
  content: string
  createdAt: Date
}

const MessageSchema = new Schema<IMessage>(
  {
    forum: { type: Schema.Types.ObjectId, ref: "ChatForum", required: true },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
)

MessageSchema.index({ forum: 1, createdAt: -1 })

const Message: Model<IMessage> =
  mongoose.models.Message ?? mongoose.model<IMessage>("Message", MessageSchema)

export default Message
