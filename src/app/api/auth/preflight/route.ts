import { NextRequest, NextResponse } from "next/server"
import { validateUserCredentials } from "@/lib/auth-credentials"
import { writeSecurityAuditLog } from "@/lib/security-audit"
import { getUserLandingPath } from "@/lib/auth-redirect"
import { checkRateLimit } from "@/lib/rate-limit"

function getIpAddress(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  )
}

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    {
      ok: false,
      error: "Too many sign-in attempts. Please try again later.",
      retryAfterSeconds,
    },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  )
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const email = String(body?.email || "").trim().toLowerCase()
  const password = String(body?.password || "")

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: "Email and password are required." },
      { status: 400 }
    )
  }

  const ip = getIpAddress(request)
  const [byEmail, byIp] = await Promise.all([
    checkRateLimit("login-email", email, 10, 900),
    checkRateLimit("login-ip", ip, 40, 900),
  ])
  if (!byEmail.allowed || !byIp.allowed) {
    await writeSecurityAuditLog({
      event: "login_rate_limited",
      email,
      status: "blocked",
      ipAddress: ip,
      userAgent: request.headers.get("user-agent") || undefined,
    })
    return tooManyRequests(Math.max(byEmail.retryAfterSeconds, byIp.retryAfterSeconds))
  }

  const validation = await validateUserCredentials(email, password)

  if (validation.status === "invalid") {
    return NextResponse.json(
      { ok: false, error: "Invalid email or password." },
      { status: 401 }
    )
  }

  if (validation.status === "temporary_password_expired") {
    await writeSecurityAuditLog({
      event: "temporary_password_login_blocked",
      targetUserId: validation.user._id.toString(),
      email: validation.user.email,
      role: validation.user.role,
      status: "blocked",
      ipAddress: getIpAddress(request),
      userAgent: request.headers.get("user-agent") || undefined,
      metadata: {
        temporaryPasswordExpiresAt:
          validation.user.temporaryPasswordExpiresAt?.toISOString(),
      },
    })

    return NextResponse.json(
      {
        ok: false,
        error:
          "Your temporary password has expired. Please contact your administrator for a new onboarding email.",
      },
      { status: 403 }
    )
  }

  return NextResponse.json({
    ok: true,
    redirectPath: getUserLandingPath({
      role: validation.user.role,
      mustChangePassword: validation.user.mustChangePassword,
    }),
  })
}
