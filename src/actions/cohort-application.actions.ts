"use server"

import { auth } from "@/auth"
import { connectDB } from "@/lib/mongoose"
import { Types } from "mongoose"
import { randomBytes, createHash } from "node:crypto"
import { hash } from "bcryptjs"
import { z } from "zod"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { sendEmail, setPasswordEmailHtml } from "@/lib/email"
import { createResetToken, SET_PASSWORD_TTL_MS } from "@/lib/password-reset"
import { getAppUrl } from "@/lib/app-url"
import { checkRateLimit } from "@/lib/rate-limit"
import { applicationClosesAt, isApplicationOpen } from "@/lib/cohort-time"
import CohortApplication from "@/models/CohortApplication.model"
import CohortSchedule from "@/models/CohortSchedule.model"
import User from "@/models/User.model"
import Course from "@/models/Course.model"
import StudentProgress from "@/models/StudentProgress.model"
import PaymentTransaction from "@/models/PaymentTransaction.model"
import { initializePaystackPayment } from "@/lib/paystack"

const inputSchema = z.object({
  scheduleId: z.string().regex(/^[a-f0-9]{24}$/i),
  partnerName: z.string().trim().min(2).max(150),
  partnerEmail: z.email().trim().toLowerCase().max(254),
  partnerPhone: z.string().trim().regex(/^\+?[\d ()-]{7,40}$/),
  partnerInformed: z.literal(true),
})
type ApplicationInput = z.infer<typeof inputSchema>
const digest = (value: string) => createHash("sha256").update(value).digest("hex")
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

export async function getOpenCohortSchedules() {
  await connectDB()
  const now = new Date()
  const published = await Course.find({ isPublished: true }).select("title isPaid price").lean()
  const schedules = await CohortSchedule.find({ course: { $in: published.map(c => c._id) } }).sort({ startsAt: 1 }).lean()
  return schedules
    .filter((s) => isApplicationOpen(s, now))
    .map(s => {
      const course = published.find(c => c._id.equals(s.course))
      return {
        id: String(s._id),
        cohort: s.cohort,
        courseTitle: course?.title ?? "Course",
        startDate: s.startDate,
        endDate: s.endDate,
        registrationClosesAt: applicationClosesAt(new Date(s.startsAt), s.registrationClosesAt).toISOString(),
        isPaid: course?.isPaid ?? false,
        price: course?.price ?? 0,
      }
    })
}

export async function getCohortApplications() {
  const session = await auth()
  if (session?.user?.role !== "student") return { error: "Please sign in as a student." }
  await connectDB()
  const applications = await CohortApplication.find({ student: session.user.id }).sort({ createdAt: -1 }).lean()
  const courses = await Course.find({ _id: { $in: applications.map(a => a.course) } }).select("title").lean()
  return { schedules: await getOpenCohortSchedules(), applications: applications.map(a => ({
    id: String(a._id), cohort: a.cohort, courseTitle: courses.find(c => c._id.equals(a.course))?.title ?? "Course",
    status: a.status, partnerName: a.partnerName, partnerEmail: a.partnerEmail, emailStatus: a.emailStatus,
  })) }
}

async function deliverInvitation(applicationId: string, studentName: string) {
  const token = randomBytes(32).toString("hex")
  const application = await CohortApplication.findOneAndUpdate({ _id: applicationId, status: "pending" }, { $set: { tokenHash: digest(token), emailStatus: "pending" } }, { new: true })
  if (!application) return { error: "This application has already been decided." }
  const url = `${getAppUrl()}/accountability/respond?token=${token}`
  try {
    await sendEmail({ to: application.partnerEmail, subject: "Please confirm your accountability partner role — LFF LMS", html:
      `<h2>Accountability partner invitation</h2><p>Dear Pastor ${escape(application.partnerName)},</p><p>${escape(studentName)} has applied for ${escape(application.cohort)} and named you as their pastor and accountability partner.</p><p>If you accept, you agree to receive notices when the student misses a module deadline. Their admission remains pending until you accept. If you reject, their application will be rejected.</p><p><a href="${escape(url)}">Review invitation and accept or reject</a></p><p>Opening this link does not accept the role. Please confirm your decision on the page. The link expires when the cohort ends.</p>` })
    await CohortApplication.updateOne({ _id: application._id, tokenHash: digest(token) }, { $set: { emailStatus: "sent" } })
    return { success: true as const }
  } catch {
    await CohortApplication.updateOne({ _id: application._id, tokenHash: digest(token) }, { $set: { emailStatus: "failed" } })
    return { error: "Your application is saved, but the invitation email could not be delivered. Sign in and resend it from Applications. You are not yet admitted." }
  }
}

/**
 * Starts (or reuses) the Paystack checkout for the course chosen on the application.
 * Applicants pay at application time, before they can sign in, so the callback differs
 * from the signed-in course purchase flow.
 */
async function startCohortPayment({ studentId, email, courseId, price, callbackPath }: { studentId: string; email: string; courseId: string; price: number; callbackPath: string }) {
  await connectDB()
  // Same idempotency rule as the course checkout: reuse an open attempt instead of charging twice.
  const openAttempt = await PaymentTransaction.findOne({
    student: studentId, course: courseId, amount: price, status: "pending",
    authorizationUrl: { $exists: true, $ne: null },
    createdAt: { $gt: new Date(Date.now() - 30 * 60 * 1000) },
  }).sort({ createdAt: -1 }).select("authorizationUrl").lean()
  if (openAttempt?.authorizationUrl) return { url: openAttempt.authorizationUrl }
  const data = await initializePaystackPayment({ email, amount: price, courseId, studentId, callbackPath })
  return { url: String(data.authorization_url) }
}

async function createApplication(studentId: string, input: ApplicationInput, extra: { state?: string; district?: string; church?: string; passwordSetupRequired?: boolean } = {}) {
  await connectDB()
  const [student, schedule] = await Promise.all([
    User.findOne({ _id: studentId, role: "student", isActive: true }).lean(),
    CohortSchedule.findOne({ _id: input.scheduleId }).lean(),
  ])
  if (!student || !schedule || !isApplicationOpen(schedule)) return { error: "Applications for this cohort are closed. Please wait for the next cohort." }
  const course = await Course.findOne({ _id: schedule.course, isPublished: true }).select("isPaid price").lean()
  if (!course) return { error: "Applications for this cohort are closed or unavailable." }
  if (student.email.toLowerCase() === input.partnerEmail) return { error: "Use your pastor's email, not your own email." }
  if (!(await checkRateLimit("partner-invitation", input.partnerEmail, 5, 3600)).allowed) return { error: "Too many invitations to this address. Please try again later." }
  try {
    // Re-check immediately before saving: applications close one week after start.
    if (!isApplicationOpen(schedule)) return { error: "Applications for this cohort are closed. Please wait for the next cohort." }
    const application = await CohortApplication.create({ student: student._id, course: schedule.course, schedule: schedule._id,
      cohort: schedule.cohort, ...input, status: "pending", tokenExpiresAt: schedule.endsAt,
      passwordSetupRequired: extra.passwordSetupRequired ?? false,
      ...(extra.state ? { state: extra.state, district: extra.district, church: extra.church } : {}) })
    // Paid courses are settled on the next step, right after the form is complete.
    let paymentUrl: string | null = null
    let paymentError: string | null = null
    if (course.isPaid && (course.price ?? 0) > 0) {
      try {
        const payment = await startCohortPayment({
          studentId: String(student._id), email: student.email, courseId: String(course._id), price: course.price ?? 0,
          // Applicants have no session yet (and signed-in applicants still land on their application), so the
          // public callback verifies and settles the reference, then returns to /apply.
          callbackPath: "/api/payments/callback",
        })
        paymentUrl = payment.url
      } catch (error) {
        paymentError = error instanceof Error ? error.message : "We could not start the course payment."
      }
    }
    const result = await deliverInvitation(String(application._id), student.name)
    revalidatePath("/student/applications")
    revalidatePath("/courses")
    revalidatePath("/apply")
    return { ...result, paymentUrl, paymentError }
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return { error: "You have already applied to this cohort. Check your application status." }
    throw error
  }
}

export async function applyForCohort(input: ApplicationInput) {
  const session = await auth()
  if (session?.user?.role !== "student") return { error: "Please sign in as a student." }
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return { error: "Enter your pastor's name, valid email and phone number, and confirm you have informed them." }
  return createApplication(session.user.id, parsed.data)
}

export async function registerAndApply(input: ApplicationInput & { name: string; email: string; state: string; district: string; church: string }) {
  const schema = inputSchema.extend({ name: z.string().trim().min(2).max(150), email: z.email().trim().toLowerCase().max(254),
    state: z.string().trim().min(2).max(100), district: z.string().trim().min(2).max(150), church: z.string().trim().min(2).max(150) })
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { error: "Check every field: your name, email, state, church district and church branch are required." }
  const h = await headers()
  if (!(await checkRateLimit("cohort-registration", h.get("x-forwarded-for")?.split(",")[0] ?? "unknown", 5, 3600)).allowed) return { error: "Too many registration attempts. Please try again later." }
  await connectDB()
  const schedule = await CohortSchedule.findOne({ _id: parsed.data.scheduleId }).lean()
  if (!schedule || !isApplicationOpen(schedule) || !await Course.exists({ _id: schedule.course, isPublished: true })) return { error: "This cohort is no longer accepting applications. Please wait for the next cohort." }
  if (parsed.data.email === parsed.data.partnerEmail) return { error: "Your pastor must have a different email address from yours." }
  if (await User.exists({ email: parsed.data.email })) return { error: "Please sign in to your existing account to apply, or use password reset." }
  let student
  try {
    // No password yet: the account cannot sign in until the pastor accepts and we email a one-time set-password link.
    student = await User.create({
      name: parsed.data.name, email: parsed.data.email,
      hashedPassword: await hash(randomBytes(32).toString("hex"), 12),
      role: "student", isActive: true, mustChangePassword: true,
      state: parsed.data.state, district: parsed.data.district, church: parsed.data.church,
    })
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return { error: "Please sign in to your existing account to apply." }
    throw error
  }
  return createApplication(String(student._id), parsed.data, {
    state: parsed.data.state, district: parsed.data.district, church: parsed.data.church, passwordSetupRequired: true,
  })
}

export async function resendPartnerInvitation(applicationId: string) {
  const session = await auth()
  if (session?.user?.role !== "student" || !Types.ObjectId.isValid(applicationId)) return { error: "Unauthorized" }
  await connectDB()
  const application = await CohortApplication.findOne({ _id: applicationId, student: session.user.id, status: "pending", tokenExpiresAt: { $gt: new Date() } }).lean()
  if (!application) return { error: "No pending invitation is available." }
  if (!(await checkRateLimit("partner-resend", applicationId, 3, 3600)).allowed) return { error: "Please wait before sending another reminder." }
  return deliverInvitation(applicationId, session.user.name ?? "A student")
}

export async function getPartnerInvitation(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null
  await connectDB()
  const application = await CohortApplication.findOne({ tokenHash: digest(token), status: "pending", tokenExpiresAt: { $gt: new Date() } }).lean()
  if (!application) return null
  const student = await User.findById(application.student).select("name").lean()
  return { studentName: student?.name ?? "Student", partnerName: application.partnerName, cohort: application.cohort }
}

export async function respondToPartnerInvitation(token: string, decision: "accepted" | "rejected") {
  if (!/^[a-f0-9]{64}$/.test(token) || !["accepted", "rejected"].includes(decision)) return { error: "Invalid invitation." }
  await connectDB()
  const now = new Date()
  try {
    const application = await CohortApplication.findOne({ tokenHash: digest(token), status: "pending", tokenExpiresAt: { $gt: now } }).lean()
    if (!application) throw new Error("This invitation has expired or has already been answered.")
    const [schedule, student, course] = await Promise.all([
      CohortSchedule.findOne({ _id: application.schedule, endsAt: { $gt: now } }).lean(),
      User.findOne({ _id: application.student, role: "student", isActive: true }).lean(),
      Course.findById(application.course).select("isPaid isPublished").lean(),
    ])
    if (!schedule) throw new Error("This cohort has ended or is unavailable.")
    if (!student) throw new Error("This student account is unavailable.")
    if (!course?.isPublished) throw new Error("This cohort course is unavailable.")
    // Single-use claim: only one concurrent response can flip a pending invitation.
    const claimed = await CohortApplication.updateOne(
      { _id: application._id, status: "pending" },
      { $set: { status: decision, respondedAt: now }, $unset: { tokenHash: 1 } },
    )
    if (claimed.modifiedCount !== 1) throw new Error("This invitation has expired or has already been answered.")
    if (decision === "accepted") {
      await User.updateOne({ _id: student._id }, { $set: {
        cohort: application.cohort,
        accountabilityPartner: { name: application.partnerName, email: application.partnerEmail, phone: application.partnerPhone, location: "" },
        ...(application.state ? { state: application.state } : {}),
        ...(application.district ? { district: application.district } : {}),
        ...(application.church ? { church: application.church } : {}),
      } })
      // Paid courses enroll through the existing verified-payment flow.
      if (!course.isPaid) await StudentProgress.updateOne({ student: student._id, course: application.course }, { $setOnInsert: { student: student._id, course: application.course } }, { upsert: true })
      // Applicants never chose a password: admission sends them a one-time link to set it.
      if (application.passwordSetupRequired) {
        const { token, tokenHash, expiresAt } = createResetToken(SET_PASSWORD_TTL_MS)
        await User.updateOne({ _id: student._id }, { $set: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt } })
        try {
          await sendEmail({ to: student.email, subject: "You have been admitted — set your password",
            html: setPasswordEmailHtml(student.name, application.cohort, `${getAppUrl()}/auth/reset-password?token=${token}`, expiresAt) })
          await CohortApplication.updateOne({ _id: application._id }, { $set: { passwordSetupEmailStatus: "sent" } })
        } catch {
          await CohortApplication.updateOne({ _id: application._id }, { $set: { passwordSetupEmailStatus: "failed" } })
        }
      }
    }
    revalidatePath("/student/applications")
    revalidatePath("/courses")
    revalidatePath("/apply")
    return { success: true as const }
  } catch (error) {
    return { error: error instanceof Error && /invitation|cohort|account/.test(error.message) ? error.message : "Unable to save your response. Please retry." }
  }
}
