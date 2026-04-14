import "server-only"
import mongoose, { Document, Model, Schema, Types } from "mongoose"

export interface IModule extends Document {
  title: string
  description?: string
  course: Types.ObjectId
  order: number
  isPublished: boolean
  createdAt: Date
  updatedAt: Date
}

const ModuleSchema = new Schema<IModule>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    order: { type: Number, required: true, default: 0 },
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true }
)

ModuleSchema.index({ course: 1, order: 1 })

const Module: Model<IModule> =
  mongoose.models.Module ?? mongoose.model<IModule>("Module", ModuleSchema)

export default Module
