import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongoose"
import User from "@/models/User.model"
import { passwordResetEmailHtml, sendEmail } from "@/lib/email"
import { createResetToken } from "@/lib/password-reset"
import { checkRateLimit } from "@/lib/rate-limit"
import { writeSecurityAuditLog } from "@/lib/security-audit"
import { getAppUrl } from "@/lib/app-url"

function clientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  )
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const email = String(body?.email || "").trim().toLowerCase()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 })
  }

  const ip = clientIp(request)

  const [byEmail, byIp] = await Promise.all([
    checkRateLimit("forgot-email", email, 5, 3600),
    checkRateLimit("forgot-ip", ip, 20, 3600),
  ])

  if (!byEmail.allowed || !byIp.allowed) {
    await writeSecurityAuditLog({
      event: "password_reset_requested",
      email,
      status: "blocked",
      ipAddress: ip,
      userAgent: request.headers.get("user-agent") || undefined,
      metadata: { reason: "rate_limited" },
    })

    return NextResponse.json(
      { ok: false, error: "Too many reset requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.max(byEmail.retryAfterSeconds, byIp.retryAfterSeconds)) },
      }
    )
  }

  // Every branch below answers the same way, so this endpoint cannot confirm
  // whether an address has an LFF LMS account.
  const accepted = () => NextResponse.json({ ok: true })

  await connectDB()
  const user = await User.findOne({ email, isActive: true })

  if (!user) {
    await writeSecurityAuditLog({
      event: "password_reset_requested",
      email,
      status: "success",
      ipAddress: ip,
      userAgent: request.headers.get("user-agent") || undefined,
      metadata: { accountFound: false },
    })
    return accepted()
  }

  const { token, tokenHash, expiresAt } = createResetToken()

  await User.updateOne(
    { _id: user._id },
    { $set: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt } }
  )

  const resetUrl = `${getAppUrl()}/auth/reset-password?token=${token}`

  try {
    await sendEmail({
      to: user.email,
      subject: "Reset your LFF LMS password",
      html: passwordResetEmailHtml(user.name, resetUrl, expiresAt),
    })

    await writeSecurityAuditLog({
      event: "password_reset_requested",
      targetUserId: user._id.toString(),
      email: user.email,
      role: user.role,
      status: "success",
      ipAddress: ip,
      userAgent: request.headers.get("user-agent") || undefined,
    })
  } catch (error) {
    console.error("Failed to send password reset email:", error)

    await User.updateOne(
      { _id: user._id },
      { $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 } }
    )

    await writeSecurityAuditLog({
      event: "password_reset_requested",
      targetUserId: user._id.toString(),
      email: user.email,
      role: user.role,
      status: "failure",
      ipAddress: ip,
      userAgent: request.headers.get("user-agent") || undefined,
    })
  }

  return accepted()
}
