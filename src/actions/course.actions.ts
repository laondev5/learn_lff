"use server"

import { z } from "zod"
import { connectDB } from "@/lib/mongoose"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import Course from "@/models/Course.model"
import Module from "@/models/Module.model"
import Lesson from "@/models/Lesson.model"
import Test from "@/models/Test.model"
import Exam from "@/models/Exam.model"
import { Types } from "mongoose"

// ─── Courses ────────────────────────────────────────────────────────────────

const courseSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
})

export async function createCourse(formData: FormData) {
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") return { error: "Unauthorized" }

  const parsed = courseSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  await connectDB()
  const course = await Course.create({
    ...parsed.data,
    teacher: session.user.id,
  })

  revalidatePath("/teacher/courses")
  return { success: true, courseId: course._id.toString() }
}

export async function updateCourse(courseId: string, formData: FormData) {
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") return { error: "Unauthorized" }

  const parsed = courseSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const coverImageUrl = formData.get("coverImageUrl")?.toString().trim()

  await connectDB()
  await Course.findOneAndUpdate(
    { _id: courseId, teacher: session.user.id },
    {
      ...parsed.data,
      ...(coverImageUrl ? { coverImageUrl } : {}),
    }
  )

  revalidatePath(`/teacher/courses/${courseId}`)
  return { success: true }
}

export async function toggleCoursePublished(courseId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") return { error: "Unauthorized" }

  await connectDB()
  const course = await Course.findOne({ _id: courseId, teacher: session.user.id })
  if (!course) return { error: "Course not found" }

  course.isPublished = !course.isPublished
  await course.save()

  revalidatePath(`/teacher/courses/${courseId}`)
  revalidatePath("/teacher/courses")
  revalidatePath(`/student/courses/${courseId}`)
  revalidatePath("/student/dashboard")
  return { success: true, isPublished: course.isPublished }
}

export async function deleteCourse(courseId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") return { error: "Unauthorized" }

  await connectDB()
  await Course.findOneAndDelete({ _id: courseId, teacher: session.user.id })
  await Module.deleteMany({ course: courseId })
  await Lesson.deleteMany({ course: courseId })
  await Test.deleteMany({ course: courseId })
  await Exam.deleteMany({ course: courseId })

  revalidatePath("/teacher/courses")
  return { success: true }
}

export async function getTeacherCourses() {
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") return []

  await connectDB()
  const courses = await Course.find({ teacher: session.user.id }).select("title _id").lean()
  return JSON.parse(JSON.stringify(courses))
}





// ─── Modules ─────────────────────────────────────────────────────────────────

const moduleSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().optional(),
})

export async function createModule(courseId: string, formData: FormData) {
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") return { error: "Unauthorized" }

  const parsed = moduleSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  await connectDB()
  const count = await Module.countDocuments({ course: courseId })
  const mod = await Module.create({
    ...parsed.data,
    course: courseId,
    order: count + 1,
  })

  revalidatePath(`/teacher/courses/${courseId}`)
  return { success: true, moduleId: mod._id.toString() }
}

export async function updateModule(moduleId: string, formData: FormData) {
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") return { error: "Unauthorized" }

  const parsed = moduleSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  await connectDB()
  const mod = await Module.findById(moduleId).lean()
  if (!mod) return { error: "Module not found" }

  await Module.findByIdAndUpdate(moduleId, parsed.data)
  revalidatePath(`/teacher/courses/${mod.course.toString()}`)
  return { success: true }
}

export async function toggleModulePublished(moduleId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") return { error: "Unauthorized" }

  await connectDB()
  const mod = await Module.findById(moduleId)
  if (!mod) return { error: "Module not found" }

  mod.isPublished = !mod.isPublished
  await mod.save()

  revalidatePath(`/teacher/courses/${mod.course.toString()}`)
  revalidatePath(`/student/courses/${mod.course.toString()}`)
  return { success: true }
}

export async function deleteModule(moduleId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") return { error: "Unauthorized" }

  await connectDB()
  const mod = await Module.findById(moduleId).lean()
  if (!mod) return { error: "Module not found" }

  await Module.findByIdAndDelete(moduleId)
  await Lesson.deleteMany({ module: moduleId })
  await Test.deleteMany({ course: mod.course })

  revalidatePath(`/teacher/courses/${mod.course.toString()}`)
  return { success: true }
}



// ─── Lessons ─────────────────────────────────────────────────────────────────

const lessonSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  lessonType: z.enum(["video", "text"]).default("text"),
  content: z.string().default(""),
  videoUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  youtubeVideoId: z.string().optional().or(z.literal("")),
})

const videoCueQuestionSchema = z.object({
  text: z.string().min(1),
  type: z.enum(["mcq", "true_false", "short_answer"]),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().min(1),
  points: z.coerce.number().min(1).default(1),
})

const videoCueSchema = z.object({
  timestamp: z.coerce.number().min(0),
  title: z.string().min(1),
  questions: z.array(videoCueQuestionSchema).min(1),
})

export async function createLesson(moduleId: string, formData: FormData) {
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") return { error: "Unauthorized" }

  const lessonType = (formData.get("lessonType")?.toString() ?? "text") as "video" | "text"
  const rawContent = formData.get("content")?.toString() ?? ""
  const rawVideo = formData.get("videoUrl")?.toString().trim()
  const rawYtId = formData.get("youtubeVideoId")?.toString().trim()

  const parsed = lessonSchema.safeParse({
    title: formData.get("title"),
    lessonType,
    content: rawContent,
    videoUrl: rawVideo || undefined,
    youtubeVideoId: rawYtId || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  await connectDB()
  const mod = await Module.findById(moduleId).lean()
  if (!mod) return { error: "Module not found" }

  const count = await Lesson.countDocuments({ module: moduleId })
  const lesson = await Lesson.create({
    title: parsed.data.title,
    lessonType: parsed.data.lessonType,
    content: parsed.data.content,
    videoUrl: parsed.data.videoUrl || undefined,
    youtubeVideoId: parsed.data.youtubeVideoId || undefined,
    videoCues: [],
    module: moduleId,
    course: mod.course,
    order: count + 1,
  })

  revalidatePath(`/teacher/courses/${mod.course.toString()}/modules/${moduleId}`)
  return { success: true, lessonId: lesson._id.toString() }
}

export async function updateLesson(lessonId: string, formData: FormData) {
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") return { error: "Unauthorized" }

  const lessonType = (formData.get("lessonType")?.toString() ?? "text") as "video" | "text"
  const rawContent = formData.get("content")?.toString() ?? ""
  const rawVideo = formData.get("videoUrl")?.toString().trim()
  const rawYtId = formData.get("youtubeVideoId")?.toString().trim()

  const parsed = lessonSchema.safeParse({
    title: formData.get("title"),
    lessonType,
    content: rawContent,
    videoUrl: rawVideo || undefined,
    youtubeVideoId: rawYtId || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  await connectDB()
  const lesson = await Lesson.findById(lessonId).lean()
  if (!lesson) return { error: "Lesson not found" }

  await Lesson.findByIdAndUpdate(lessonId, {
    title: parsed.data.title,
    lessonType: parsed.data.lessonType,
    content: parsed.data.content,
    videoUrl: parsed.data.videoUrl || undefined,
    youtubeVideoId: parsed.data.youtubeVideoId || undefined,
  })

  revalidatePath(`/teacher/courses/${lesson.course.toString()}/modules/${lesson.module.toString()}`)
  return { success: true }
}

export async function saveVideoCues(
  lessonId: string,
  cues: z.infer<typeof videoCueSchema>[]
) {
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") return { error: "Unauthorized" }

  const parsed = z.array(videoCueSchema).safeParse(cues)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  await connectDB()
  const lesson = await Lesson.findById(lessonId).lean()
  if (!lesson) return { error: "Lesson not found" }

  await Lesson.findByIdAndUpdate(lessonId, { videoCues: parsed.data })

  revalidatePath(`/teacher/courses/${lesson.course.toString()}/modules/${lesson.module.toString()}/lessons/${lessonId}`)
  return { success: true }
}

export async function saveLessonVideoUrl(lessonId: string, videoUrl: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") return { error: "Unauthorized" }

  if (!videoUrl.startsWith("http")) return { error: "Invalid URL" }

  await connectDB()
  const lesson = await Lesson.findById(lessonId)
  if (!lesson) return { error: "Lesson not found" }

  await Lesson.findByIdAndUpdate(lessonId, {
    $set: { videoUrl },
    $unset: { youtubeVideoId: 1 },
  })

  revalidatePath(
    `/teacher/courses/${lesson.course.toString()}/modules/${lesson.module.toString()}/lessons/${lessonId}`
  )
  return { success: true }
}

export async function toggleLessonPublished(lessonId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") return { error: "Unauthorized" }

  await connectDB()
  const lesson = await Lesson.findById(lessonId)
  if (!lesson) return { error: "Lesson not found" }

  lesson.isPublished = !lesson.isPublished
  await lesson.save()

  revalidatePath(`/teacher/courses/${lesson.course.toString()}/modules/${lesson.module.toString()}`)
  revalidatePath(`/student/courses/${lesson.course.toString()}`)
  return { success: true }
}

export async function deleteLesson(lessonId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") return { error: "Unauthorized" }

  await connectDB()
  const lesson = await Lesson.findById(lessonId).lean()
  if (!lesson) return { error: "Lesson not found" }

  await Lesson.findByIdAndDelete(lessonId)
  await Test.deleteOne({ lesson: lessonId })

  revalidatePath(`/teacher/courses/${lesson.course.toString()}/modules/${lesson.module.toString()}`)
  return { success: true }
}



// ─── Tests ────────────────────────────────────────────────────────────────────

const questionSchema = z.object({
  text: z.string().min(3),
  type: z.enum(["mcq", "true_false", "short_answer"]),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().min(1),
  points: z.coerce.number().min(1).default(1),
})

const testSchema = z.object({
  title: z.string().min(2),
  passingScore: z.coerce.number().min(1).max(100).default(70),
  maxAttempts: z.coerce.number().min(1).default(3),
  questions: z.array(questionSchema).min(1, "At least one question required"),
})

export async function saveTest(lessonId: string, data: z.infer<typeof testSchema>) {
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") return { error: "Unauthorized" }

  const parsed = testSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  await connectDB()
  const lesson = await Lesson.findById(lessonId).lean()
  if (!lesson) return { error: "Lesson not found" }

  await Test.findOneAndUpdate(
    { lesson: lessonId },
    {
      title: parsed.data.title,
      lesson: lessonId,
      course: lesson.course,
      questions: parsed.data.questions,
      passingScore: parsed.data.passingScore,
      maxAttempts: parsed.data.maxAttempts,
      isPublished: true,
    },
    { upsert: true, new: true }
  )

  revalidatePath(`/teacher/courses/${lesson.course.toString()}/modules/${lesson.module.toString()}/lessons/${lessonId}`)
  return { success: true }
}

export async function deleteTest(lessonId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") return { error: "Unauthorized" }

  await connectDB()
  const lesson = await Lesson.findById(lessonId).lean()
  if (!lesson) return { error: "Lesson not found" }

  await Test.deleteOne({ lesson: lessonId })

  revalidatePath(`/teacher/courses/${lesson.course.toString()}/modules/${lesson.module.toString()}/lessons/${lessonId}`)
  return { success: true }
}

// ─── Exams ────────────────────────────────────────────────────────────────────

const examSchema = z.object({
  title: z.string().min(2),
  passingScore: z.coerce.number().min(1).max(100).default(70),
  maxAttempts: z.coerce.number().min(1).default(2),
  durationMinutes: z.coerce.number().min(5).optional(),
  questions: z.array(questionSchema).min(1, "At least one question required"),
})

export async function saveExam(courseId: string, data: z.infer<typeof examSchema>) {
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") return { error: "Unauthorized" }

  const parsed = examSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  await connectDB()
  await Exam.findOneAndUpdate(
    { course: courseId },
    {
      title: parsed.data.title,
      course: courseId,
      questions: parsed.data.questions,
      passingScore: parsed.data.passingScore,
      maxAttempts: parsed.data.maxAttempts,
      durationMinutes: parsed.data.durationMinutes,
      isPublished: true,
    },
    { upsert: true, new: true }
  )

  revalidatePath(`/teacher/courses/${courseId}/exam`)
  return { success: true }
}


