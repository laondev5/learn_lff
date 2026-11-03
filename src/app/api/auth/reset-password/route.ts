import { NextRequest, NextResponse } from "next/server"
import bcryptjs from "bcryptjs"
import { connectDB } from "@/lib/mongoose"
import User from "@/models/User.model"
import { hashResetToken } from "@/lib/password-reset"
import { checkRateLimit } from "@/lib/rate-limit"
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from "@/lib/password-policy"
import { writeSecurityAuditLog } from "@/lib/security-audit"

function clientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  )
}

const INVALID_LINK = "This reset link is invalid or has expired. Please request a new one."

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const token = String(body?.token || "")
  const password = String(body?.password || "")
  const confirmPassword = String(body?.confirmPassword || "")

  if (!token || token.length > 256) {
    return NextResponse.json({ ok: false, error: INVALID_LINK }, { status: 400 })
  }

  if (password !== confirmPassword) {
    return NextResponse.json({ ok: false, error: "Passwords do not match." }, { status: 400 })
  }

  if (!isStrongPassword(password)) {
    return NextResponse.json({ ok: false, error: PASSWORD_POLICY_MESSAGE }, { status: 400 })
  }

  const ip = clientIp(request)
  const limit = await checkRateLimit("reset-token", ip, 20, 3600)

  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    )
  }

  await connectDB()

  const user = await User.findOne({ passwordResetTokenHash: hashResetToken(token) }).select(
    "+passwordResetTokenHash"
  )
  const expired = !user?.passwordResetExpiresAt || user.passwordResetExpiresAt.getTime() < Date.now()

  if (!user || expired || !user.isActive) {
    await writeSecurityAuditLog({
      event: "password_reset_completed",
      targetUserId: user?._id.toString(),
      email: user?.email,
      role: user?.role,
      status: "failure",
      ipAddress: ip,
      userAgent: request.headers.get("user-agent") || undefined,
      metadata: { reason: !user ? "unknown_token" : expired ? "expired" : "inactive_account" },
    })
    return NextResponse.json({ ok: false, error: INVALID_LINK }, { status: 400 })
  }

  const currentIsValid = await bcryptjs.compare(password, user.hashedPassword)
  if (currentIsValid) {
    return NextResponse.json(
      { ok: false, error: "Choose a password you have not used with this account before." },
      { status: 400 }
    )
  }

  user.hashedPassword = await bcryptjs.hash(password, 12)
  user.passwordResetTokenHash = undefined
  user.passwordResetExpiresAt = undefined
  user.mustChangePassword = false
  user.temporaryPasswordIssuedAt = undefined
  user.temporaryPasswordExpiresAt = undefined
  // Signing any other session out relies on this timestamp (see src/auth.ts).
  user.passwordChangedAt = new Date()
  await user.save()

  await writeSecurityAuditLog({
    event: "password_reset_completed",
    actorUserId: user._id.toString(),
    targetUserId: user._id.toString(),
    email: user.email,
    role: user.role,
    status: "success",
    ipAddress: ip,
    userAgent: request.headers.get("user-agent") || undefined,
  })

  return NextResponse.json({ ok: true })
}
