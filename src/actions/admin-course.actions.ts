"use server"

import { auth } from "@/auth"
import { connectDB } from "@/lib/mongoose"
import { revalidatePath } from "next/cache"
import { Types } from "mongoose"
import { z } from "zod"
import Course from "@/models/Course.model"
import Module from "@/models/Module.model"
import Lesson from "@/models/Lesson.model"
import StudentProgress from "@/models/StudentProgress.model"
import PaymentTransaction from "@/models/PaymentTransaction.model"
import User from "@/models/User.model"
import CertificateTemplate from "@/models/CertificateTemplate.model"
import { getCertificateDesign } from "@/lib/certificate"

async function adminActor() {
  const session = await auth()
  if (session?.user?.role !== "admin") return null
  return session.user
}

async function teacherExists(teacherId: string) {
  if (!Types.ObjectId.isValid(teacherId)) return false
  return !!(await User.exists({ _id: teacherId, role: "teacher" }))
}

const courseInputSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(160),
  description: z.string().trim().min(10, "Description must be at least 10 characters"),
  teacherId: z.string().regex(/^[a-f0-9]{24}$/i, "Choose the teacher who owns this course"),
  isPaid: z.boolean(),
  price: z.number().min(0).max(10_000_000),
})

function invalid(message: string | undefined) {
  return { error: message ?? "Check the course details and try again." } as const
}

export async function getAdminCourses() {
  if (!await adminActor()) return { error: "Unauthorized" } as const
  await connectDB()

  const [courses, teachers, moduleCounts, lessonCounts, enrollmentCounts] = await Promise.all([
    Course.find({}).populate("teacher", "name email").sort({ createdAt: -1 }).lean(),
    User.find({ role: "teacher", isActive: true }).select("name email").sort({ name: 1 }).lean(),
    Module.aggregate<{ _id: Types.ObjectId; count: number }>([{ $group: { _id: "$course", count: { $sum: 1 } } }]),
    Lesson.aggregate<{ _id: Types.ObjectId; count: number }>([{ $group: { _id: "$course", count: { $sum: 1 } } }]),
    StudentProgress.aggregate<{ _id: Types.ObjectId; count: number }>([{ $group: { _id: "$course", count: { $sum: 1 } } }]),
  ])

  const moduleMap = new Map(moduleCounts.map((m) => [String(m._id), m.count]))
  const lessonMap = new Map(lessonCounts.map((l) => [String(l._id), l.count]))
  const enrollmentMap = new Map(enrollmentCounts.map((e) => [String(e._id), e.count]))

  return {
    teachers: teachers.map((t) => ({ id: String(t._id), name: t.name, email: t.email })),
    courses: courses.map((c) => {
      const teacher = c.teacher as unknown as { _id: Types.ObjectId; name?: string; email?: string } | null
      return {
        id: String(c._id),
        title: c.title,
        description: c.description,
        isPaid: c.isPaid ?? false,
        price: c.price ?? 0,
        isPublished: c.isPublished,
        createdAt: c.createdAt.toISOString(),
        teacherId: teacher?._id ? String(teacher._id) : "",
        teacherName: teacher?.name ?? "Unassigned",
        modules: moduleMap.get(String(c._id)) ?? 0,
        lessons: lessonMap.get(String(c._id)) ?? 0,
        students: enrollmentMap.get(String(c._id)) ?? 0,
      }
    }),
  }
}

export async function createAdminCourse(formData: FormData) {
  if (!await adminActor()) return { error: "Unauthorized" } as const

  const parsed = courseInputSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    teacherId: formData.get("teacherId"),
    isPaid: formData.get("isPaid") === "true",
    price: Number(formData.get("price") ?? 0),
  })
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message)

  const coverImageUrl = formData.get("coverImageUrl")?.toString().trim()
  await connectDB()
  if (!await teacherExists(parsed.data.teacherId)) return invalid("Choose an active teacher for this course.")

  const course = await Course.create({
    title: parsed.data.title,
    description: parsed.data.description,
    teacher: parsed.data.teacherId,
    isPaid: parsed.data.isPaid,
    price: parsed.data.isPaid ? parsed.data.price : 0,
    ...(coverImageUrl && /^https:\/\//.test(coverImageUrl) ? { coverImageUrl } : {}),
  })

  revalidatePath("/admin/courses")
  revalidatePath("/teacher/courses")
  revalidatePath("/student/dashboard")
  return { success: true as const, courseId: String(course._id) }
}

export async function updateAdminCourse(courseId: string, formData: FormData) {
  if (!await adminActor()) return { error: "Unauthorized" } as const
  if (!Types.ObjectId.isValid(courseId)) return invalid("Course not found.")

  const parsed = courseInputSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    teacherId: formData.get("teacherId"),
    isPaid: formData.get("isPaid") === "true",
    price: Number(formData.get("price") ?? 0),
  })
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message)

  await connectDB()
  if (!await teacherExists(parsed.data.teacherId)) return invalid("Choose an active teacher for this course.")

  const updated = await Course.findByIdAndUpdate(courseId, {
    title: parsed.data.title,
    description: parsed.data.description,
    teacher: parsed.data.teacherId,
    isPaid: parsed.data.isPaid,
    price: parsed.data.isPaid ? parsed.data.price : 0,
  }).lean()
  if (!updated) return invalid("Course not found.")

  revalidatePath("/admin/courses")
  revalidatePath("/teacher/courses")
  revalidatePath(`/student/courses/${courseId}`)
  return { success: true as const }
}

export async function setAdminCoursePublished(courseId: string, published: boolean) {
  if (!await adminActor()) return { error: "Unauthorized" } as const
  if (!Types.ObjectId.isValid(courseId)) return invalid("Course not found.")

  await connectDB()
  const updated = await Course.findByIdAndUpdate(courseId, { isPublished: published }).lean()
  if (!updated) return invalid("Course not found.")

  revalidatePath("/admin/courses")
  revalidatePath("/teacher/courses")
  revalidatePath(`/student/courses/${courseId}`)
  revalidatePath("/student/dashboard")
  return { success: true as const, isPublished: published }
}

export async function getAdminPayments() {
  if (!await adminActor()) return { error: "Unauthorized" } as const
  await connectDB()

  const payments = await PaymentTransaction.find({})
    .sort({ createdAt: -1 })
    .limit(2000)
    .select("student course reference amount currency status failureReason paidAt createdAt authorizationUrl")
    .lean()

  const [students, courses] = await Promise.all([
    User.find({ _id: { $in: payments.map((p) => p.student) } }).select("name email").lean(),
    Course.find({ _id: { $in: payments.map((p) => p.course) } }).select("title isPaid price").lean(),
  ])
  const studentMap = new Map(students.map((s) => [String(s._id), s]))
  const courseMap = new Map(courses.map((c) => [String(c._id), c]))

  const paidPairs = payments.filter((p) => p.status === "success").map((p) => ({ student: p.student, course: p.course }))
  const enrollments = paidPairs.length
    ? await StudentProgress.find({ $or: paidPairs }).select("student course").lean()
    : []
  const enrolledCourseIds = new Set(enrollments.map((p) => `${String(p.student)}:${String(p.course)}`))

  const summary = { collected: 0, success: 0, pending: 0, failed: 0 }
  const rows = payments.map((p) => {
    const student = studentMap.get(String(p.student))
    const course = courseMap.get(String(p.course))
    if (p.status === "success") { summary.success += 1; summary.collected += p.amount }
    else if (p.status === "pending") summary.pending += 1
    else summary.failed += 1
    return {
      id: String(p._id),
      reference: p.reference,
      studentName: student?.name ?? "Former student",
      studentEmail: student?.email ?? "—",
      courseTitle: course?.title ?? "Unavailable course",
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      failureReason: p.failureReason ?? null,
      enrolled: enrolledCourseIds.has(`${String(p.student)}:${String(p.course)}`),
      paidAt: (p.paidAt ?? null)?.toISOString?.() ?? null,
      createdAt: p.createdAt.toISOString(),
    }
  })

  return { summary, payments: rows }
}

// ─── Certificate design ──────────────────────────────────────────────────────

const logoListSchema = z.array(z.object({ url: z.string().trim().min(1).max(500), alt: z.string().trim().max(120).optional() })).max(4)
const signatureListSchema = z.array(z.object({
  name: z.string().trim().max(120).optional(),
  role: z.string().trim().max(120).optional(),
  url: z.string().trim().max(500).optional(),
})).max(4)

export async function getCourseCertificateDesign(courseId: string) {
  if (!await adminActor()) return { error: "Unauthorized" } as const
  if (!Types.ObjectId.isValid(courseId)) return { error: "Course not found" } as const
  await connectDB()
  const course = await Course.findById(courseId).select("title").lean()
  if (!course) return { error: "Course not found" } as const
  const design = await getCertificateDesign(courseId)
  const template = await CertificateTemplate.findOne({ course: courseId }).select("isEnabled title institutionName").lean()
  return {
    courseTitle: course.title,
    title: design.title,
    institutionName: design.institutionName,
    logos: design.logos.map((url) => ({ url, alt: "" })),
    signatures: design.signatures.map((s) => ({ name: s.name, role: s.role, url: s.url ?? "" })),
    isEnabled: template?.isEnabled ?? true,
  }
}

export async function saveCourseCertificate(courseId: string, formData: FormData) {
  if (!await adminActor()) return { error: "Unauthorized" } as const
  if (!Types.ObjectId.isValid(courseId)) return { error: "Course not found" } as const

  let logos: z.infer<typeof logoListSchema>
  let signatures: z.infer<typeof signatureListSchema>
  try {
    logos = logoListSchema.parse(JSON.parse(String(formData.get("logos") ?? "[]")))
    signatures = signatureListSchema.parse(JSON.parse(String(formData.get("signatures") ?? "[]")))
  } catch {
    return { error: "Check the certificate logos and signatures." } as const
  }

  const title = String(formData.get("title") ?? "").trim() || "Certificate of Completion"
  const institutionName = String(formData.get("institutionName") ?? "").trim()
  const isEnabled = formData.get("isEnabled") !== "false"
  if (title.length < 5 || title.length > 120) return { error: "Certificate title must be 5–120 characters." } as const
  if (institutionName.length < 2 || institutionName.length > 160) return { error: "Enter the institution issuing the certificate." } as const

  await connectDB()
  if (!await Course.exists({ _id: courseId })) return { error: "Course not found" } as const

  await CertificateTemplate.findOneAndUpdate(
    { course: courseId },
    { $set: {
      course: courseId,
      title,
      institutionName,
      isEnabled,
      logos: logos.map((l) => ({ url: l.url, alt: l.alt ?? "" })),
      signatures: signatures.map((s) => ({ name: s.name ?? "", role: s.role ?? "", url: s.url ?? "" })).filter((s) => s.name || s.role || s.url),
    } },
    { upsert: true, new: true },
  )

  revalidatePath("/admin/courses")
  revalidatePath("/student/certificates")
  return { success: true as const }
}
