import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { connectDB } from "@/lib/mongoose"
import StudentProgress from "@/models/StudentProgress.model"
import Course from "@/models/Course.model"
import User from "@/models/User.model"
import { calculateStudentGrades } from "@/lib/assessment.service"

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await context.params
    const session = await auth()
    if (!session?.user || session.user.role !== "teacher") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const cohort = searchParams.get("cohort")
    const search = searchParams.get("search")
    const includeGrades = searchParams.get("includeGrades") === "true"

    await connectDB()

    // Ensure teacher owns course
    const course = await Course.findOne({ _id: courseId, teacher: session.user.id })
    if (!course) {
      return NextResponse.json({ error: "Course not found or unauthorized access" }, { status: 404 })
    }

    // Find all enrolled students
    const progressDocs = await StudentProgress.find({ course: courseId })
      .select("student enrolledAt progress")

    const studentIds = progressDocs.map(p => p.student)

    // Filter students by cohort and search
    const userQuery: Record<string, unknown> = { 
      _id: { $in: studentIds },
      role: "student" 
    }
    if (cohort) userQuery.cohort = cohort
    if (search) {
      userQuery.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ]
    }

    const students = await User.find(userQuery)
      .select("name email cohort avatarUrl isActive")
      .sort({ name: 1 })

    // Combine with progress data and optionally grades
    const result = await Promise.all(students.map(async (student) => {
      const progress = progressDocs.find(p => p.student.toString() === student._id.toString())
      
      let grades = null
      if (includeGrades) {
        grades = await calculateStudentGrades(courseId, student._id.toString())
      }

      return {
        ...student.toObject(),
        enrolledAt: progress?.enrolledAt,
        grades: grades ? {
          caContribution: grades.ca.contribution,
          examContribution: grades.exam.contribution,
          finalGrade: grades.finalGrade
        } : undefined
      }
    }))

    return NextResponse.json({ students: result })
  } catch (error: unknown) {
    console.error("[COURSE_STUDENTS_GET]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
