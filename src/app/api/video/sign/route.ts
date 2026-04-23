import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import cloudinary from "@/lib/cloudinary"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const compress = searchParams.get("compress") === "true"

  const folder = "lff-lms/videos"
  const timestamp = Math.round(Date.now() / 1000)

  const paramsToSign: Record<string, string | number | boolean> = { folder, timestamp }
  
  if (compress) {
    paramsToSign.eager = "c_limit,w_1280,h_720,q_auto,vc_auto"
    paramsToSign.eager_async = true
  }

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET!
  )

  return NextResponse.json({
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    timestamp,
    signature,
    folder,
    eager: paramsToSign.eager,
    eagerAsync: paramsToSign.eager_async,
  })
}
