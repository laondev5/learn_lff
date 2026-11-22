"use server"

import { auth } from "@/auth"
import { connectDB } from "@/lib/mongoose"
import { Types } from "mongoose"
import AccessAppeal from "@/models/AccessAppeal.model"
import CohortSchedule from "@/models/CohortSchedule.model"
import Course from "@/models/Course.model"
import Module from "@/models/Module.model"
import StudentProgress from "@/models/StudentProgress.model"
import User from "@/models/User.model"

export type AppealStatus = "pending" | "approved" | "rejected"
export type AppealStatusFilter = AppealStatus | "all"
/** Legacy rows created before the status field existed render as "unknown". */
export type AppealRowStatus = AppealStatus | "unknown"

export type AppealRow = {
  id: string
  studentName: string
  studentEmail: string
  courseTitle: string
  moduleTitle: string
  cohort: string
  status: AppealRowStatus
  reason: string
  createdAt: string
  decidedAt: string | null
}

export type AppealsPage = {
  rows: AppealRow[]
  total: number
  page: number
  pageSize: number
  pages: number
  stats: { total: number; pending: number; approved: number; rejected: number }
  cohorts: string[]
}

export type AppealDetail = AppealRow & {
  studentId: string
  studentCohort: string
  studentActive: boolean
  superiorName: string
  superiorRole: string
  superiorEmail: string
  superiorPhone: string
  decidedByName: string | null
  accessOpensAt: string | null
  accessClosesAt: string | null
  courseEndsAt: string | null
  scheduleStart: string | null
  scheduleEnd: string | null
  completedModules: number
  totalModules: number
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

type PopulatedAppeal = {
  _id: Types.ObjectId
  student?: { _id: Types.ObjectId; name?: string; email?: string; cohort?: string; isActive?: boolean } | null
  course?: { title?: string } | null
  module?: { title?: string } | null
  decidedBy?: { name?: string } | null
  cohort: string
  reason?: string
  superiorName: string
  superiorRole: string
  superiorEmail: string
  superiorPhone: string
  status: AppealStatus
  createdAt: Date
  decidedAt?: Date | null
  accessOpensAt?: Date | null
  accessClosesAt?: Date | null
  courseEndsAt?: Date | null
}

function normalizeStatus(value: unknown): AppealRowStatus {
  return value === "pending" || value === "approved" || value === "rejected" ? value : "unknown"
}

function toRow(appeal: PopulatedAppeal): AppealRow {
  return {
    id: String(appeal._id),
    studentName: appeal.student?.name ?? "Former student",
    studentEmail: appeal.student?.email ?? "",
    courseTitle: appeal.course?.title ?? "Unavailable course",
    moduleTitle: appeal.module?.title ?? "Unavailable module",
    cohort: appeal.cohort,
    status: normalizeStatus(appeal.status),
    reason: appeal.reason ?? "",
    createdAt: appeal.createdAt.toISOString(),
    decidedAt: appeal.decidedAt ? appeal.decidedAt.toISOString() : null,
  }
}

/** Paginated, filterable appeal queue for the admin dashboard. */
export async function getAppealsPage(params: {
  page?: number
  pageSize?: number
  status?: AppealStatusFilter
  cohort?: string
  query?: string
}): Promise<AppealsPage | { error: string }> {
  const user = await adminActor()
  if (!user) return { error: "Unauthorized" }

  const pageSize = Math.min(50, Math.max(5, Math.round(Number(params.pageSize) || 10)))
  const page = Math.max(1, Math.round(Number(params.page) || 1))
  const status = params.status && ["pending", "approved", "rejected"].includes(params.status) ? params.status : "all"
  const cohort = (params.cohort ?? "").trim()
  const query = (params.query ?? "").trim().slice(0, 120)

  const base: Record<string, unknown> = {}
  if (cohort && cohort !== "all") base.cohort = cohort

  const filter: Record<string, unknown> = { ...base }
  if (status !== "all") filter.status = status

  if (query) {
    const rx = new RegExp(escapeRegex(query), "i")
    const [students, courses, modules] = await Promise.all([
      User.find({ $or: [{ name: rx }, { email: rx }] }).select("_id").limit(400).lean(),
      Course.find({ title: rx }).select("_id").limit(200).lean(),
      Module.find({ title: rx }).select("_id").limit(200).lean(),
    ])
    filter.$or = [
      { student: { $in: students.map((s) => s._id) } },
      { course: { $in: courses.map((c) => c._id) } },
      { module: { $in: modules.map((m) => m._id) } },
      { reason: rx },
      { superiorName: rx },
      { superiorEmail: rx },
    ]
  }

  const [total, docs, statusCounts, cohorts] = await Promise.all([
    AccessAppeal.countDocuments(filter),
    AccessAppeal.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate("student", "name email cohort isActive")
      .populate("course", "title")
      .populate("module", "title")
      .lean(),
    AccessAppeal.aggregate<{ _id: AppealStatus; count: number }>([
      { $match: base },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    AccessAppeal.distinct("cohort", base),
  ])

  const counts = { pending: 0, approved: 0, rejected: 0 }
  let allStatuses = 0
  for (const entry of statusCounts) {
    allStatuses += entry.count
    if (entry._id in counts) counts[entry._id] = entry.count
  }

  return {
    rows: (docs as unknown as PopulatedAppeal[]).map(toRow),
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    stats: { total: allStatuses, ...counts },
    cohorts: (cohorts as string[]).filter(Boolean).sort(),
  }
}

/** Full appeal record for the review dialog. */
export async function getAppealDetail(appealId: string): Promise<AppealDetail | { error: string }> {
  const user = await adminActor()
  if (!user) return { error: "Unauthorized" }
  if (!Types.ObjectId.isValid(appealId)) return { error: "Appeal not found" }

  const appeal = await AccessAppeal.findById(appealId)
    .populate("student", "name email cohort isActive")
    .populate("course", "title")
    .populate("module", "title")
    .populate("decidedBy", "name")
    .lean<PopulatedAppeal | null>()
  if (!appeal) return { error: "Appeal not found" }

  const [schedule, totalModules, progress] = await Promise.all([
    CohortSchedule.findOne({ course: (appeal.course as { _id?: Types.ObjectId } | null)?._id, cohort: appeal.cohort }).lean(),
    appeal.course ? Module.countDocuments({ course: (appeal.course as { _id?: Types.ObjectId })._id }) : 0,
    appeal.student
      ? StudentProgress.findOne({ student: appeal.student._id, course: (appeal.course as { _id?: Types.ObjectId } | null)?._id }).select("completedModules").lean()
      : null,
  ])

  return {
    ...toRow(appeal),
    studentId: appeal.student ? String(appeal.student._id) : "",
    studentCohort: appeal.student?.cohort ?? "",
    studentActive: appeal.student?.isActive ?? false,
    superiorName: appeal.superiorName ?? "",
    superiorRole: appeal.superiorRole ?? "",
    superiorEmail: appeal.superiorEmail ?? "",
    superiorPhone: appeal.superiorPhone ?? "",
    decidedByName: appeal.decidedBy?.name ?? null,
    accessOpensAt: appeal.accessOpensAt ? appeal.accessOpensAt.toISOString() : null,
    accessClosesAt: appeal.accessClosesAt ? appeal.accessClosesAt.toISOString() : null,
    courseEndsAt: appeal.courseEndsAt ? appeal.courseEndsAt.toISOString() : null,
    scheduleStart: schedule?.startDate ?? null,
    scheduleEnd: schedule?.endDate ?? null,
    completedModules: progress?.completedModules.length ?? 0,
    totalModules,
  }
}
