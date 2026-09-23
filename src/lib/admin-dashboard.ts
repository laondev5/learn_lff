import { connectDB } from "@/lib/mongoose"
import Certificate from "@/models/Certificate.model"
import Course from "@/models/Course.model"
import StudentProgress from "@/models/StudentProgress.model"
import User from "@/models/User.model"

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short" })
}

export async function getAdminDashboardData() {
  await connectDB()

  const [
    totalStudents,
    totalTeachers,
    totalAdmins,
    totalCourses,
    publishedCourses,
    totalEnrollments,
    examPassed,
    totalCertificates,
    recentCerts,
    courses,
    progresses,
  ] = await Promise.all([
    User.countDocuments({ role: "student", isActive: true }),
    User.countDocuments({ role: "teacher", isActive: true }),
    User.countDocuments({ role: "admin", isActive: true }),
    Course.countDocuments(),
    Course.countDocuments({ isPublished: true }),
    StudentProgress.countDocuments(),
    StudentProgress.countDocuments({ examPassed: true }),
    Certificate.countDocuments(),
    Certificate.find()
      .sort({ issuedAt: -1 })
      .limit(5)
      .populate("student", "name email")
      .populate("course", "title")
      .lean(),
    Course.find().select("_id title isPublished").lean(),
    StudentProgress.find()
      .select("course examPassed certificateIssued enrolledAt")
      .lean(),
  ])

  const courseMap = new Map(
    courses.map((course) => [
      course._id.toString(),
      { title: course.title, isPublished: course.isPublished },
    ])
  )

  const topCourses = [...courseMap.entries()]
    .map(([courseId, course]) => {
      const related = progresses.filter((progress) => progress.course.toString() === courseId)
      const enrolled = related.length
      const passed = related.filter((progress) => progress.examPassed).length
      const certificates = related.filter((progress) => progress.certificateIssued).length

      return {
        courseId,
        title: course.title,
        isPublished: course.isPublished,
        enrolled,
        passed,
        certificates,
      }
    })
    .sort((a, b) => b.enrolled - a.enrolled)
    .slice(0, 6)

  const monthlyTrend = Array.from({ length: 6 }, (_, index) => {
    const date = new Date()
    date.setMonth(date.getMonth() - (5 - index), 1)
    date.setHours(0, 0, 0, 0)

    const nextDate = new Date(date)
    nextDate.setMonth(nextDate.getMonth() + 1, 1)

    const value = progresses.filter((progress) => {
      const enrolledAt = new Date(progress.enrolledAt)
      return enrolledAt >= date && enrolledAt < nextDate
    }).length

    return {
      label: monthLabel(date),
      value,
    }
  })

  const passRate = totalEnrollments > 0 ? Math.round((examPassed / totalEnrollments) * 100) : 0
  const certificateRate =
    totalEnrollments > 0 ? Math.round((totalCertificates / totalEnrollments) * 100) : 0

  return {
    totals: {
      totalStudents,
      totalTeachers,
      totalAdmins,
      totalCourses,
      publishedCourses,
      draftCourses: totalCourses - publishedCourses,
      totalEnrollments,
      examPassed,
      totalCertificates,
      passRate,
      certificateRate,
    },
    distribution: [
      { label: "Students", value: totalStudents, note: "Active learner accounts" },
      { label: "Teachers", value: totalTeachers, note: "Active instructor accounts" },
      { label: "Admins", value: totalAdmins, note: "Platform managers" },
    ],
    monthlyTrend,
    topCourses,
    recentCerts: recentCerts.map((cert) => {
      const student = cert.student as unknown as { name?: string; email?: string } | null
      const course = cert.course as unknown as { title?: string } | null

      return {
        id: cert._id.toString(),
        studentName: student?.name ?? "Unknown",
        studentEmail: student?.email ?? "",
        courseTitle: course?.title ?? "Unknown Course",
        issuedAt: cert.issuedAt.toISOString(),
      }
    }),
  }
}
