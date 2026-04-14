"use server"

import { z } from "zod"
import bcryptjs from "bcryptjs"
import { connectDB } from "@/lib/mongoose"
import User from "@/models/User.model"
import ChatForum from "@/models/ChatForum.model"
import { ORDINATION_OPTIONS } from "@/lib/constants"
import { sendEmail, credentialsEmailHtml } from "@/lib/email"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"

const createUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["teacher", "student"]),
  cohort: z.string().optional(),
  church: z.string().optional(),
  district: z.string().optional(),
})

const updateProfileSchema = z.object({
  country: z.string().min(1, "Country is required"),
  state: z.string().min(1, "State is required"),
  city: z.string().min(1, "City is required"),
  ordination: z.enum(ORDINATION_OPTIONS as unknown as [string, ...string[]], {
    message: "Please select an ordination",
  }),
})

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

export async function createUser(formData: FormData) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return { error: "Unauthorized" }
  }

  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    cohort: formData.get("cohort") || undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { name, email, role, cohort, church, district } = parsed.data

  await connectDB()

  const existing = await User.findOne({ email })
  if (existing) return { error: "A user with this email already exists" }

  const tempPassword = generateTempPassword()
  const hashedPassword = await bcryptjs.hash(tempPassword, 12)

  await User.create({
    name,
    email,
    hashedPassword,
    role,
    cohort: cohort || undefined,
    church: church || undefined,
    district: district || undefined,
    mustChangePassword: true,
  })

  // Ensure forums exist for Admin UI
  await ChatForum.findOneAndUpdate(
    { type: "general" },
    { $setOnInsert: { name: "General", description: "General discussion for all members" } },
    { upsert: true }
  )
  if (cohort) {
    await ChatForum.findOneAndUpdate(
      { type: "cohort", cohort },
      { $setOnInsert: { name: cohort } },
      { upsert: true }
    )
  }

  try {
    await sendEmail({
      to: email,
      subject: "Welcome to LFF Learning Management System",
      html: credentialsEmailHtml(name, email, tempPassword),
    })
  } catch {
    // User created but email failed — return partial success
    return { success: true, emailFailed: true }
  }

  revalidatePath("/admin/users")
  return { success: true }
}

export async function toggleUserStatus(userId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return { error: "Unauthorized" }
  }

  await connectDB()
  const user = await User.findById(userId)
  if (!user) return { error: "User not found" }

  user.isActive = !user.isActive
  await user.save()

  revalidatePath("/admin/users")
  return { success: true, isActive: user.isActive }
}

export async function deleteUser(userId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return { error: "Unauthorized" }
  }

  await connectDB()
  await User.findByIdAndDelete(userId)

  revalidatePath("/admin/users")
  return { success: true }
}

export async function updateProfile(formData: FormData) {
  const session = await auth()
  if (!session?.user || !["teacher", "student"].includes(session.user.role ?? "")) {
    return { error: "Unauthorized" }
  }

  const parsed = updateProfileSchema.safeParse({
    country: formData.get("country"),
    state: formData.get("state"),
    city: formData.get("city"),
    ordination: formData.get("ordination"),
  })

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  await connectDB()
  await User.findByIdAndUpdate(session.user.id, {
    country: parsed.data.country,
    state: parsed.data.state,
    city: parsed.data.city,
    ordination: parsed.data.ordination,
  })

  revalidatePath(`/${session.user.role}/profile`)
  return { success: true }
}

export async function getUsers(role?: "teacher" | "student") {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return []
  }

  await connectDB()
  const query = role ? { role } : { role: { $in: ["teacher", "student"] } }
  const users = await User.find(query).sort({ createdAt: -1 }).lean()

  return users.map((u) => ({
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    role: u.role,
    cohort: u.cohort,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
  }))
}
