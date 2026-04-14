"use server"

import bcryptjs from "bcryptjs"
import { connectDB } from "@/lib/mongoose"
import { auth } from "@/auth"
import User from "@/models/User.model"

export async function changePassword(currentPassword: string, newPassword: string) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }

  await connectDB()
  const user = await User.findById(session.user.id)
  if (!user) return { error: "User not found" }

  const isValid = await bcryptjs.compare(currentPassword, user.hashedPassword)
  if (!isValid) return { error: "Current password is incorrect" }

  if (newPassword.length < 8) return { error: "Password must be at least 8 characters" }

  user.hashedPassword = await bcryptjs.hash(newPassword, 12)
  user.mustChangePassword = false
  await user.save()

  return { success: true, role: user.role as string, email: user.email }
}
