import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { uploadR2Image } from "@/lib/r2-files"

const MAX_BYTES = 10 * 1024 * 1024

const IMAGE_TYPES: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/gif": ["gif"],
}

/** Folders each role may write to. Anything else is rejected. */
const ALLOWED_FOLDERS: Record<string, string[]> = {
  admin: ["lff-lms/covers", "lff-lms/system", "lff-lms/certificates", "lff-lms/avatars", "kyc"],
  teacher: ["lff-lms/covers", "lff-lms/avatars"],
  student: ["kyc", "lff-lms/avatars"],
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get("file")
  const folder = typeof formData.get("folder") === "string" ? (formData.get("folder") as string) : "lff-lms"

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  const allowed = ALLOWED_FOLDERS[session.user.role] ?? []
  if (!allowed.includes(folder)) {
    return NextResponse.json({ error: "Upload destination not allowed" }, { status: 403 })
  }

  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File must be between 1 byte and 10 MB" }, { status: 400 })
  }

  const ext = (file.name.split(".").pop() ?? "").toLowerCase()
  const allowedExtensions = IMAGE_TYPES[file.type]
  if (!allowedExtensions || !allowedExtensions.includes(ext)) {
    return NextResponse.json({ error: "Only jpg, png, webp or gif images are allowed" }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await uploadR2Image(buffer, folder, ext, file.type)
    return NextResponse.json({ url: result.url, key: result.key })
  } catch (error: unknown) {
    console.error("[UPLOAD]", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
