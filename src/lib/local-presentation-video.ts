import { readFile, stat } from "node:fs/promises"
import { createReadStream } from "node:fs"
import { Readable } from "node:stream"
import path from "node:path"

/** Local presentation only. Called after the normal lesson access checks. */
export async function localPresentationVideo(lessonId: string, range: string | null): Promise<Response | null> {
  if (process.env.NODE_ENV !== "development") return null
  let files: Record<string, string>
  try {
    files = JSON.parse(await readFile(path.join(process.cwd(), ".local-video-map.json"), "utf8"))
  } catch { return null }
  const file = files[lessonId]
  if (!file) return null
  const { size } = await stat(file)
  let start = 0
  let end = size - 1
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range)
    if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } })
    if (!match[1]) start = Math.max(0, size - Number(match[2]))
    else {
      start = Number(match[1])
      if (match[2]) end = Math.min(end, Number(match[2]))
    }
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } })
  }
  const headers: Record<string, string> = {
    "Content-Type": "video/mp4", "Accept-Ranges": "bytes",
    "Content-Length": String(end - start + 1), "Cache-Control": "private, no-store",
  }
  if (range) headers["Content-Range"] = `bytes ${start}-${end}/${size}`
  const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream<Uint8Array>
  return new Response(stream, { status: range ? 206 : 200, headers })
}
