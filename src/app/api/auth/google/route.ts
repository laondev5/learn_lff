import { createGoogleAuthUrl, GOOGLE_STATE_COOKIE, GOOGLE_STATE_MAX_AGE_SECONDS } from "@/lib/google-calendar"
import { auth } from "@/auth"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()

  if (!session || session.user.role !== "teacher") {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const { url, state } = createGoogleAuthUrl()

  const response = NextResponse.redirect(url)
  response.cookies.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth",
    maxAge: GOOGLE_STATE_MAX_AGE_SECONDS,
  })

  return response
}
