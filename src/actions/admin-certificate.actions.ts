"use server"

import { auth } from "@/auth"
import { connectDB } from "@/lib/mongoose"
import { getCertificateDesign } from "@/lib/certificate"
import { sanitizeLayout, type CertificateLayout } from "@/lib/certificate-layout"
import Certificate from "@/models/Certificate.model"
import CertificateTemplate from "@/models/CertificateTemplate.model"
import Course from "@/models/Course.model"
import User from "@/models/User.model"
import { Types } from "mongoose"
import { revalidatePath } from "next/cache"
import { z } from "zod"

export type CertificateRow = {
  id: string
  studentName: string
  studentEmail: string
  courseId: string
  courseTitle: string
  serial: string
  issuedAt: string
  hasPdf: boolean
}

export type CertificateAdminOverview = {
  rows: CertificateRow[]
  total: number
  page: number
  pageSize: number
  pages: number
  stats: { issued: number; thisMonth: number; courses: number; templates: number }
  courses: { id: string; title: string; hasTemplate: boolean; certificateCount: number }[]
}

async function adminActor() {
  const session = await auth()
  if (session?.user?.role !== "admin") return null
  await connectDB()
  return session.user
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export async function getCertificateAdminOverview(params: {
  page?: number
  pageSize?: number
  courseId?: string
  query?: string
}): Promise<CertificateAdminOverview | { error: string }> {
  const user = await adminActor()
  if (!user) return { error: "Unauthorized" }

  const pageSize = Math.min(50, Math.max(5, Math.round(Number(params.pageSize) || 10)))
  const page = Math.max(1, Math.round(Number(params.page) || 1))
  const courseId = params.courseId && Types.ObjectId.isValid(params.courseId) ? params.courseId : ""
  const query = (params.query ?? "").trim().slice(0, 120)

  const filter: Record<string, unknown> = {}
  if (courseId) filter.course = new Types.ObjectId(courseId)
  if (query) {
    const rx = new RegExp(escapeRegex(query), "i")
    const [students, courses] = await Promise.all([
      User.find({ $or: [{ name: rx }, { email: rx }] }).select("_id").limit(400).lean(),
      Course.find({ title: rx }).select("_id").limit(200).lean(),
    ])
    filter.$or = [
      { serial: rx },
      { student: { $in: students.map((s) => s._id) } },
      { course: { $in: courses.map((c) => c._id) } },
    ]
  }

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [total, docs, allCourses, templates, issued, thisMonth] = await Promise.all([
    Certificate.countDocuments(filter),
    Certificate.find(filter)
      .sort({ issuedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate("student", "name email")
      .populate("course", "title")
      .lean(),
    Course.find({}).select("title").sort({ title: 1 }).lean(),
    CertificateTemplate.find({}).select("course templateId").lean(),
    Certificate.countDocuments({}),
    Certificate.countDocuments({ issuedAt: { $gte: monthStart } }),
  ])

  const counts = await Certificate.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $group: { _id: "$course", count: { $sum: 1 } } },
  ])
  const countByCourse = new Map(counts.map((entry) => [String(entry._id), entry.count]))
  const templateCourses = new Set(templates.map((template) => String(template.course)))

  return {
    rows: (docs as unknown as {
      _id: Types.ObjectId
      student?: { name?: string; email?: string } | null
      course?: { _id: Types.ObjectId; title?: string } | null
      serial?: string
      issuedAt: Date
      pdfUrl?: string
    }[]).map((doc) => ({
      id: String(doc._id),
      studentName: doc.student?.name ?? "Former student",
      studentEmail: doc.student?.email ?? "",
      courseId: doc.course ? String(doc.course._id) : "",
      courseTitle: doc.course?.title ?? "Unavailable course",
      serial: doc.serial ?? "",
      issuedAt: doc.issuedAt.toISOString(),
      hasPdf: Boolean(doc.pdfUrl),
    })),
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    stats: {
      issued,
      thisMonth,
      courses: allCourses.length,
      templates: templateCourses.size,
    },
    courses: allCourses.map((course) => ({
      id: String(course._id),
      title: course.title,
      hasTemplate: templateCourses.has(String(course._id)),
      certificateCount: countByCourse.get(String(course._id)) ?? 0,
    })),
  }
}

export type CourseTemplate = {
  courseId: string
  courseTitle: string
  title: string
  institutionName: string
  logos: { url: string; alt: string }[]
  signatures: { name: string; role: string; url: string }[]
  isEnabled: boolean
  layout: CertificateLayout | null
  templateId: string
}

export async function getCourseCertificateTemplate(courseId: string): Promise<CourseTemplate | { error: string }> {
  const user = await adminActor()
  if (!user) return { error: "Unauthorized" }
  if (!Types.ObjectId.isValid(courseId)) return { error: "Course not found" }

  const course = await Course.findById(courseId).select("title").lean()
  if (!course) return { error: "Course not found" }

  const [design, template] = await Promise.all([
    getCertificateDesign(courseId),
    CertificateTemplate.findOne({ course: courseId }).lean(),
  ])

  return {
    courseId,
    courseTitle: course.title,
    title: design.title,
    institutionName: design.institutionName,
    logos: (template?.logos ?? []).map((logo) => ({ url: logo.url, alt: logo.alt ?? "" })),
    signatures: (template?.signatures ?? []).map((signature) => ({
      name: signature.name ?? "",
      role: signature.role ?? "",
      url: signature.url ?? "",
    })),
    isEnabled: template?.isEnabled ?? true,
    layout: sanitizeLayout(template?.layout),
    templateId: template?.templateId ?? "",
  }
}

const MAX_LOGOS = 6
const MAX_SIGNATURES = 6

const logoListSchema = z.array(z.object({ url: z.string().trim().min(1).max(1000), alt: z.string().trim().max(120).optional() })).max(MAX_LOGOS)
const signatureListSchema = z.array(z.object({
  name: z.string().trim().max(120).optional(),
  role: z.string().trim().max(120).optional(),
  url: z.string().trim().max(1000).optional(),
})).max(MAX_SIGNATURES)

export type SaveTemplateInput = {
  title: string
  institutionName: string
  isEnabled: boolean
  logos: { url: string; alt?: string }[]
  signatures: { name?: string; role?: string; url?: string }[]
  layout: unknown
  templateId?: string
}

export async function saveCourseCertificateTemplate(courseId: string, input: SaveTemplateInput) {
  const user = await adminActor()
  if (!user) return { error: "Unauthorized" } as const
  if (!Types.ObjectId.isValid(courseId)) return { error: "Course not found" } as const

  const parsedLogos = logoListSchema.safeParse(input.logos ?? [])
  const parsedSignatures = signatureListSchema.safeParse(input.signatures ?? [])
  if (!parsedLogos.success || !parsedSignatures.success) {
    return { error: `Check the logos (max ${MAX_LOGOS}) and signatures (max ${MAX_SIGNATURES}).` } as const
  }

  const layout = sanitizeLayout(input.layout)
  if (!layout) return { error: "The certificate design is empty. Pick a template to start." } as const

  const title = String(input.title ?? "").trim() || "Certificate of Completion"
  const institutionName = String(input.institutionName ?? "").trim()
  if (title.length < 5 || title.length > 120) return { error: "Certificate title must be 5–120 characters." } as const
  if (institutionName.length < 2 || institutionName.length > 160) return { error: "Enter the institution issuing the certificate." } as const

  if (!(await Course.exists({ _id: courseId }))) return { error: "Course not found" } as const

  await CertificateTemplate.findOneAndUpdate(
    { course: courseId },
    {
      $set: {
        course: courseId,
        title,
        institutionName,
        isEnabled: input.isEnabled !== false,
        logos: parsedLogos.data.map((logo) => ({ url: logo.url, alt: logo.alt ?? "" })),
        signatures: parsedSignatures.data
          .map((signature) => ({ name: signature.name ?? "", role: signature.role ?? "", url: signature.url ?? "" }))
          .filter((signature) => signature.name || signature.role || signature.url),
        layout,
        templateId: String(input.templateId ?? "").slice(0, 60),
      },
    },
    { upsert: true, new: true },
  )

  revalidatePath("/admin/certificates")
  revalidatePath("/admin/courses")
  revalidatePath("/student/certificates")
  return { success: true as const }
}

export async function updateCertificateRecord(certificateId: string, input: { serial?: string; issuedAt?: string }) {
  const user = await adminActor()
  if (!user) return { error: "Unauthorized" } as const
  if (!Types.ObjectId.isValid(certificateId)) return { error: "Certificate not found" } as const

  const update: Record<string, unknown> = {}
  const unset: Record<string, ""> = {}
  if (typeof input.serial === "string") {
    const serial = input.serial.trim().toUpperCase()
    if (serial && !/^[A-Z0-9-]{4,40}$/.test(serial)) {
      return { error: "Certificate ID must be 4–40 characters using letters, numbers and dashes." } as const
    }
    if (serial) update.serial = serial
    else unset.serial = ""
  }
  if (input.issuedAt) {
    const date = new Date(input.issuedAt)
    if (Number.isNaN(date.getTime())) return { error: "Enter a valid issue date." } as const
    update.issuedAt = date
  }
  if (Object.keys(update).length === 0 && Object.keys(unset).length === 0) return { error: "Nothing to update." } as const

  try {
    const result = await Certificate.updateOne(
      { _id: certificateId },
      {
        ...(Object.keys(update).length ? { $set: update } : {}),
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
      },
      { runValidators: true },
    )
    if (result.matchedCount !== 1) return { error: "Certificate not found." } as const
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return { error: "That certificate ID is already in use." } as const
    return { error: "Unable to update the certificate." } as const
  }

  revalidatePath("/admin/certificates")
  revalidatePath("/student/certificates")
  return { success: true as const }
}

/** Everything the client needs to render a certificate PDF from the admin table. */
export async function getCertificateDownloadData(certificateId: string) {
  const user = await adminActor()
  if (!user) return { error: "Unauthorized" } as const
  if (!Types.ObjectId.isValid(certificateId)) return { error: "Certificate not found" } as const

  const certificate = await Certificate.findById(certificateId)
    .populate("student", "name")
    .populate("course", "title")
    .lean()
  if (!certificate) return { error: "Certificate not found" } as const

  const student = certificate.student as unknown as { name?: string } | null
  const course = certificate.course as unknown as { _id: Types.ObjectId; title?: string } | null
  if (!course) return { error: "The course for this certificate no longer exists." } as const

  const design = await getCertificateDesign(String(course._id))
  return {
    studentName: student?.name ?? "Student",
    courseTitle: course.title ?? "Course",
    title: design.title,
    institutionName: design.institutionName,
    issuedAt: certificate.issuedAt.toISOString(),
    serial: certificate.serial ?? null,
    logos: design.logos,
    signatures: design.signatures,
    layout: design.layout,
  }
}
