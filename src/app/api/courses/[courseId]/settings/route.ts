import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { connectDB } from "@/lib/mongoose"
import CourseSettings from "@/models/CourseSettings.model"
import Course from "@/models/Course.model"
import { courseSettingsSchema } from "@/lib/validations/assessment"

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await context.params
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await connectDB()

    const settings = await CourseSettings.findOne({ course: courseId })
    if (!settings) {
      return NextResponse.json({ 
        caWeight: 40, 
        examWeight: 60, 
        proctoringEnabled: false, 
        maxWarnings: 3 
      })
    }

    return NextResponse.json({ settings })
  } catch (error: unknown) {
    console.error("[COURSE_SETTINGS_GET]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await context.params
    const session = await auth()
    if (!session?.user || session.user.role !== "teacher") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const parsed = courseSettingsSchema.safeParse(body)
    
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    await connectDB()

    // Ensure teacher owns course
    const course = await Course.findOne({ _id: courseId, teacher: session.user.id })
    if (!course) {
      return NextResponse.json({ error: "Course not found or unauthorized" }, { status: 404 })
    }

    const settings = await CourseSettings.findOneAndUpdate(
      { course: courseId },
      { 
        ...parsed.data, 
        course: courseId,
        createdBy: session.user.id 
      },
      { new: true, upsert: true }
    )

    return NextResponse.json({ success: true, settings })
  } catch (error: unknown) {
    console.error("[COURSE_SETTINGS_PATCH]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
