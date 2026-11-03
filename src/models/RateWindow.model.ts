import "server-only"
import mongoose, { Document, Model, Schema } from "mongoose"

export interface IRateWindow extends Document {
  key: string
  count: number
  expiresAt: Date
}

const RateWindowSchema = new Schema<IRateWindow>(
  {
    key: { type: String, required: true, unique: true },
    count: { type: Number, required: true, default: 1 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
)

// Mongo removes each document once it reaches its own expiry.
RateWindowSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const RateWindow: Model<IRateWindow> =
  mongoose.models.RateWindow ?? mongoose.model<IRateWindow>("RateWindow", RateWindowSchema)

export default RateWindow
