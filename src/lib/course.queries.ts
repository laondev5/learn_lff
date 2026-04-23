import "server-only"

import { auth } from "@/auth"
import { connectDB } from "@/lib/mongoose"
import Course from "@/models/Course.model"
import Module from "@/models/Module.model"
import Lesson from "@/models/Lesson.model"
import Test from "@/models/Test.model"
import Assessment from "@/models/Assessment.model"
import { Types } from "mongoose"

// ─── Course Queries ───────────────────────────────────────────────────────────

export async function getTeacherCourses() {
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") return []

  await connectDB()
  const courses = await Course.find({ teacher: session.user.id })
    .sort({ createdAt: -1 })
    .lean()

  return courses.map((c) => ({
    id: c._id.toString(),
    title: c.title,
    description: c.description,
    isPaid: c.isPaid ?? false,
    price: c.price ?? 0,
    isPublished: c.isPublished,
    createdAt: c.createdAt.toISOString(),
  }))
}

export async function getCourseWithModules(courseId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") return null

  await connectDB()
  const course = await Course.findOne({ _id: courseId, teacher: session.user.id }).lean()
  if (!course) return null

  const modules = await Module.find({ course: courseId }).sort({ order: 1 }).lean()

  const modulesWithLessons = await Promise.all(
    modules.map(async (mod) => {
      const lessons = await Lesson.find({ module: mod._id }).sort({ order: 1 }).lean()
      return {
        id: mod._id.toString(),
        title: mod.title,
        description: mod.description,
        order: mod.order,
        isPublished: mod.isPublished,
        lessons: lessons.map((l) => ({
          id: l._id.toString(),
          title: l.title,
          order: l.order,
          isPublished: l.isPublished,
        })),
      }
    })
  )

  return {
    id: course._id.toString(),
    title: course.title,
    description: course.description,
    isPaid: course.isPaid ?? false,
    price: course.price ?? 0,
    coverImageUrl: course.coverImageUrl ?? null,
    isPublished: course.isPublished,
    modules: modulesWithLessons,
  }
}

// ─── Module Queries ───────────────────────────────────────────────────────────

export async function getModuleWithLessons(moduleId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") return { error: "Not authenticated as teacher", sessionUser: session?.user }

  await connectDB()
  const cleanId = moduleId?.trim()
  
  if (!Types.ObjectId.isValid(cleanId)) return { error: "Invalid module ID format" }

  const mod = await Module.findById(cleanId).lean()
  if (!mod) return { error: "Module not found in database", requestedId: cleanId }

  const lessons = await Lesson.find({ module: cleanId }).sort({ order: 1 }).lean()
  const lessonsWithTests = await Promise.all(
    lessons.map(async (l) => {
      const test = await Test.findOne({ lesson: l._id }).lean()
      return {
        id: l._id.toString(),
        title: l.title,
        order: l.order,
        lessonType: l.lessonType ?? "text",
        content: l.content,
        videoUrl: l.videoUrl ?? null,
        youtubeVideoId: l.youtubeVideoId ?? null,
        isPublished: l.isPublished,
        hasTest: !!test,
        testId: test?._id.toString() ?? null,
      }
    })
  )

  return {
    id: mod._id.toString(),
    title: mod.title,
    description: mod.description,
    courseId: mod.course.toString(),
    isPublished: mod.isPublished,
    lessons: lessonsWithTests,
  }
}

// ─── Lesson Queries ───────────────────────────────────────────────────────────

export async function getLessonWithTest(lessonId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") return null

  await connectDB()
  const lesson = await Lesson.findById(lessonId).lean()
  if (!lesson) return null

  const test = await Test.findOne({ lesson: lessonId }).lean()

  return {
    id: lesson._id.toString(),
    title: lesson.title,
    lessonType: lesson.lessonType ?? "text",
    content: lesson.content,
    studentNotes: lesson.studentNotes ?? "",
    videoUrl: lesson.videoUrl ?? null,
    youtubeVideoId: lesson.youtubeVideoId ?? null,
    videoCues: (lesson.videoCues ?? []).map((cue) => ({
      id: cue._id?.toString() ?? "",
      timestamp: cue.timestamp,
      title: cue.title,
      questions: cue.questions.map((q) => ({
        text: q.text,
        type: q.type,
        options: q.options ?? [],
        correctAnswer: q.correctAnswer,
        points: q.points,
      })),
    })),
    isPublished: lesson.isPublished,
    moduleId: lesson.module.toString(),
    courseId: lesson.course.toString(),
    test: test
      ? {
          id: test._id.toString(),
          title: test.title,
          passingScore: test.passingScore,
          maxAttempts: test.maxAttempts,
          isPublished: test.isPublished,
          questions: test.questions.map((q) => ({
            id: (q._id as Types.ObjectId).toString(),
            text: q.text,
            type: q.type,
            options: q.options ?? [],
            correctAnswer: q.correctAnswer,
            points: q.points,
          })),
        }
      : null,
  }
}

// ─── Exam Queries ─────────────────────────────────────────────────────────────

export async function getCourseExam(courseId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") return null

  await connectDB()
  const exam = await Assessment.findOne({ course: courseId, type: "exam" }).lean()
  if (!exam) return null

  return {
    _id: exam._id.toString(),
    title: exam.title,
    type: exam.type,
    passingMarks: exam.passingMarks,
    maxAttempts: exam.maxAttempts,
    durationMinutes: exam.durationMinutes ?? null,
    proctoringEnabled: exam.proctoringEnabled ?? false,
    isPublished: exam.isPublished,
    questions: exam.questions.map((q) => ({
      _id: (q._id as Types.ObjectId).toString(),
      text: q.text,
      type: q.type,
      options: q.options ?? [],
      correctAnswer: q.correctAnswer,
      points: q.points,
    })),
  }
}
