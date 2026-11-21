import "server-only"
import { Types } from "mongoose"
import { connectDB } from "@/lib/mongoose"
import User from "@/models/User.model"
import Course from "@/models/Course.model"
import Module from "@/models/Module.model"
import StudentProgress from "@/models/StudentProgress.model"
import PaymentTransaction from "@/models/PaymentTransaction.model"
import { getAcceptedCohortApplication } from "@/lib/cohort-application"
import AccessAppeal from "@/models/AccessAppeal.model"
import ModuleAttendance from "@/models/ModuleAttendance.model"
import Lesson from "@/models/Lesson.model"
import Test from "@/models/Test.model"
import Assessment from "@/models/Assessment.model"
import TestSubmission from "@/models/TestSubmission.model"
import Submission from "@/models/Submission.model"
import { courseWindowAccess, moduleWindow, moduleWindowAccess, type AccessResult, type ModuleAccessResult } from "./cohort-time"

export async function getStudentCourseAccess(studentId: string, courseId: string, now = new Date()): Promise<AccessResult> {
  if (![studentId, courseId].every(Types.ObjectId.isValid)) return { allowed: false, reason: "invalid_id" }
  await connectDB()
  const [student, course] = await Promise.all([
    User.findById(studentId).select("role isActive cohort").lean(),
    Course.findById(courseId).select("isPublished").lean(),
  ])
  if (!student || student.role !== "student" || !student.isActive) return { allowed: false, reason: "student_inactive" }
  if (!course?.isPublished) return { allowed: false, reason: "course_unavailable" }
  const admission = await getAcceptedCohortApplication(studentId, courseId, now)
  if (!admission) return { allowed: false, reason: "pastor_acceptance_required" }
  const { schedule } = admission
  const extension = await AccessAppeal.findOne({ student: studentId, course: courseId, cohort: schedule.cohort, schedule: schedule._id, status: "approved" })
    .sort({ courseEndsAt: -1 }).select("courseEndsAt").lean()
  return courseWindowAccess(schedule.startsAt, schedule.endsAt, extension?.courseEndsAt, now)
}

export async function getStudentModuleAccess(studentId: string, courseId: string, moduleId: string, now = new Date()): Promise<ModuleAccessResult> {
  const courseAccess = await getStudentCourseAccess(studentId, courseId, now)
  if (!Types.ObjectId.isValid(moduleId)) return { ...courseAccess, allowed: false, reason: "invalid_id" }
  if (!courseAccess.startsAt) return courseAccess
  const [progress, course, modules, admission] = await Promise.all([
    StudentProgress.exists({ student: studentId, course: courseId }),
    Course.findById(courseId).select("isPaid price").lean(),
    Module.find({ course: courseId }).sort({ order: 1, _id: 1 }).select("isPublished").lean(),
    getAcceptedCohortApplication(studentId, courseId, now),
  ])
  if (!progress) return { ...courseAccess, allowed: false, reason: "not_enrolled" }
  const index = modules.findIndex(m => m._id.toString() === moduleId)
  if (index < 0 || !modules[index].isPublished) return { ...courseAccess, allowed: false, reason: "module_unavailable" }
  if (course?.isPaid && !await PaymentTransaction.exists({ student: studentId, course: courseId, status: "success", amount: { $gte: course.price ?? 0 } })) {
    return { ...courseAccess, allowed: false, reason: "payment_required" }
  }
  if (!admission) return { ...courseAccess, allowed: false, reason: "pastor_acceptance_required" }
  const { schedule } = admission
  const grant = await AccessAppeal.findOne({ student: studentId, course: courseId, module: moduleId, cohort: schedule.cohort, schedule: schedule._id, status: "approved", accessOpensAt: { $lte: now }, accessClosesAt: { $gt: now } })
    .sort({ accessClosesAt: -1 }).lean()
  if (!courseAccess.startsAt || !courseAccess.endsAt) return courseAccess
  const grantWindow = grant?.accessOpensAt && grant.accessClosesAt
    ? { opensAt: grant.accessOpensAt, closesAt: grant.accessClosesAt }
    : undefined
  // Fixed daily schedule: each module opens for exactly 24 hours, one per day.
  const window = moduleWindow(courseAccess.startsAt, index)
  const closesAt = new Date(Math.min(window.closesAt.getTime(), courseAccess.endsAt.getTime()))
  return moduleWindowAccess(courseAccess, window.opensAt, closesAt, grantWindow, now)
}

/** Snapshot the student's actual unlock window once; later schedule edits do not erase history. */
export async function ensureModuleAttendance(studentId: string, courseId: string, moduleId: string, now = new Date()) {
  await connectDB()
  const admission = await getAcceptedCohortApplication(studentId, courseId, now)
  if (!admission || !await StudentProgress.exists({ student: studentId, course: courseId })) return null
  const { schedule } = admission
  const courseAccess = await getStudentCourseAccess(studentId, courseId, now)
  if (!courseAccess.startsAt || !courseAccess.endsAt) return null
  const modules = await Module.find({ course: courseId }).sort({ order: 1, _id: 1 }).select("_id isPublished").lean()
  const index = modules.findIndex(m => m._id.toString() === moduleId)
  if (index < 0) return null
  const window = moduleWindow(courseAccess.startsAt, index)
  const closesAt = new Date(Math.min(window.closesAt.getTime(), schedule.endsAt.getTime()))
  const key = { student: studentId, schedule: schedule._id, module: moduleId }
  const existing = await ModuleAttendance.findOne(key)
  if (existing) {
    // Keep the original window once attendance has been evaluated (absence records rely on it).
    if (existing.evaluatedAt) return existing
    return ModuleAttendance.findOneAndUpdate(
      { _id: existing._id },
      { $set: { opensAt: window.opensAt, closesAt } },
      { new: true }
    )
  }
  try {
    return await ModuleAttendance.create({
      ...key,
      course: courseId,
      cohort: schedule.cohort,
      opensAt: window.opensAt,
      closesAt,
    })
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error
    return ModuleAttendance.findOne(key)
  }
}

export async function recordStudentLessonView(studentId: string, courseId: string, moduleId: string, lessonId: string, now = new Date()) {
  if (!(await getStudentModuleAccess(studentId, courseId, moduleId, now)).allowed) return
  if (!await Lesson.exists({ _id: lessonId, course: courseId, module: moduleId, isPublished: true })) return
  const attendance = await ensureModuleAttendance(studentId, courseId, moduleId, now)
  if (!attendance || now >= attendance.closesAt) return
  await ModuleAttendance.updateOne({ _id: attendance._id, [`lessonViews.${lessonId}`]: { $exists: false } }, { $set: { [`lessonViews.${lessonId}`]: now } })
}

/** Inspect actual lessons AND both assessment systems. Never rely on completedModules. */
export async function getModuleCompletionAtDeadline(studentId: string, courseId: string, moduleId: string, deadline: Date, scheduleId?: string) {
  const [lessons, progress, attendance, assessments] = await Promise.all([
    Lesson.find({ course: courseId, module: moduleId, isPublished: true }).select("_id").lean(),
    StudentProgress.findOne({ student: studentId, course: courseId }).lean(),
    ModuleAttendance.findOne({ student: studentId, course: courseId, module: moduleId, ...(scheduleId ? { schedule: scheduleId } : {}) }).sort({ opensAt: -1 }).lean(),
    Assessment.find({ course: courseId, module: moduleId, isPublished: true, type: { $ne: "exam" } }).select("_id").lean(),
  ])
  const tests = await Test.find({ course: courseId, lesson: { $in: lessons.map(l => l._id) }, isPublished: true }).select("_id").lean()
  const [testPasses, assessmentPasses] = await Promise.all([
    TestSubmission.find({ student: studentId, test: { $in: tests.map(t => t._id) }, passed: true, submittedAt: { $lt: deadline } }).select("test").lean(),
    Submission.find({ student: studentId, assessment: { $in: assessments.map(a => a._id) }, passed: true, submittedAt: { $lt: deadline } }).select("assessment").lean(),
  ])
  // Legacy progress lacks per-lesson timestamps: use it only if its last update predates the deadline.
  const legacy = progress && progress.updatedAt < deadline ? new Set([
    ...progress.completedLessons.map(String),
    ...((progress as unknown as { viewedLessons?: Types.ObjectId[] }).viewedLessons ?? []).map(String),
  ]) : new Set<string>()
  const views = attendance?.lessonViews as unknown as Record<string, Date> | undefined
  const missingLessons = lessons.map(l => String(l._id)).filter(id => !(views?.[id] && new Date(views[id]) < deadline) && !legacy.has(id))
  const passed = new Set([...testPasses.map(t => String(t.test)), ...assessmentPasses.map(a => String(a.assessment))])
  const missingTests = [...tests, ...assessments].map(t => String(t._id)).filter(id => !passed.has(id))
  return { complete: lessons.length > 0 && missingLessons.length === 0 && missingTests.length === 0, missingLessons, missingTests }
}

export async function recordStudentModuleActivity(studentId: string, courseId: string, moduleId: string, now = new Date()) {
  const attendance = await ensureModuleAttendance(studentId, courseId, moduleId, now)
  if (!attendance || now >= attendance.closesAt || now < attendance.opensAt) return
  const completion = await getModuleCompletionAtDeadline(studentId, courseId, moduleId, new Date(now.getTime() + 1))
  if (completion.complete) await ModuleAttendance.updateOne({ _id: attendance._id, completedAt: { $exists: false } }, { $set: { completedAt: now } })
}
