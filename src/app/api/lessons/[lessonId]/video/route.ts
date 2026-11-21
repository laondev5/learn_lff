import { getStudentModuleAccess } from "@/lib/cohort-access"
import { getR2PlaybackUrl, parseR2Url } from "@/lib/r2"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { connectDB } from "@/lib/mongoose"
import { Types } from "mongoose"
import Course from "@/models/Course.model"
import Lesson from "@/models/Lesson.model"
import PaymentTransaction from "@/models/PaymentTransaction.model"
import StudentProgress from "@/models/StudentProgress.model"
import { createReadStream } from "node:fs"
import { readFile, stat } from "node:fs/promises"
import path from "node:path"
import { Readable } from "node:stream"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/lessons/[lessonId]/video
 * Streams nobody: it re-checks access and hands back the stored media URL.
 * Lesson pages ship this endpoint instead of the raw URL so a paid video cannot
 * be played by someone who was never enrolled.
 *
 * Local presentation mode: when a lesson id appears in .local-video-map.json,
 * the mapped file on this laptop is streamed instead of the Cloudinary URL.
 * This keeps the LMS fully functional on localhost while Cloudinary is disabled.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ lessonId: string }> }
) {
  try {
    const { lessonId } = await context.params
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!Types.ObjectId.isValid(lessonId)) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    }

    await connectDB()
    const lesson = await Lesson.findById(lessonId).select("isPublished videoUrl course module").lean()
    if (!lesson?.videoUrl) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    }

    const course = await Course.findById(lesson.course).select("teacher isPaid price").lean()
    if (!course) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    }

    let allowed = false
    let expiresIn = 3600
    if (session.user.role === "admin") {
      allowed = true
    } else if (session.user.role === "teacher") {
      if (course.teacher?.toString() !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      allowed = true
    } else if (session.user.role === "student") {
      const access = await getStudentModuleAccess(session.user.id, String(lesson.course), String(lesson.module))
      if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: 403 })
      expiresIn = Math.min(expiresIn, Math.floor(((access.closesAt?.getTime() ?? Date.now()) - Date.now()) / 1000))
      if (expiresIn < 1) return NextResponse.json({ error: "Module access has expired" }, { status: 403 })
      if (!lesson.isPublished) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      const enrolled = await StudentProgress.exists({
        student: session.user.id,
        course: lesson.course,
      })
      if (!enrolled) {
        return NextResponse.json({ error: "Not enrolled in this course" }, { status: 403 })
      }

      if (course.isPaid) {
        const paid = await PaymentTransaction.exists({
          student: session.user.id,
          course: lesson.course,
          status: "success",
          amount: { $gte: course.price ?? 0 },
        })
        if (!paid) {
          return NextResponse.json({ error: "Payment required for this course" }, { status: 403 })
        }
      }
      allowed = true
    }

    if (!allowed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // R2 playback is signed only after checking the current student's deadline.
    if (parseR2Url(lesson.videoUrl)) return redirect(await getR2PlaybackUrl(lesson.videoUrl, expiresIn))

    // Local presentation fallback is restricted to development.
    const localFile = await lookupLocalVideo(lessonId)
    if (localFile) {
      const streamed = await streamLocalVideo(localFile, req)
      if (streamed) return streamed
    }

    return redirect(playbackUrl(lesson.videoUrl))
  } catch (error: unknown) {
    console.error("[LESSON_VIDEO_GET]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

function redirect(url: string) {
  return NextResponse.redirect(url, {
    status: 307,
    headers: { "Cache-Control": "private, no-store" },
  })
}

/** Cap streamed video at 720p without re-encoding. */
function playbackUrl(url: string) {
  if (url.includes("res.cloudinary.com") && url.includes("/video/upload/") && !url.includes("c_limit,")) {
    return url.replace("/video/upload/", "/video/upload/c_limit,w_1280,h_720,q_auto,vc_auto/")
  }
  return url
}

/** Read the presentation-only lesson-id -> local-file map. */
async function lookupLocalVideo(lessonId: string): Promise<string | null> {
  if (process.env.NODE_ENV !== "development") return null
  try {
    const mapPath = path.join(process.cwd(), ".local-video-map.json")
    const raw = await readFile(mapPath, "utf8")
    const map = JSON.parse(raw) as Record<string, string>
    const file = map[lessonId]
    if (!file) return null
    const st = await stat(file)
    return st.isFile() ? file : null
  } catch {
    return null
  }
}

/** Stream a local MP4 with HTTP Range support so the player can seek. */
async function streamLocalVideo(filePath: string, req: NextRequest): Promise<Response | null> {
  let size: number
  try {
    const st = await stat(filePath)
    if (!st.isFile()) return null
    size = st.size
  } catch {
    return null
  }

  const baseHeaders: Record<string, string> = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
  }

  const range = req.headers.get("range")
  if (!range) {
    const body = Readable.toWeb(createReadStream(filePath)) as unknown as ReadableStream
    return new Response(body, {
      status: 200,
      headers: { ...baseHeaders, "Content-Length": String(size) },
    })
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim())
  let start: number
  let end: number

  if (match && (match[1] || match[2])) {
    if (match[1] === "") {
      // suffix range: bytes=-500  => last 500 bytes
      const suffix = Number(match[2])
      if (!Number.isFinite(suffix) || suffix <= 0) return unsatisfiable(size)
      start = Math.max(0, size - suffix)
      end = size - 1
    } else {
      start = Number(match[1])
      end = match[2] === "" ? size - 1 : Number(match[2])
      if (!Number.isFinite(end) || end >= size) end = size - 1
    }
  } else {
    return unsatisfiable(size)
  }

  if (!Number.isFinite(start) || start < 0 || start >= size || end < start) {
    return unsatisfiable(size)
  }

  const body = Readable.toWeb(createReadStream(filePath, { start, end })) as unknown as ReadableStream
  return new Response(body, {
    status: 206,
    headers: {
      ...baseHeaders,
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${size}`,
    },
  })
}

function unsatisfiable(size: number): Response {
  return new Response(null, {
    status: 416,
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Range": `bytes */${size}`,
      "Cache-Control": "private, no-store",
    },
  })
}
