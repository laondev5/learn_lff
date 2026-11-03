import { NextRequest, NextResponse } from "next/server"
import { getTokensFromCode, verifyGoogleAuthState, GOOGLE_STATE_COOKIE } from "@/lib/google-calendar"
import { auth } from "@/auth"
import { connectDB } from "@/lib/mongoose"
import User from "@/models/User.model"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get("code")

  const clearState = (response: NextResponse) => {
    response.cookies.delete(GOOGLE_STATE_COOKIE)
    return response
  }

  if (!code) {
    return clearState(
      NextResponse.redirect(new URL("/teacher/profile?error=No+code+provided", request.url))
    )
  }

  if (!verifyGoogleAuthState(searchParams.get("state"), request.cookies.get(GOOGLE_STATE_COOKIE)?.value)) {
    return clearState(
      NextResponse.redirect(new URL("/teacher/profile?error=Google+login+could+not+be+verified", request.url))
    )
  }

  const session = await auth()
  if (!session || !session.user.id) {
    return clearState(NextResponse.redirect(new URL("/auth/login", request.url)))
  }

  try {
    const tokens = await getTokensFromCode(code)

    await connectDB()
    await User.findByIdAndUpdate(session.user.id, {
      googleAccessToken: tokens.access_token,
      googleRefreshToken: tokens.refresh_token,
      googleTokenExpiry: tokens.expiry_date,
    })

    return clearState(
      NextResponse.redirect(new URL("/teacher/profile?success=Google+Calendar+connected", request.url))
    )
  } catch (error) {
    console.error("Error exchanging code for tokens:", error)
    return clearState(
      NextResponse.redirect(new URL("/teacher/profile?error=Failed+to+connect+Google+Calendar", request.url))
    )
  }
}
