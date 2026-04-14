import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import cloudinary from "@/lib/cloudinary"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const folder = (formData.get("folder") as string) || "lff-lms"

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const base64 = `data:${file.type};base64,${buffer.toString("base64")}`

  const result = await cloudinary.uploader.upload(base64, {
    folder,
    resource_type: "auto",
  })

  return NextResponse.json({
    url: result.secure_url,
    publicId: result.public_id,
  })
}
