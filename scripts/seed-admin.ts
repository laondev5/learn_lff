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

// ── Admin credentials ─────────────────────────────────────────────────────────
// The password is never stored in this file. Create it once, out of band:
//   SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD='...' pnpm seed:admin
// A strong random one: openssl rand -base64 24
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? missing("SEED_ADMIN_EMAIL")
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? missing("SEED_ADMIN_PASSWORD")

function missing(name: string): never {
  console.error(`❌ ${name} is not set. Pass it in the shell, do not commit it to a file.`)
  process.exit(1)
}

if (ADMIN_PASSWORD.length < 12) {
  console.error("❌ SEED_ADMIN_PASSWORD must be at least 12 characters.")
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

async function seed() {
  console.log("🔌 Connecting to MongoDB…")
  await mongoose.connect(MONGODB_URI, { bufferCommands: false })
  console.log("✅ Connected")

  const existing = await User.findOne({ email: ADMIN_EMAIL })
  if (existing) {
    console.log(`⚠️  Admin already exists: ${ADMIN_EMAIL}`)
    await mongoose.disconnect()
    return
  }

  const hashedPassword = await bcryptjs.hash(ADMIN_PASSWORD, 12)

  await User.create({
    name: "Super Admin",
    email: ADMIN_EMAIL,
    role: "admin",
    mustChangePassword: true,
    hashedPassword,
  })

  console.log("🎉 Admin seeded successfully!")
  console.log(`   Email   : ${ADMIN_EMAIL}`)
  console.log("   Password was taken from SEED_ADMIN_PASSWORD and is not shown here.")
  console.log("   The account must change it on first login.")

  await mongoose.disconnect()
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err)
  process.exit(1)
})
