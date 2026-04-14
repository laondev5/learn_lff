import "server-only"
import mongoose, { Document, Model, Schema } from "mongoose"

export interface ISystemConfig extends Document {
  organizationName: string
  logoUrl?: string
  logoPublicId?: string
  signatureUrl?: string
  signaturePublicId?: string
  primaryColor?: string
  updatedAt: Date
}

const SystemConfigSchema = new Schema<ISystemConfig>(
  {
    organizationName: { type: String, default: "LFF" },
    logoUrl: { type: String },
    logoPublicId: { type: String },
    signatureUrl: { type: String },
    signaturePublicId: { type: String },
    primaryColor: { type: String, default: "#2563eb" },
  },
  { timestamps: true }
)

const SystemConfig: Model<ISystemConfig> =
  mongoose.models.SystemConfig ??
  mongoose.model<ISystemConfig>("SystemConfig", SystemConfigSchema)

export default SystemConfig
