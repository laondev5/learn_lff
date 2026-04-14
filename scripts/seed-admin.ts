import mongoose from "mongoose"
import bcryptjs from "bcryptjs"
import * as dotenv from "dotenv"
import path from "path"

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })

const MONGODB_URI = process.env.MONGODB_URI!

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI not found in .env.local")
  process.exit(1)
}

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    hashedPassword: { type: String, required: true },
    role: { type: String, enum: ["admin", "teacher", "student"], required: true },
    cohort: { type: String, trim: true },
    avatarUrl: { type: String },
    isActive: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: true },
  },
  { timestamps: true }
)

const User = mongoose.models.User ?? mongoose.model("User", UserSchema)

// ── Admin credentials ─────────────────────────────────────────────────────────
const ADMIN = {
  name: "Super Admin",
  email: "admin@lff.com",
  password: "Admin@1234",   // ← change after first login
  role: "admin" as const,
  mustChangePassword: false,
}
// ─────────────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("🔌 Connecting to MongoDB…")
  await mongoose.connect(MONGODB_URI, { bufferCommands: false })
  console.log("✅ Connected")

  const existing = await User.findOne({ email: ADMIN.email })
  if (existing) {
    console.log(`⚠️  Admin already exists: ${ADMIN.email}`)
    await mongoose.disconnect()
    return
  }

  const hashedPassword = await bcryptjs.hash(ADMIN.password, 12)

  await User.create({ ...ADMIN, hashedPassword })

  console.log("🎉 Admin seeded successfully!")
  console.log(`   Email   : ${ADMIN.email}`)
  console.log(`   Password: ${ADMIN.password}`)
  console.log("   ⚠️  Change your password after first login.")

  await mongoose.disconnect()
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err)
  process.exit(1)
})
