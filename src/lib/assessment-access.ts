import "server-only"
import { Types } from "mongoose"
import { getStudentCourseAccess, getStudentModuleAccess } from "@/lib/cohort-access"
import Lesson from "@/models/Lesson.model"
import Module from "@/models/Module.model"
import StudentProgress from "@/models/StudentProgress.model"

export async function getAssessmentAccess(studentId: string, assessment: { course: Types.ObjectId; module?: Types.ObjectId; type: string }) {
  const courseId = assessment.course.toString()
  const access = assessment.module
    ? await getStudentModuleAccess(studentId, courseId, assessment.module.toString())
    : await getStudentCourseAccess(studentId, courseId)
  if (!access.allowed) return access
  const progress = await StudentProgress.findOne({ student: studentId, course: courseId }).lean()
  if (!progress) return { allowed: false, reason: "You are not enrolled in this course" }
  if (assessment.module) {
    const lessons = await Lesson.find({ module: assessment.module, isPublished: true, lessonType: "video" }).select("_id").lean()
    const viewed = new Set([...(progress.viewedLessons ?? []), ...progress.completedLessons].map(String))
    if (lessons.some(l => !viewed.has(String(l._id)))) return { allowed: false, reason: "Watch the module video before taking its test" }
  }
  if (assessment.type === "exam") {
    const modules = await Module.find({ course: courseId, isPublished: true }).select("_id").lean()
    const completed = new Set(progress.completedModules.map(String))
    if (!modules.length || modules.some(m => !completed.has(String(m._id)))) return { allowed: false, reason: "Complete every module before taking the final exam" }
  }
  return access
}
