"use server"

import { auth } from "@/auth"
import { connectDB } from "@/lib/mongoose"
import { buildXlsx } from "@/lib/xlsx"
import { Types } from "mongoose"
import Certificate from "@/models/Certificate.model"
import CohortApplication from "@/models/CohortApplication.model"
import CohortSchedule from "@/models/CohortSchedule.model"
import Course from "@/models/Course.model"
import Module from "@/models/Module.model"
import StudentProgress from "@/models/StudentProgress.model"
import User from "@/models/User.model"

export type CohortLifecycle = "upcoming" | "active" | "ended"

export type CohortStudent = {
  id: string
  name: string
  email: string
  state: string
  district: string
  branch: string
  pastorName: string
  pastorEmail: string
  phone: string
  completedModules: number
  totalModules: number
  examPassed: boolean
  certificateId: string
  certificateIssuedAt: string | null
  isActive: boolean
  completed: boolean
}

export type CohortRow = {
  id: string
  cohort: string
  courseTitle: string
  startDate: string
  endDate: string
  status: CohortLifecycle
  daysRemaining: number | null
  students: number
  completed: number
  inProgress: number
  certificates: number
  completionRate: number
}

export type CohortOverview = {
  rows: CohortRow[]
  total: number
  page: number
  pageSize: number
  pages: number
  stats: {
    cohorts: number
    active: number
    upcoming: number
    ended: number
    students: number
    completed: number
    certificates: number
  }
  cohortOptions: string[]
}

type ScheduleLean = {
  _id: Types.ObjectId
  course: Types.ObjectId
  cohort: string
  startDate: string
  endDate: string
  startsAt: Date
  endsAt: Date
}

async function adminActor() {
  const session = await auth()
  if (session?.user?.role !== "admin") return null
  await connectDB()
  return session.user
}

function lifecycleOf(schedule: ScheduleLean, now: number): CohortLifecycle {
  if (schedule.startsAt.getTime() > now) return "upcoming"
  if (schedule.endsAt.getTime() < now) return "ended"
  return "active"
}

const DAY_MS = 24 * 60 * 60 * 1000

type BuiltCohort = {
  schedule: ScheduleLean
  courseTitle: string
  students: CohortStudent[]
  totalModules: number
}

/** Loads every matching cohort with its admitted students and completion state. */
async function buildCohorts(filter: Record<string, unknown>): Promise<BuiltCohort[]> {
  const schedules = await CohortSchedule.find(filter).sort({ startsAt: -1 }).lean<ScheduleLean[]>()
  if (schedules.length === 0) return []

  const courseIds = [...new Set(schedules.map((s) => String(s.course)))]
  const scheduleIds = schedules.map((s) => s._id)

  const [courses, applications, moduleCounts] = await Promise.all([
    Course.find({ _id: { $in: courseIds } }).select("title").lean(),
    CohortApplication.find({ status: "accepted", schedule: { $in: scheduleIds } })
      .select("student course schedule cohort state district church partnerName partnerEmail partnerPhone")
      .lean(),
    Module.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { course: { $in: courseIds.map((id) => new Types.ObjectId(id)) }, isPublished: true } },
      { $group: { _id: "$course", count: { $sum: 1 } } },
    ]),
  ])

  const titles = new Map(courses.map((c) => [String(c._id), c.title]))
  const modulesByCourse = new Map(moduleCounts.map((m) => [String(m._id), m.count]))

  const studentIds = [...new Set(applications.map((a) => String(a.student)))]
  const [students, progress, certificates] = await Promise.all([
    User.find({ _id: { $in: studentIds } }).select("name email state district church isActive").lean(),
    StudentProgress.find({ student: { $in: studentIds } }).select("student course completedModules examPassed").lean(),
    Certificate.find({ student: { $in: studentIds } }).select("student course serial issuedAt").lean(),
  ])

  const studentMap = new Map(students.map((s) => [String(s._id), s]))
  const progressMap = new Map(progress.map((p) => [`${String(p.student)}:${String(p.course)}`, p]))
  const certificateMap = new Map(certificates.map((c) => [`${String(c.student)}:${String(c.course)}`, c]))
  const applicationsBySchedule = new Map<string, typeof applications>()
  for (const application of applications) {
    const key = String(application.schedule)
    const list = applicationsBySchedule.get(key) ?? []
    list.push(application)
    applicationsBySchedule.set(key, list)
  }

  return schedules.map((schedule) => {
    const totalModules = modulesByCourse.get(String(schedule.course)) ?? 0
    const admitted = applicationsBySchedule.get(String(schedule._id)) ?? []
    const roster: CohortStudent[] = admitted.map((application) => {
      const student = studentMap.get(String(application.student))
      const key = `${String(application.student)}:${String(application.course)}`
      const p = progressMap.get(key)
      const certificate = certificateMap.get(key)
      const completedModules = p?.completedModules.length ?? 0
      const examPassed = p?.examPassed ?? false
      const completed = totalModules > 0 && completedModules >= totalModules && examPassed
      return {
        id: String(application.student),
        name: student?.name ?? "Former student",
        email: student?.email ?? "",
        state: application.state || student?.state || "",
        district: application.district || student?.district || "",
        branch: application.church || student?.church || "",
        pastorName: application.partnerName,
        pastorEmail: application.partnerEmail,
        phone: application.partnerPhone ?? "",
        completedModules,
        totalModules,
        examPassed,
        certificateId: certificate?.serial ?? "",
        certificateIssuedAt: certificate?.issuedAt ? certificate.issuedAt.toISOString() : null,
        isActive: student?.isActive ?? false,
        completed,
      }
    })

    return {
      schedule,
      courseTitle: titles.get(String(schedule.course)) ?? "Course",
      students: roster,
      totalModules,
    }
  })
}

function summarize(built: BuiltCohort, now: number): CohortRow {
  const { schedule, students } = built
  const completed = students.filter((s) => s.completed).length
  const certificates = students.filter((s) => s.certificateId).length
  const status = lifecycleOf(schedule, now)
  return {
    id: String(schedule._id),
    cohort: schedule.cohort,
    courseTitle: built.courseTitle,
    startDate: schedule.startDate,
    endDate: schedule.endDate,
    status,
    daysRemaining: status === "ended" ? 0 : Math.max(0, Math.ceil((schedule.endsAt.getTime() - now) / DAY_MS)),
    students: students.length,
    completed,
    inProgress: Math.max(0, students.length - completed),
    certificates,
    completionRate: students.length ? Math.round((completed / students.length) * 100) : 0,
  }
}

export async function getCohortOverview(params: {
  page?: number
  pageSize?: number
  cohort?: string
  status?: CohortLifecycle | "all"
  query?: string
}): Promise<CohortOverview | { error: string }> {
  const user = await adminActor()
  if (!user) return { error: "Unauthorized" }

  const now = Date.now()
  const pageSize = Math.min(50, Math.max(5, Math.round(Number(params.pageSize) || 10)))
  const page = Math.max(1, Math.round(Number(params.page) || 1))
  const cohort = (params.cohort ?? "").trim()
  const query = (params.query ?? "").trim().slice(0, 120)
  const status = params.status && ["upcoming", "active", "ended"].includes(params.status) ? params.status : "all"

  const filter: Record<string, unknown> = {}
  if (cohort && cohort !== "all") filter.cohort = cohort
  if (status === "upcoming") filter.startsAt = { $gt: new Date(now) }
  if (status === "active") filter.startsAt = { $lte: new Date(now) }; filter.endsAt = { $gte: new Date(now) }
  if (status === "ended") filter.endsAt = { $lt: new Date(now) }
  if (query) {
    const rx = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
    const courses = await Course.find({ title: rx }).select("_id").limit(200).lean()
    filter.$or = [{ cohort: rx }, { course: { $in: courses.map((c) => c._id) } }]
  }

  const [built, cohortOptions] = await Promise.all([
    buildCohorts(filter),
    CohortSchedule.distinct("cohort"),
  ])

  const allRows = built.map((entry) => summarize(entry, now))
  const start = (page - 1) * pageSize

  return {
    rows: allRows.slice(start, start + pageSize),
    total: allRows.length,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(allRows.length / pageSize)),
    stats: {
      cohorts: allRows.length,
      active: allRows.filter((r) => r.status === "active").length,
      upcoming: allRows.filter((r) => r.status === "upcoming").length,
      ended: allRows.filter((r) => r.status === "ended").length,
      students: allRows.reduce((sum, r) => sum + r.students, 0),
      completed: allRows.reduce((sum, r) => sum + r.completed, 0),
      certificates: allRows.reduce((sum, r) => sum + r.certificates, 0),
    },
    cohortOptions: (cohortOptions as string[]).filter(Boolean).sort(),
  }
}

export type CohortDetail = {
  row: CohortRow
  courseTitle: string
  cohort: string
  startDate: string
  endDate: string
  students: CohortStudent[]
}

export async function getCohortDetail(scheduleId: string): Promise<CohortDetail | { error: string }> {
  const user = await adminActor()
  if (!user) return { error: "Unauthorized" }
  if (!Types.ObjectId.isValid(scheduleId)) return { error: "Cohort not found" }

  const [built] = await buildCohorts({ _id: new Types.ObjectId(scheduleId) })
  if (!built) return { error: "Cohort not found" }

  return {
    row: summarize(built, Date.now()),
    courseTitle: built.courseTitle,
    cohort: built.schedule.cohort,
    startDate: built.schedule.startDate,
    endDate: built.schedule.endDate,
    students: built.students.sort((a, b) => a.name.localeCompare(b.name)),
  }
}

const EXPORT_HEADERS = [
  "Student name", "Email", "Phone", "State", "Church district", "Church branch",
  "Accountability partner", "Partner email", "Course", "Cohort", "Cohort start", "Cohort end",
  "Modules completed", "Modules total", "Exam passed", "Completed cohort", "Certificate ID",
  "Certificate issued on", "Account active",
]

function exportRows(detail: CohortDetail): (string | number)[][] {
  return detail.students.map((student) => [
    student.name,
    student.email,
    student.phone,
    student.state,
    student.district,
    student.branch,
    student.pastorName,
    student.pastorEmail,
    detail.courseTitle,
    detail.cohort,
    detail.startDate,
    detail.endDate,
    student.completedModules,
    student.totalModules,
    student.examPassed ? "Yes" : "No",
    student.completed ? "Yes" : "No",
    student.certificateId,
    student.certificateIssuedAt ? new Date(student.certificateIssuedAt).toISOString().slice(0, 10) : "",
    student.isActive ? "Yes" : "No",
  ])
}

/** Row data for the client-side CSV export (and the on-screen roster). */
export async function getCohortExportData(scheduleId: string) {
  const detail = await getCohortDetail(scheduleId)
  if ("error" in detail) return detail
  return {
    filename: `${detail.courseTitle}-${detail.cohort}`.replace(/[^\w.-]+/g, "-"),
    headers: EXPORT_HEADERS,
    rows: exportRows(detail),
    summary: detail.row,
  }
}

/** Server-built .xlsx (students sheet + summary sheet) returned as base64. */
export async function exportCohortXlsx(scheduleId: string) {
  const detail = await getCohortDetail(scheduleId)
  if ("error" in detail) return detail

  const workbook = buildXlsx([
    {
      name: "Students",
      columns: EXPORT_HEADERS.map((header) => ({
        header,
        width: header === "Email" || header === "Partner email" ? 30 : header === "Student name" || header === "Course" ? 26 : 18,
      })),
      rows: exportRows(detail),
    },
    {
      name: "Summary",
      columns: [{ header: "Measure", width: 30 }, { header: "Value", width: 30 }],
      rows: [
        ["Course", detail.courseTitle],
        ["Cohort", detail.cohort],
        ["Start date", detail.startDate],
        ["End date", detail.endDate],
        ["Cohort status", detail.row.status],
        ["Students admitted", detail.row.students],
        ["Students completed", detail.row.completed],
        ["Completion rate", `${detail.row.completionRate}%`],
        ["Certificates issued", detail.row.certificates],
        ["Exported on", new Date().toISOString().slice(0, 10)],
      ],
    },
  ])

  return {
    filename: `${detail.courseTitle}-${detail.cohort}`.replace(/[^\w.-]+/g, "-") + ".xlsx",
    base64: workbook.toString("base64"),
  }
}
