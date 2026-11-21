import { auth } from "@/auth"
import { startR2Upload, validateUploadToken, signR2Part, completeR2Upload, abortR2Upload, parseR2Url } from "@/lib/r2"
import { destroyCloudinaryMedia } from "@/lib/media-cleanup"
import { connectDB } from "@/lib/mongoose"

export const runtime = "nodejs"
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "teacher") return Response.json({ error: "Unauthorized" }, { status: 401 })
  const origin = request.headers.get("origin")
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Forbidden" }, { status: 403 })
  if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "JSON required" }, { status: 415 })
  try {
    const text = await request.text()
    if (text.length > 12000) return Response.json({ error: "Request too large" }, { status: 413 })
    const body = JSON.parse(text)
    const teacher = session.user.id
    if (body.action === "start") return Response.json(await startR2Upload(teacher, body.size, body.contentType))
    if (body.action === "discard") {
      const asset = parseR2Url(body.url)
      if (!asset || !asset.startsWith(`teachers/${teacher}/videos/`)) return Response.json({ error: "Forbidden" }, { status: 403 })
      await connectDB()
      const result = await destroyCloudinaryMedia([body.url])
      return Response.json({ success: result.failed.length === 0 })
    }
    const upload = validateUploadToken(body.token, teacher)
    if (body.action === "part") return Response.json({ url: await signR2Part(upload, body.part) })
    if (body.action === "complete") return Response.json({ videoUrl: await completeR2Upload(upload) })
    if (body.action === "abort") { await abortR2Upload(upload); return Response.json({ success: true }) }
    return Response.json({ error: "Unknown action" }, { status: 400 })
  } catch {
    // Never serialize SDK errors: they can contain signed requests or credentials.
    return Response.json({ error: "Video upload request failed. Check the file, connection, and upload session." }, { status: 400 })
  }
}
