import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { connectDB } from "@/lib/mongoose"
import Assessment from "@/models/Assessment.model"
import Course from "@/models/Course.model"
import { assessmentSchema } from "@/lib/validations/assessment"

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== "teacher") {
      return NextResponse.json({ error: "Unauthorized. Teacher access only." }, { status: 401 })
    }

    const body = await req.json()
    const parsed = assessmentSchema.safeParse(body)
    
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    await connectDB()

    // Ensure the teacher owns the course
    const course = await Course.findOne({ _id: parsed.data.courseId, teacher: session.user.id })
    if (!course) {
      return NextResponse.json({ error: "Course not found or unauthorized access" }, { status: 404 })
    }

    // Calculate total marks if not provided
    const totalMarks = parsed.data.totalMarks ?? parsed.data.questions.reduce((sum, q) => sum + q.points, 0)

    const assessment = await Assessment.create({
      ...parsed.data,
      course: parsed.data.courseId,
      module: parsed.data.moduleId,
      totalMarks,
      createdBy: session.user.id,
    })

    return NextResponse.json({ success: true, assessment }, { status: 201 })
  } catch (error: unknown) {
    console.error("[ASSESSMENT_POST]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const courseId = searchParams.get("courseId")
    const type = searchParams.get("type")
    const moduleId = searchParams.get("moduleId")

    if (!courseId) {
      return NextResponse.json({ error: "courseId is required" }, { status: 400 })
    }

    await connectDB()

    const query: Record<string, unknown> = { course: courseId }
    if (type) query.type = type
    if (moduleId) query.module = moduleId

    const assessments = await Assessment.find(query)
      .sort({ createdAt: -1 })
      .populate("module", "title")

    return NextResponse.json({ assessments })
  } catch (error: unknown) {
    console.error("[ASSESSMENT_GET]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
