import "server-only"
import { connectDB } from "@/lib/mongoose"
import Course from "@/models/Course.model"
import Module from "@/models/Module.model"
import Lesson from "@/models/Lesson.model"
import CohortSchedule from "@/models/CohortSchedule.model"
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
export type PublicCourseStatus = "open" | "started" | "none"

export type PublicCourseFilters = {
  search?: string
  status?: PublicCourseStatus | "all"
  price?: "all" | "free" | "paid"
  page?: number
  pageSize?: number
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export async function getPublicCourses(filters: PublicCourseFilters = {}) {
  await connectDB()

  const search = filters.search?.trim().slice(0, 100) ?? ""
  const searchRegex = search ? new RegExp(escapeRegex(search), "i") : null
  const pageSize = Math.min(24, Math.max(1, Math.trunc(filters.pageSize ?? 6)))
  const requestedPage = Math.max(1, Math.trunc(filters.page ?? 1))

  const courses = await Course.find({
    isPublished: true,
    ...(searchRegex ? { $or: [{ title: searchRegex }, { description: searchRegex }] } : {}),
    ...(filters.price === "free" ? { isPaid: false } : {}),
    ...(filters.price === "paid" ? { isPaid: true } : {}),
  })
    .populate("teacher", "name")
    .sort({ createdAt: 1 })
    .lean()

  const courseIds = courses.map((course) => course._id)
  const schedules = await CohortSchedule.find({ course: { $in: courseIds } })
    .sort({ startsAt: 1 })
    .lean()
  const now = new Date()

  const annotated = courses.map((course) => {
    const courseSchedules = schedules.filter((schedule) => schedule.course.equals(course._id))
    const open = courseSchedules.find((schedule) => isApplicationOpen(schedule, now)) ?? null
    const latest = courseSchedules[courseSchedules.length - 1] ?? null
    const teacher = course.teacher as unknown as { name?: string } | null

    return {
      id: course._id.toString(),
      title: course.title,
      description: course.description,
      coverImageUrl: course.coverImageUrl ?? null,
      isPaid: course.isPaid ?? false,
      price: course.price ?? 0,
      teacherName: teacher?.name ?? "Living Faith Foundation",
      status: open ? "open" as const : latest ? "started" as const : "none" as const,
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

  const normalizedSearch = search.toLowerCase()
  const filtered = annotated.filter((course) => {
    const matchesStatus = !filters.status || filters.status === "all" || course.status === filters.status
    const matchesSearch = !normalizedSearch || [course.title, course.description, course.teacherName]
      .some((value) => value.toLowerCase().includes(normalizedSearch))
    return matchesStatus && matchesSearch
  })

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(requestedPage, totalPages)
  const pageCourses = filtered.slice((page - 1) * pageSize, page * pageSize)
  const moduleCounts = await Promise.all(
    pageCourses.map((course) => Module.countDocuments({ course: course.id, isPublished: true }))
  )

  return {
    courses: pageCourses.map((course, index) => ({ ...course, moduleCount: moduleCounts[index] })),
    total,
    page,
    pageSize,
    totalPages,
  }
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
