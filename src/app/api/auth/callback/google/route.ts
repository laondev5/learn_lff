import { getTokensFromCode } from "@/lib/google-calendar"
import { auth } from "@/auth"
import { connectDB } from "@/lib/mongoose"
import User from "@/models/User.model"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")

  if (!code) {
    return NextResponse.redirect(new URL("/teacher/profile?error=No code provided", request.url))
  }

  const session = await auth()
  if (!session || !session.user.id) {
    return NextResponse.redirect(new URL("/auth/login", request.url))
  }

  try {
    const tokens = await getTokensFromCode(code)

    await connectDB()
    await User.findByIdAndUpdate(session.user.id, {
      googleAccessToken: tokens.access_token,
      googleRefreshToken: tokens.refresh_token,
      googleTokenExpiry: tokens.expiry_date,
    })

    return NextResponse.redirect(new URL("/teacher/profile?success=Google Calendar connected", request.url))
  } catch (error) {
    console.error("Error exchanging code for tokens:", error)
    return NextResponse.redirect(new URL("/teacher/profile?error=Failed to connect Google Calendar", request.url))
  }
}
