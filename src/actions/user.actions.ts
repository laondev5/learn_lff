"use server"

import { z } from "zod"
import bcryptjs from "bcryptjs"
import { connectDB } from "@/lib/mongoose"
import cloudinary from "@/lib/cloudinary"
import User from "@/models/User.model"
import ChatForum from "@/models/ChatForum.model"
import Course from "@/models/Course.model"
import Module from "@/models/Module.model"
import Lesson from "@/models/Lesson.model"
import Test from "@/models/Test.model"
import TestSubmission from "@/models/TestSubmission.model"
import Exam from "@/models/Exam.model"
import ExamSubmission from "@/models/ExamSubmission.model"
import StudentProgress from "@/models/StudentProgress.model"
import Certificate from "@/models/Certificate.model"
import CourseQuestion from "@/models/CourseQuestion.model"
import CourseSettings from "@/models/CourseSettings.model"
import Assessment from "@/models/Assessment.model"
import Submission from "@/models/Submission.model"
import ProctoringSession from "@/models/ProctoringSession.model"
import PaymentTransaction from "@/models/PaymentTransaction.model"
import Announcement from "@/models/Announcement.model"
import LiveClass from "@/models/LiveClass.model"
import { ORDINATION_OPTIONS } from "@/lib/constants"
import { sendEmail, credentialsEmailHtml, accountabilityPartnerWelcomeEmailHtml } from "@/lib/email"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { Types } from "mongoose"
import { writeSecurityAuditLog } from "@/lib/security-audit"
import {
  generateSecureTemporaryPassword,
  getTemporaryPasswordExpiryDate,
} from "@/lib/temporary-password"

const createUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["teacher", "student"]),
  cohort: z.string().optional(),
  church: z.string().optional(),
  district: z.string().optional(),
  partnerName: z.string().optional(),
  partnerEmail: z.string().optional(),
  partnerLocation: z.string().optional(),
})

const updateProfileSchema = z.object({
  country: z.string().min(1, "Country is required"),
  state: z.string().min(1, "State is required"),
  city: z.string().min(1, "City is required"),
  ordination: z.enum(ORDINATION_OPTIONS as unknown as [string, ...string[]], {
    message: "Please select an ordination",
  }),
  // KYC fields
  kycIdType: z.enum(["nin", "passport", "driver_license", "voter_card"]).optional(),
  kycIdNumber: z.string().optional(),
  kycDateOfBirth: z.string().optional(),
  kycAddress: z.string().optional(),
  kycLivePhotoUrl: z.string().optional(),
})

function extractCloudinaryPublicId(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.includes("res.cloudinary.com")) return null

    const parts = parsed.pathname.split("/").filter(Boolean)
    const uploadIdx = parts.findIndex((p) => p === "upload")
    if (uploadIdx === -1) return null

    const versionIdx = parts.findIndex((p, idx) => idx > uploadIdx && /^v\d+$/.test(p))
    const startIdx = versionIdx !== -1 ? versionIdx + 1 : uploadIdx + 1
    if (startIdx >= parts.length) return null

    const publicIdParts = parts.slice(startIdx)
    const last = publicIdParts[publicIdParts.length - 1]
    publicIdParts[publicIdParts.length - 1] = last.replace(/\.[^/.]+$/, "")

    return publicIdParts.join("/")
  } catch {
    return null
  }
}

async function deleteCloudinaryAssetByUrl(url: string) {
  const publicId = extractCloudinaryPublicId(url)
  if (!publicId) return

  // Try both resource types because lesson media may be image or video.
  await Promise.allSettled([
    cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true }),
    cloudinary.uploader.destroy(publicId, { resource_type: "video", invalidate: true }),
  ])
}

export async function createUser(formData: FormData) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return { error: "Unauthorized" }
  }

  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    cohort: formData.get("cohort") || undefined,
    church: formData.get("church") || undefined,
    district: formData.get("district") || undefined,
    partnerName: formData.get("partnerName") || undefined,
    partnerEmail: formData.get("partnerEmail") || undefined,
    partnerLocation: formData.get("partnerLocation") || undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const {
    name,
    email,
    role,
    cohort,
    church,
    district,
    partnerName,
    partnerEmail,
    partnerLocation,
  } = parsed.data

  await connectDB()

  const existing = await User.findOne({ email })
  if (existing) return { error: "A user with this email already exists" }

  const tempPassword = generateSecureTemporaryPassword()
  const hashedPassword = await bcryptjs.hash(tempPassword, 12)
  const temporaryPasswordIssuedAt = new Date()
  const temporaryPasswordExpiresAt = getTemporaryPasswordExpiryDate()

  const user = await User.create({
    name,
    email,
    hashedPassword,
    role,
    cohort: cohort || undefined,
    church: church || undefined,
    district: district || undefined,
    accountabilityPartner:
      role === "student" && partnerName && partnerEmail && partnerLocation
        ? {
            name: partnerName,
            email: partnerEmail,
            location: partnerLocation,
          }
        : undefined,
    mustChangePassword: true,
    temporaryPasswordIssuedAt,
    temporaryPasswordExpiresAt,
  })

  await writeSecurityAuditLog({
    event: "account_created",
    actorUserId: session.user.id,
    targetUserId: user._id.toString(),
    email,
    role,
    status: "success",
    metadata: {
      createdByRole: session.user.role,
      temporaryPasswordExpiresAt: temporaryPasswordExpiresAt.toISOString(),
    },
  })

  // Ensure forums exist for Admin UI
  await ChatForum.findOneAndUpdate(
    { type: "general" },
    { $setOnInsert: { name: "General", description: "General discussion for all members" } },
    { upsert: true }
  )
  if (cohort) {
    await ChatForum.findOneAndUpdate(
      { type: "cohort", cohort },
      { $setOnInsert: { name: cohort } },
      { upsert: true }
    )
  }

  try {
    // 1. Send account credentials
    await sendEmail({
      to: email,
      subject: "Welcome to LFF Learning Management System",
      html: credentialsEmailHtml(name, email, tempPassword, temporaryPasswordExpiresAt),
    })

    user.onboardingEmailSentAt = new Date()
    user.onboardingEmailFailedAt = undefined
    await user.save()

    await writeSecurityAuditLog({
      event: "onboarding_email_sent",
      actorUserId: session.user.id,
      targetUserId: user._id.toString(),
      email,
      role,
      status: "success",
      metadata: {
        temporaryPasswordExpiresAt: temporaryPasswordExpiresAt.toISOString(),
      },
    })

    // 2. Send welcome email to accountability partner if applicable
    if (role === "student" && partnerEmail && partnerName) {
      await sendEmail({
        to: partnerEmail,
        subject: `Accountability Partner for ${name}`,
        html: accountabilityPartnerWelcomeEmailHtml(partnerName, name),
      })
    }
  } catch (error) {
    console.error("Email sending failed:", error)
    user.onboardingEmailFailedAt = new Date()
    await user.save()

    await writeSecurityAuditLog({
      event: "onboarding_email_failed",
      actorUserId: session.user.id,
      targetUserId: user._id.toString(),
      email,
      role,
      status: "failure",
      metadata: {
        error: error instanceof Error ? error.message : "Unknown email delivery failure",
      },
    })

    // User exists, but onboarding is incomplete until delivery is resolved.
    return { success: true, emailFailed: true }
  }

  revalidatePath("/admin/users")
  return { success: true }
}

export async function toggleUserStatus(userId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return { error: "Unauthorized" }
  }

  await connectDB()
  const user = await User.findById(userId)
  if (!user) return { error: "User not found" }

  user.isActive = !user.isActive
  await user.save()

  revalidatePath("/admin/users")
  return { success: true, isActive: user.isActive }
}

export async function deleteUser(userId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return { error: "Unauthorized" }
  }

  await connectDB()

  const user = await User.findById(userId).lean()
  if (!user) return { error: "User not found" }

  if (user.role === "teacher") {
    const teacherId = new Types.ObjectId(userId)
    const courses = await Course.find({ teacher: teacherId })
      .select("_id coverImageUrl")
      .lean<{ _id: Types.ObjectId; coverImageUrl?: string }[]>()

    const courseIds = courses.map((c) => c._id)

    if (courseIds.length > 0) {
      const lessons = await Lesson.find({ course: { $in: courseIds } })
        .select("videoUrl")
        .lean<{ videoUrl?: string }[]>()

      const assetUrls = [
        ...courses.map((c) => c.coverImageUrl).filter((url): url is string => !!url),
        ...lessons.map((l) => l.videoUrl).filter((url): url is string => !!url),
      ]

      await Promise.all(assetUrls.map((url) => deleteCloudinaryAssetByUrl(url)))

      await Promise.all([
        Announcement.deleteMany({ course: { $in: courseIds } }),
        LiveClass.deleteMany({ course: { $in: courseIds } }),
        CourseQuestion.deleteMany({ course: { $in: courseIds } }),
        CourseSettings.deleteMany({ course: { $in: courseIds } }),
        Assessment.deleteMany({ course: { $in: courseIds } }),
        Submission.deleteMany({ course: { $in: courseIds } }),
        ProctoringSession.deleteMany({ course: { $in: courseIds } }),
        TestSubmission.deleteMany({ course: { $in: courseIds } }),
        ExamSubmission.deleteMany({ course: { $in: courseIds } }),
        StudentProgress.deleteMany({ course: { $in: courseIds } }),
        Certificate.deleteMany({ course: { $in: courseIds } }),
        PaymentTransaction.deleteMany({ course: { $in: courseIds } }),
        Test.deleteMany({ course: { $in: courseIds } }),
        Exam.deleteMany({ course: { $in: courseIds } }),
        Lesson.deleteMany({ course: { $in: courseIds } }),
        Module.deleteMany({ course: { $in: courseIds } }),
        Course.deleteMany({ _id: { $in: courseIds } }),
      ])
    }

    // Remove teacher-owned records not strictly tied to a course.
    await Promise.all([
      Announcement.deleteMany({ teacher: teacherId }),
      LiveClass.deleteMany({ instructor: teacherId }),
      Assessment.deleteMany({ createdBy: teacherId }),
    ])
  }

  await User.findByIdAndDelete(userId)

  revalidatePath("/admin/users")
  return { success: true }
}

export async function updateProfile(formData: FormData) {
  const session = await auth()
  if (!session?.user || !["teacher", "student"].includes(session.user.role ?? "")) {
    return { error: "Unauthorized" }
  }

  const parsed = updateProfileSchema.safeParse({
    country: formData.get("country"),
    state: formData.get("state"),
    city: formData.get("city"),
    ordination: formData.get("ordination"),
    kycIdType: formData.get("kycIdType") || undefined,
    kycIdNumber: formData.get("kycIdNumber") || undefined,
    kycDateOfBirth: formData.get("kycDateOfBirth") || undefined,
    kycAddress: formData.get("kycAddress") || undefined,
    kycLivePhotoUrl: formData.get("kycLivePhotoUrl") || undefined,
  })

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  await connectDB()
  
  type ProfileUpdateData = {
    country: string
    state: string
    city: string
    ordination: z.infer<typeof updateProfileSchema>["ordination"]
    kycIdType?: "nin" | "passport" | "driver_license" | "voter_card"
    kycIdNumber?: string
    kycDateOfBirth?: Date
    kycAddress?: string
    kycLivePhotoUrl?: string
    kycStatus?: "pending"
    kycSubmittedAt?: Date
  }

  const updateData: ProfileUpdateData = {
    country: parsed.data.country,
    state: parsed.data.state,
    city: parsed.data.city,
    ordination: parsed.data.ordination,
  }

  if (parsed.data.kycIdType) updateData.kycIdType = parsed.data.kycIdType
  if (parsed.data.kycIdNumber) updateData.kycIdNumber = parsed.data.kycIdNumber
  if (parsed.data.kycDateOfBirth) updateData.kycDateOfBirth = new Date(parsed.data.kycDateOfBirth)
  if (parsed.data.kycAddress) updateData.kycAddress = parsed.data.kycAddress
  if (parsed.data.kycLivePhotoUrl) {
    updateData.kycLivePhotoUrl = parsed.data.kycLivePhotoUrl
    updateData.kycStatus = "pending"
    updateData.kycSubmittedAt = new Date()
  }

  await User.findByIdAndUpdate(session.user.id, updateData)

  revalidatePath(`/${session.user.role}/profile`)
  return { success: true }
}

export async function getUsers(role?: "teacher" | "student") {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return []
  }

  await connectDB()
  const query = role ? { role } : { role: { $in: ["teacher", "student"] } }
  const users = await User.find(query).sort({ createdAt: -1 }).lean()

  return users.map((u) => ({
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    role: u.role,
    cohort: u.cohort,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
    kycStatus: u.kycStatus ?? "not_started",
    kycIdType: u.kycIdType,
    kycIdNumber: u.kycIdNumber,
    kycDateOfBirth: u.kycDateOfBirth ? u.kycDateOfBirth.toISOString().split("T")[0] : undefined,
    kycAddress: u.kycAddress,
    kycLivePhotoUrl: u.kycLivePhotoUrl,
    kycSubmittedAt: u.kycSubmittedAt ? u.kycSubmittedAt.toISOString() : undefined,
  }))
}

export async function reviewKyc(userId: string, decision: "verified" | "rejected") {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return { error: "Unauthorized" }
  }

  await connectDB()
  const user = await User.findById(userId)
  if (!user) return { error: "User not found" }

  if (user.kycStatus !== "pending") {
    return { error: "KYC is not in a pending state" }
  }

  user.kycStatus = decision
  await user.save()

  revalidatePath("/admin/users")
  return { success: true, kycStatus: decision }
}
