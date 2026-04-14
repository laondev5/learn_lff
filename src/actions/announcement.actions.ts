"use server"

import { z } from "zod"
import { connectDB } from "@/lib/mongoose"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import Announcement from "@/models/Announcement.model"
import Course from "@/models/Course.model"
import StudentProgress from "@/models/StudentProgress.model"

const announcementSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  content: z.string().min(10, "Content must be at least 10 characters"),
})

// ─── Teacher Actions ──────────────────────────────────────────────────────────

export async function createAnnouncement(courseId: string, formData: FormData) {
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") return { error: "Unauthorized" }

  const parsed = announcementSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  await connectDB()
  const course = await Course.findOne({ _id: courseId, teacher: session.user.id }).lean()
  if (!course) return { error: "Course not found" }

  await Announcement.create({
    ...parsed.data,
    course: courseId,
    teacher: session.user.id,
  })

  revalidatePath(`/teacher/courses/${courseId}/announcements`)
  return { success: true }
}

export async function deleteAnnouncement(announcementId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") return { error: "Unauthorized" }

  await connectDB()
  const ann = await Announcement.findById(announcementId).lean()
  if (!ann) return { error: "Not found" }

  await Announcement.findByIdAndDelete(announcementId)
  revalidatePath(`/teacher/courses/${ann.course.toString()}/announcements`)
  return { success: true }
}

export async function getCourseAnnouncements(courseId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") return []

  await connectDB()
  const anns = await Announcement.find({ course: courseId })
    .sort({ createdAt: -1 })
    .lean()

  return anns.map((a) => ({
    id: a._id.toString(),
    title: a.title,
    content: a.content,
    isPublished: a.isPublished,
    createdAt: a.createdAt.toISOString(),
  }))
}

// ─── Student Actions ──────────────────────────────────────────────────────────

export async function getAnnouncementsForStudent(courseId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "student") return []

  await connectDB()
  const enrolled = await StudentProgress.exists({
    student: session.user.id,
    course: courseId,
  })
  if (!enrolled) return []

  const anns = await Announcement.find({ course: courseId, isPublished: true })
    .sort({ createdAt: -1 })
    .lean()

  return anns.map((a) => ({
    id: a._id.toString(),
    title: a.title,
    content: a.content,
    createdAt: a.createdAt.toISOString(),
  }))
}

export async function getAllStudentAnnouncements() {
  const session = await auth()
  if (!session?.user || session.user.role !== "student") return []

  await connectDB()
  const progresses = await StudentProgress.find({ student: session.user.id }).lean()
  const courseIds = progresses.map((p) => p.course)

  const anns = await Announcement.find({ course: { $in: courseIds }, isPublished: true })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate("course", "title")
    .lean()

  return anns.map((a) => {
    const course = a.course as unknown as { _id: { toString(): string }; title: string }
    return {
      id: a._id.toString(),
      title: a.title,
      content: a.content,
      courseTitle: course?.title ?? "Unknown Course",
      courseId: course?._id?.toString() ?? "",
      createdAt: a.createdAt.toISOString(),
    }
  })
}

// ─── Analytics (Teacher) ──────────────────────────────────────────────────────

export async function getTeacherAnalytics(courseId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") return null

  await connectDB()
  const course = await Course.findOne({ _id: courseId, teacher: session.user.id }).lean()
  if (!course) return null

  const progresses = await StudentProgress.find({ course: courseId })
    .populate("student", "name email")
    .lean()

  const stats = {
    totalEnrolled: progresses.length,
    examPassed: progresses.filter((p) => p.examPassed).length,
    certificatesIssued: progresses.filter((p) => p.certificateIssued).length,
    students: progresses.map((p) => {
      const student = p.student as unknown as { _id: { toString(): string }; name: string; email: string }
      return {
        id: student._id.toString(),
        name: student.name,
        email: student.email,
        completedLessons: p.completedLessons.length,
        completedModules: p.completedModules.length,
        examPassed: p.examPassed,
        examScore: p.examScore ?? null,
        certificateIssued: p.certificateIssued,
        enrolledAt: p.enrolledAt.toISOString(),
      }
    }),
  }

  return {
    courseTitle: course.title,
    ...stats,
  }
}

export async function getTeacherAllCoursesAnalytics() {
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") return []

  await connectDB()
  const courses = await Course.find({ teacher: session.user.id }).lean()

  const results = await Promise.all(
    courses.map(async (c) => {
      const enrolled = await StudentProgress.countDocuments({ course: c._id })
      const passed = await StudentProgress.countDocuments({ course: c._id, examPassed: true })
      return {
        id: c._id.toString(),
        title: c.title,
        isPublished: c.isPublished,
        enrolled,
        passed,
      }
    })
  )
  return results
}
