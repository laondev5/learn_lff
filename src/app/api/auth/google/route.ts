import { getAuthUrl } from "@/lib/google-calendar"
import { auth } from "@/auth"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()

  if (!session || session.user.role !== "teacher") {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const url = getAuthUrl()
  return NextResponse.redirect(url)
}
