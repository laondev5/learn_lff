import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { uploadVideoToYouTube } from "@/lib/youtube"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_REFRESH_TOKEN) {
    return NextResponse.json(
      { error: "YouTube API is not configured. Please contact the administrator." },
      { status: 503 }
    )
  }

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const title = (formData.get("title") as string) || "LFF LMS Lesson Video"
    const description = (formData.get("description") as string) || ""

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const maxSizeMB = 500
    if (file.size > maxSizeMB * 1024 * 1024) {
      return NextResponse.json(
        { error: `File size exceeds ${maxSizeMB}MB limit` },
        { status: 400 }
      )
    }

    const allowedTypes = ["video/mp4", "video/mpeg", "video/quicktime", "video/x-msvideo", "video/webm"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: mp4, mpeg, mov, avi, webm" },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await uploadVideoToYouTube(buffer, title, description, file.type)

    return NextResponse.json({ videoId: result.videoId, url: result.url })
  } catch (err) {
    console.error("YouTube upload error:", err)
    return NextResponse.json({ error: "Failed to upload video to YouTube" }, { status: 500 })
  }
}
