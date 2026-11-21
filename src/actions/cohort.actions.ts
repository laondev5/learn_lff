"use server"

import { auth } from "@/auth"
import { connectDB } from "@/lib/mongoose"
import { applicationClosesAt, cohortWindow, DAY_MS } from "@/lib/cohort-time"
import { getStudentModuleAccess } from "@/lib/cohort-access"
import { getAcceptedCohortApplication } from "@/lib/cohort-application"
import User from "@/models/User.model"
import Course from "@/models/Course.model"
import Module from "@/models/Module.model"
import StudentProgress from "@/models/StudentProgress.model"
import CohortSchedule from "@/models/CohortSchedule.model"
import AccessAppeal from "@/models/AccessAppeal.model"
import CohortApplication from "@/models/CohortApplication.model"
import Certificate from "@/models/Certificate.model"
import { Types } from "mongoose"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const objectId = z.string().regex(/^[a-f\d]{24}$/i)
async function actor() {
  const session = await auth()
  if (!session?.user?.id || !Types.ObjectId.isValid(session.user.id)) return null
  await connectDB()
  return User.findOne({ _id: session.user.id, isActive: true }).select("role cohort name").lean()
}

function refresh() {
  for (const url of ["/admin/cohorts", "/teacher/cohorts", "/student/appeals", "/student/applications", "/student/courses", "/courses", "/apply"]) revalidatePath(url)
}

export async function getCohortSchedules() {
  const user = await actor()
  if (!user || !["admin", "teacher"].includes(user.role)) return { error: "Unauthorized" } as const
  const courses = await Course.find(user.role === "admin" ? {} : { teacher: user._id }).select("title").sort({ title: 1 }).lean()
  const schedules = await CohortSchedule.find({ course: { $in: courses.map(c => c._id) } }).sort({ startsAt: -1 }).lean()
  const titles = new Map(courses.map(c => [String(c._id), c.title]))
  const cohorts = user.role === "admin" ? await User.distinct("cohort", { role: "student", cohort: { $nin: [null, ""] } }) : []
  return {
    courses: courses.map(c => ({ id: String(c._id), title: c.title })),
    cohorts: [...new Set([...cohorts.map(String), ...schedules.map(s => s.cohort)])].sort(),
    schedules: schedules.map(s => ({
      id: String(s._id),
      courseId: String(s.course),
      courseTitle: titles.get(String(s.course)) ?? "Course",
      cohort: s.cohort,
      startDate: s.startDate,
      endDate: s.endDate,
      registrationClosesAt: applicationClosesAt(new Date(s.startsAt), s.registrationClosesAt).toISOString(),
    })),
  }
}

export async function saveCohortSchedule(input: { courseId: string; cohort: string; startDate: string; endDate: string }) {
  const user = await actor()
  if (!user || !["admin", "teacher"].includes(user.role)) return { error: "Unauthorized" }
  const parsed = z.object({ courseId: objectId, cohort: z.string().trim().min(1).max(120), startDate: z.string(), endDate: z.string() }).safeParse(input)
  if (!parsed.success) return { error: "Enter a valid course, cohort and dates." }
  let window: ReturnType<typeof cohortWindow>
  try { window = cohortWindow(parsed.data.startDate, parsed.data.endDate) }
  catch { return { error: "Enter valid dates with the end on or after the start (Africa/Lagos)." } }
  if (!await Course.exists({ _id: parsed.data.courseId, ...(user.role === "teacher" ? { teacher: user._id } : {}) })) return { error: "Course not found or you do not own this course." }
  // Access assigns one day to every module, including unpublished modules.
  const moduleCount = await Module.countDocuments({ course: parsed.data.courseId })
  const scheduledDays = (window.endsAt.getTime() - window.startsAt.getTime()) / DAY_MS
  if (scheduledDays < moduleCount) return { error: `This course has ${moduleCount} modules and needs at least ${moduleCount} inclusive days. Extend the end date so every module has its full 24-hour window.` }
  try {
    const { courseId, ...fields } = parsed.data
    await CohortSchedule.findOneAndUpdate(
      { course: courseId, cohort: fields.cohort },
      {
        $set: {
          ...fields,
          ...window,
          registrationClosesAt: applicationClosesAt(window.startsAt),
          updatedBy: user._id,
        },
      },
      { upsert: true, runValidators: true }
    )
    refresh()
    return { success: true } as const
  } catch { return { error: "Unable to save this schedule. Please retry." } }
}

export async function getAccessAppeals() {
  const user = await actor()
  if (!user || !["admin", "student"].includes(user.role)) return { error: "Unauthorized" } as const
  const appeals = await AccessAppeal.find(user.role === "admin" ? {} : { student: user._id }).sort({ createdAt: -1 }).lean()
  const [students, courses, modules] = await Promise.all([
    User.find({ _id: { $in: appeals.map(a => a.student) } }).select("name").lean(),
    Course.find({ _id: { $in: appeals.map(a => a.course) } }).select("title").lean(),
    Module.find({ _id: { $in: appeals.map(a => a.module) } }).select("title").lean(),
  ])
  const names = new Map(students.map(s => [String(s._id), s.name]))
  const titles = new Map(courses.map(c => [String(c._id), c.title]))
  const moduleTitles = new Map(modules.map(m => [String(m._id), m.title]))
  return { appeals: appeals.map(a => ({ id: String(a._id), courseId: String(a.course), moduleId: String(a.module),
    studentName: names.get(String(a.student)) ?? "Former student", courseTitle: titles.get(String(a.course)) ?? "Unavailable course",
    moduleTitle: moduleTitles.get(String(a.module)) ?? "Unavailable module", cohort: a.cohort, reason: a.reason,
    superiorName: a.superiorName, superiorRole: a.superiorRole, superiorEmail: a.superiorEmail, superiorPhone: a.superiorPhone,
    status: a.status, createdAt: a.createdAt.toISOString(), decidedAt: a.decidedAt?.toISOString() ?? null,
    accessClosesAt: a.accessClosesAt?.toISOString() ?? null })) }
}

export async function getCohortApplicants() {
  const user = await actor()
  if (user?.role !== "admin") return { error: "Unauthorized" } as const
  const applications = await CohortApplication.find({}).select("student course cohort status partnerName partnerEmail emailStatus state district church passwordSetupEmailStatus createdAt").sort({ createdAt: -1 }).lean()
  const [students, courses] = await Promise.all([
    User.find({ _id: { $in: applications.map(a => a.student) } }).select("name").lean(),
    Course.find({ _id: { $in: applications.map(a => a.course) } }).select("title").lean(),
  ])
  const names = new Map(students.map(s => [String(s._id), s.name]))
  const titles = new Map(courses.map(c => [String(c._id), c.title]))
  return { applicants: applications.map(a => ({ id: String(a._id), studentName: names.get(String(a.student)) ?? "Former student",
    courseTitle: titles.get(String(a.course)) ?? "Unavailable course", cohort: a.cohort, status: a.status,
    partnerName: a.partnerName, partnerEmail: a.partnerEmail, emailStatus: a.emailStatus,
    state: a.state ?? "", district: a.district ?? "", church: a.church ?? "", passwordSetupEmailStatus: a.passwordSetupEmailStatus ?? null })) }
}

export async function getAppealableModules() {
  const user = await actor()
  if (user?.role !== "student") return { error: "Unauthorized" } as const
  const progress = await StudentProgress.find({ student: user._id }).select("course").lean()
  const courses = await Course.find({ _id: { $in: progress.map(p => p.course) }, isPublished: true }).select("title").lean()
  const admissions = await Promise.all(courses.map(c => getAcceptedCohortApplication(String(user._id), String(c._id))))
  const schedules = admissions.flatMap(a => a ? [a.schedule] : [])
  const available: {
    id: string; courseId: string; title: string; courseTitle: string; closesAt: string
    /** Accountability partner details captured with the cohort application, reused for the appeal. */
    partner: { name: string; email: string; phone: string }
  }[] = []
  for (const schedule of schedules) {
    const admission = admissions.find(a => a && String(a.schedule._id) === String(schedule._id))
    const partner = {
      name: admission?.application.partnerName ?? "",
      email: admission?.application.partnerEmail ?? "",
      phone: admission?.application.partnerPhone ?? "",
    }
    const modules = await Module.find({ course: schedule.course }).sort({ order: 1, _id: 1 }).lean()
    for (const mod of modules) {
      if (!mod.isPublished) continue
      const access = await getStudentModuleAccess(String(user._id), String(schedule.course), String(mod._id))
      if (!["module_ended", "course_ended"].includes(access.reason)) continue
      if (!access.closesAt) continue
      available.push({ id: String(mod._id), courseId: String(schedule.course), title: mod.title,
        courseTitle: courses.find(c => String(c._id) === String(schedule.course))?.title ?? "Course",
        closesAt: new Date(Math.min(access.closesAt.getTime(), schedule.endsAt.getTime())).toISOString(),
        partner })
    }
  }
  return { modules: available }
}

export async function submitAccessAppeal(input: { courseId: string; moduleId: string; reason: string }) {
  const user = await actor()
  if (user?.role !== "student") return { error: "An active student account is required." }
  const parsed = z.object({ courseId: objectId, moduleId: objectId, reason: z.string().trim().min(10).max(3000) }).safeParse(input)
  if (!parsed.success) return { error: "Provide a reason (10–3000 characters)." }
  const { courseId, moduleId, reason } = parsed.data
  const access = await getStudentModuleAccess(String(user._id), courseId, moduleId)
  if (!["module_ended", "course_ended"].includes(access.reason)) return { error: "Appeals are available only for closed modules in your admitted course." }
  const admission = await getAcceptedCohortApplication(String(user._id), courseId)
  if (!admission) return { error: "An accepted cohort application is required." }
  const { schedule, application } = admission
  if (!access.opensAt || access.opensAt > new Date()) return { error: "This module has not opened yet." }
  // The accountability partner is the supervisor on record from the cohort application.
  const details = {
    reason,
    superiorName: application.partnerName,
    superiorRole: "Accountability partner",
    superiorEmail: application.partnerEmail || "",
    superiorPhone: application.partnerPhone || "",
  }
  try {
    await AccessAppeal.create({ student: user._id, course: courseId, module: moduleId, cohort: schedule.cohort, schedule: schedule._id, ...details })
    refresh()
    return { success: true } as const
  } catch (error) {
    return { error: (error as { code?: number }).code === 11000 ? "You already have a pending appeal for this module." : "Unable to submit your appeal. Please retry." }
  }
}

export async function decideAccessAppeal(appealId: string, decision: "approved" | "rejected") {
  const user = await actor()
  if (user?.role !== "admin") return { error: "Unauthorized" }
  if (!objectId.safeParse(appealId).success || !["approved", "rejected"].includes(decision)) return { error: "Invalid appeal decision." }
  const appeal = await AccessAppeal.findOne({ _id: appealId, status: "pending" }).lean()
  if (!appeal) return { error: "This appeal has already been reviewed or no longer exists." }
  const now = new Date()
  let grant = {}
  if (decision === "approved") {
    const [student, schedule, mod, enrolled] = await Promise.all([
      User.findOne({ _id: appeal.student, role: "student", isActive: true }).select("_id").lean(),
      CohortSchedule.findOne({ _id: appeal.schedule, course: appeal.course, cohort: appeal.cohort }).lean(),
      Module.exists({ _id: appeal.module, course: appeal.course, isPublished: true }),
      StudentProgress.exists({ student: appeal.student, course: appeal.course }),
    ])
    if (!student || !schedule || !mod || !enrolled || now < schedule.startsAt) return { error: "The student, enrollment or cohort schedule has changed. This appeal cannot be approved." }
    const admission = await getAcceptedCohortApplication(String(appeal.student), String(appeal.course), now)
    if (!admission || !admission.schedule._id.equals(schedule._id)) return { error: "This appeal is not for the student’s current accepted cohort schedule." }
    const accessClosesAt = new Date(now.getTime() + DAY_MS)
    grant = { accessOpensAt: now, accessClosesAt, courseEndsAt: new Date(Math.max(schedule.endsAt.getTime(), accessClosesAt.getTime())) }
  }
  const result = await AccessAppeal.updateOne({ _id: appealId, status: "pending" }, { $set: { status: decision, decidedBy: user._id, decidedAt: now, ...grant } }, { runValidators: true })
  if (result.modifiedCount !== 1) return { error: "Another administrator already reviewed this appeal." }
  refresh()
  return { success: true } as const
}

// ─── Cohort roster & export ──────────────────────────────────────────────────

/** Every admitted student in a cohort with their profile, partner and completion state. */
export async function getCohortRoster() {
  const user = await actor()
  if (user?.role !== "admin") return { error: "Unauthorized" } as const
  await connectDB()

  const schedules = await CohortSchedule.find({}).sort({ startsAt: -1 }).lean()
  const courses = await Course.find({ _id: { $in: schedules.map((s) => s.course) } }).select("title").lean()
  const courseTitles = new Map(courses.map((c) => [String(c._id), c.title]))

  const applications = await CohortApplication.find({ status: "accepted" })
    .select("student course schedule cohort state district church partnerName partnerEmail respondedAt")
    .lean()

  const students = await User.find({ _id: { $in: applications.map((a) => a.student) } })
    .select("name email state district church isActive")
    .lean()
  const studentMap = new Map(students.map((s) => [String(s._id), s]))

  const progress = await StudentProgress.find({ student: { $in: applications.map((a) => a.student) } })
    .select("student course completedModules examPassed certificateIssued")
    .lean()
  const progressMap = new Map(progress.map((p) => [`${String(p.student)}:${String(p.course)}`, p]))

  const certificates = await Certificate.find({ student: { $in: applications.map((a) => a.student) } })
    .select("student course serial")
    .lean()
  const certificateMap = new Map(certificates.map((c) => [`${String(c.student)}:${String(c.course)}`, c.serial ?? ""]))

  return {
    cohorts: schedules.map((s) => ({
      id: String(s._id),
      label: `${courseTitles.get(String(s.course)) ?? "Course"} · ${s.cohort}`,
      cohort: s.cohort,
      courseTitle: courseTitles.get(String(s.course)) ?? "Course",
      startDate: s.startDate,
      endDate: s.endDate,
      students: applications.filter((a) => String(a.schedule) === String(s._id)).map((a) => {
        const student = studentMap.get(String(a.student))
        const key = `${String(a.student)}:${String(a.course)}`
        const p = progressMap.get(key)
        return {
          id: String(a.student),
          name: student?.name ?? "Former student",
          email: student?.email ?? "",
          state: a.state || student?.state || "",
          district: a.district || student?.district || "",
          branch: a.church || student?.church || "",
          pastorName: a.partnerName,
          pastorEmail: a.partnerEmail,
          isActive: student?.isActive ?? false,
          completedModules: p?.completedModules.length ?? 0,
          examPassed: p?.examPassed ?? false,
          certificateIssued: p?.certificateIssued ?? false,
          serial: certificateMap.get(key) ?? "",
        }
      }),
    })),
  }
}
