import "server-only"
import { connectDB } from "@/lib/mongoose"
import Course from "@/models/Course.model"
import Module from "@/models/Module.model"
import Lesson from "@/models/Lesson.model"
import CohortSchedule from "@/models/CohortSchedule.model"
import User from "@/models/User.model"
import { applicationClosesAt, isApplicationOpen } from "@/lib/cohort-time"

/**
 * Public course catalogue. No login required. Each course is annotated with the
 * application status of its cohorts so a visitor can tell whether they can apply
 * now or must wait for the next intake.
 *
 * status:
 *  - "open"    -> a cohort is accepting applications (up to 7 days after it starts)
 *  - "started" -> registration for the latest cohort has closed; wait for the next one
 *  - "none"    -> no cohort scheduled yet
 */
export async function getPublicCourses() {
  await connectDB()
  const courses = await Course.find({ isPublished: true })
    .populate("teacher", "name")
    .sort({ createdAt: 1 })
    .lean()
  const courseIds = courses.map((c) => c._id)
  const [schedules, moduleCounts] = await Promise.all([
    CohortSchedule.find({ course: { $in: courseIds } }).sort({ startsAt: 1 }).lean(),
    Promise.all(courseIds.map((id) => Module.countDocuments({ course: id, isPublished: true }))),
  ])

  const now = new Date()
  return courses.map((c, i) => {
    const courseSchedules = schedules.filter((s) => s.course.equals(c._id))
    const open = courseSchedules.find((s) => isApplicationOpen(s, now)) ?? null
    const latest = courseSchedules[courseSchedules.length - 1] ?? null
    const status = open ? "open" : latest ? "started" : "none"
    const teacher = c.teacher as unknown as { name?: string } | null
    return {
      id: c._id.toString(),
      title: c.title,
      description: c.description,
      coverImageUrl: c.coverImageUrl ?? null,
      isPaid: c.isPaid ?? false,
      price: c.price ?? 0,
      teacherName: teacher?.name ?? "Living Faith Foundation",
      moduleCount: moduleCounts[i],
      status,
      cohortName: open?.cohort ?? latest?.cohort ?? null,
      startDate: open?.startDate ?? latest?.startDate ?? null,
      endDate: open?.endDate ?? latest?.endDate ?? null,
      registrationClosesAt: open
        ? applicationClosesAt(new Date(open.startsAt), open.registrationClosesAt).toISOString()
        : latest
          ? applicationClosesAt(new Date(latest.startsAt), latest.registrationClosesAt).toISOString()
          : null,
      scheduleId: open ? open._id.toString() : null,
    }
  })
}

/** Public detail for one course, including the visible curriculum outline. */
export async function getPublicCourse(courseId: string) {
  if (!/^[a-f0-9]{24}$/i.test(courseId)) return null
  await connectDB()
  const course = await Course.findOne({ _id: courseId, isPublished: true })
    .populate("teacher", "name")
    .lean()
  if (!course) return null

  const modules = await Module.find({ course: courseId, isPublished: true }).sort({ order: 1 }).lean()
  const lessonCounts = await Promise.all(
    modules.map((m) => Lesson.countDocuments({ module: m._id, isPublished: true }))
  )
  const schedules = await CohortSchedule.find({ course: courseId }).sort({ startsAt: 1 }).lean()
  const now = new Date()
  const open = schedules.find((s) => isApplicationOpen(s, now)) ?? null
  const latest = schedules[schedules.length - 1] ?? null
  const teacher = course.teacher as unknown as { name?: string } | null

  return {
    id: course._id.toString(),
    title: course.title,
    description: course.description,
    coverImageUrl: course.coverImageUrl ?? null,
    isPaid: course.isPaid ?? false,
    price: course.price ?? 0,
    teacherName: teacher?.name ?? "Living Faith Foundation",
    status: open ? "open" : latest ? "started" : "none",
    cohortName: open?.cohort ?? latest?.cohort ?? null,
    startDate: open?.startDate ?? latest?.startDate ?? null,
    endDate: open?.endDate ?? latest?.endDate ?? null,
    registrationClosesAt: open
      ? applicationClosesAt(new Date(open.startsAt), open.registrationClosesAt).toISOString()
      : latest
        ? applicationClosesAt(new Date(latest.startsAt), latest.registrationClosesAt).toISOString()
        : null,
    scheduleId: open ? open._id.toString() : null,
    modules: modules.map((m, i) => ({
      id: m._id.toString(),
      title: m.title,
      order: m.order,
      lessonCount: lessonCounts[i],
    })),
  }
}
