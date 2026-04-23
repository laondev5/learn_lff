import "server-only"
import mongoose, { Document, Model, Schema } from "mongoose"
import { ORDINATION_OPTIONS, type Ordination } from "@/lib/constants"

export type { Ordination }
export { ORDINATION_OPTIONS }

export type UserRole = "admin" | "teacher" | "student"

export interface IUser extends Document {
  name: string
  email: string
  hashedPassword: string
  role: UserRole
  cohort?: string
  church?: string
  district?: string
  country?: string
  state?: string
  city?: string
  ordination?: Ordination
  avatarUrl?: string
  googleAccessToken?: string
  googleRefreshToken?: string
  googleTokenExpiry?: number
  accountabilityPartner?: {
    name: string
    email: string
    location: string
  }
  kycStatus?: "not_started" | "pending" | "verified" | "rejected"
  kycLivePhotoUrl?: string
  kycIdType?: "nin" | "passport" | "driver_license" | "voter_card"
  kycIdNumber?: string
  kycDateOfBirth?: Date
  kycAddress?: string
  kycSubmittedAt?: Date
  isActive: boolean
  mustChangePassword: boolean
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    hashedPassword: { type: String, required: true },
    role: { type: String, enum: ["admin", "teacher", "student"], required: true },
    cohort: { type: String, trim: true },
    church: { type: String, trim: true },
    district: { type: String, trim: true },
    country: { type: String, trim: true },
    state: { type: String, trim: true },
    city: { type: String, trim: true },
    ordination: { type: String, enum: ORDINATION_OPTIONS },
    avatarUrl: { type: String },
    googleAccessToken: { type: String },
    googleRefreshToken: { type: String },
    googleTokenExpiry: { type: Number },
    accountabilityPartner: {
      name: { type: String, trim: true },
      email: { type: String, lowercase: true, trim: true },
      location: { type: String, trim: true },
    },
    kycStatus: {
      type: String,
      enum: ["not_started", "pending", "verified", "rejected"],
      default: "not_started",
    },
    kycLivePhotoUrl: { type: String },
    kycIdType: {
      type: String,
      enum: ["nin", "passport", "driver_license", "voter_card"],
    },
    kycIdNumber: { type: String, trim: true },
    kycDateOfBirth: { type: Date },
    kycAddress: { type: String, trim: true },
    kycSubmittedAt: { type: Date },
    isActive: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: true },
  },
  { timestamps: true }
)

const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", UserSchema)

export default User
