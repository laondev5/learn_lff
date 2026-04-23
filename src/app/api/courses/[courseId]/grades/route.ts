import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { connectDB } from "@/lib/mongoose"
import Course from "@/models/Course.model"
import { calculateStudentGrades } from "@/lib/assessment.service"

/**
 * GET /api/courses/[courseId]/grades
 * Returns the grade breakdown for a student in a course.
 * Students can only see their own grades.
 * Teachers can see any student's grade in their course.
 */
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

    const { searchParams } = new URL(req.url)
    const targetStudentId = searchParams.get("studentId") || session.user.id

    await connectDB()

    // 1. Authorization Check
    if (targetStudentId !== session.user.id) {
      // If requesting someone else's grade, must be a teacher of this course
      if (session.user.role !== "teacher") {
        return NextResponse.json({ error: "Forbidden. Only teachers can view other students' grades." }, { status: 403 })
      }

      const course = await Course.findOne({ _id: courseId, teacher: session.user.id })
      if (!course) {
        return NextResponse.json({ error: "Unauthorized. You do not teach this course." }, { status: 403 })
      }
    }

    // 2. Calculate Grades using the Engine from Step 6
    const grades = await calculateStudentGrades(courseId, targetStudentId)

    return NextResponse.json({ success: true, grades })

  } catch (error: unknown) {
    console.error("[COURSE_GRADES_GET]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
