import { NextRequest, NextResponse } from "next/server"
import { validateUserCredentials } from "@/lib/auth-credentials"
import { writeSecurityAuditLog } from "@/lib/security-audit"

function getIpAddress(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined
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

  return NextResponse.json({ ok: true })
}
