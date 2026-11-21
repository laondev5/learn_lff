import { NextRequest, NextResponse } from "next/server"
import { readR2Image } from "@/lib/r2-files"

/** Streams uploaded images from the private R2 bucket. Keys never escape the images/ prefix. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params
  const objectKey = key.map(decodeURIComponent).join("/")
  if (!objectKey || objectKey.split("/").some((part) => !part || part === "." || part === "..")) {
    return new NextResponse("Not found", { status: 404 })
  }

  try {
    const object = await readR2Image(objectKey)
    if (!object) return new NextResponse("Not found", { status: 404 })
    return new NextResponse(Buffer.from(object.bytes), {
      headers: {
        "Content-Type": object.contentType,
        "Cache-Control": object.cacheControl,
        "Content-Length": String(object.bytes.byteLength),
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return new NextResponse("Not found", { status: 404 })
  }
}
