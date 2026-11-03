import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { connectDB } from "@/lib/mongoose"
import { Types } from "mongoose"
import Course from "@/models/Course.model"
import Lesson from "@/models/Lesson.model"
import PaymentTransaction from "@/models/PaymentTransaction.model"
import StudentProgress from "@/models/StudentProgress.model"

/**
 * GET /api/lessons/[lessonId]/video
 * Streams nobody: it re-checks access and hands back the stored media URL.
 * Lesson pages ship this endpoint instead of the raw URL so a paid video cannot
 * be played by someone who was never enrolled.
 */
export async function GET(
  _req: NextRequest,
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
    const lesson = await Lesson.findById(lessonId).select("isPublished videoUrl course").lean()
    if (!lesson?.videoUrl) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    }

    const course = await Course.findById(lesson.course).select("teacher isPaid price").lean()
    if (!course) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    }

    if (session.user.role === "admin") {
      return redirect(lesson.videoUrl)
    }
    if (session.user.role === "teacher") {
      if (course.teacher?.toString() !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      return redirect(lesson.videoUrl)
    }
    if (session.user.role !== "student") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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

    return redirect(lesson.videoUrl)
  } catch (error: unknown) {
    console.error("[LESSON_VIDEO_GET]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

function redirect(url: string) {
  return NextResponse.redirect(playbackUrl(url), {
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
