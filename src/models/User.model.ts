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
    isActive: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: true },
  },
  { timestamps: true }
)

const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", UserSchema)

export default User
