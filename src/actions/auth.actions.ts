"use server"

import bcryptjs from "bcryptjs"
import { connectDB } from "@/lib/mongoose"
import { auth } from "@/auth"
import User from "@/models/User.model"
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from "@/lib/password-policy"
import { writeSecurityAuditLog } from "@/lib/security-audit"

export async function changePassword(currentPassword: string, newPassword: string) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }

  await connectDB()
  const user = await User.findById(session.user.id)
  if (!user) return { error: "User not found" }

  const isValid = await bcryptjs.compare(currentPassword, user.hashedPassword)
  if (!isValid) return { error: "Current password is incorrect" }

  if (!isStrongPassword(newPassword)) {
    return { error: PASSWORD_POLICY_MESSAGE }
  }

  user.hashedPassword = await bcryptjs.hash(newPassword, 12)
  user.mustChangePassword = false
  user.temporaryPasswordIssuedAt = undefined
  user.temporaryPasswordExpiresAt = undefined
  user.passwordChangedAt = new Date()
  await user.save()

  await writeSecurityAuditLog({
    event: "password_changed",
    actorUserId: user._id.toString(),
    targetUserId: user._id.toString(),
    email: user.email,
    role: user.role,
    status: "success",
    metadata: {
      completedFirstLoginPasswordChange: true,
    },
  })

  return { success: true, role: user.role as string, email: user.email }
}
