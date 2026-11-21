import mongoose from "mongoose"
import { Schema } from "mongoose"

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://adminUser:Skkywalker1998@178.238.226.251:27017/lff_lms?authSource=admin"

const UserSchema = new Schema(
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
    ordination: { type: String },
    avatarUrl: { type: String },
    googleAccessToken: { type: String },
    googleRefreshToken: { type: String },
    googleTokenExpiry: { type: Number },
    accountabilityPartner: {
      name: { type: String, trim: true },
      email: { type: String, lowercase: true, trim: true },
      phone: { type: String, trim: true },
      location: { type: String, trim: true },
    },
    kycStatus: { type: String, enum: ["not_started", "pending", "verified", "rejected"], default: "not_started" },
    kycLivePhotoUrl: { type: String },
    kycIdType: { type: String, enum: ["nin", "passport", "driver_license", "voter_card"] },
    kycIdNumber: { type: String },
    kycDateOfBirth: { type: Date },
    kycAddress: { type: String },
    kycSubmittedAt: { type: Date },
    isActive: { type: Boolean, required: true },
    mustChangePassword: { type: Boolean, required: true },
    temporaryPasswordIssuedAt: { type: Date },
    temporaryPasswordExpiresAt: { type: Date },
    onboardingEmailSentAt: { type: Date },
    onboardingEmailFailedAt: { type: Date },
    passwordChangedAt: { type: Date },
    passwordResetTokenHash: { type: String },
    passwordResetExpiresAt: { type: Date },
  },
  { timestamps: true },
)

const User = mongoose.models.User || mongoose.model("User", UserSchema)

async function main() {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 })
  try {
    const saltRounds = 12
    const bcrypt = await import("bcryptjs")
    const password = "@#Skkywalker1998@$S"
    const hash = await bcrypt.hash(password, saltRounds)

    const existing = await User.findOne({ email: "admin@learn.livingfaithfoundation.org" })
    if (existing) {
      existing.hashedPassword = hash
      existing.role = "admin"
      existing.isActive = true
      existing.mustChangePassword = false
      existing.name = existing.name || "Living Faith Foundation Admin"
      await existing.save()
      console.log("UPDATED:", {
        email: existing.email,
        role: existing.role,
        isActive: existing.isActive,
        mustChangePassword: existing.mustChangePassword,
        mongoId: existing._id.toString(),
      })
    } else {
      const created = await User.create({
        name: "Living Faith Foundation Admin",
        email: "admin@learn.livingfaithfoundation.org",
        hashedPassword: hash,
        role: "admin",
        isActive: true,
        mustChangePassword: false,
      })
      console.log("CREATED:", {
        email: created.email,
        role: created.role,
        isActive: created.isActive,
        mustChangePassword: created.mustChangePassword,
        mongoId: created._id.toString(),
      })
    }
  } finally {
    await mongoose.disconnect()
  }
}

main().catch((e) => {
  console.error("ERR", e.message)
  process.exit(1)
})
