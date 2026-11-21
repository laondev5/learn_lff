"use server"

import { connectDB } from "@/lib/mongoose"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import Course from "@/models/Course.model"
import Module from "@/models/Module.model"
import Lesson from "@/models/Lesson.model"
import Test from "@/models/Test.model"
import Assessment from "@/models/Assessment.model"
import StudentProgress, { type IStudentProgress } from "@/models/StudentProgress.model"
import type { HydratedDocument } from "mongoose"
import TestSubmission from "@/models/TestSubmission.model"
import Submission from "@/models/Submission.model"
import ExamSubmission from "@/models/ExamSubmission.model"
import Certificate from "@/models/Certificate.model"
import PaymentTransaction from "@/models/PaymentTransaction.model"
import { Types } from "mongoose"

import { getStudentCourseAccess, getStudentModuleAccess, recordStudentModuleActivity, recordStudentLessonView, getModuleCompletionAtDeadline } from "@/lib/cohort-access"
import { getAssessmentAccess } from "@/lib/assessment-access"
import { issueCertificate } from "@/lib/certificate"

import { initializePaystackPayment } from "@/lib/paystack"

// ─── Shared helpers ──────────────────────────────────────────────────────────

function accessMessage(access: { reason: string; startsAt?: Date | string | null; endsAt?: Date | string | null; opensAt?: Date | string | null; closesAt?: Date | string | null }) {
  if (access.reason === "module_ended") {
    return "This module's 24-hour window has closed. Your accountability partner and an administrator have been notified. Submit an appeal in Student appeals to reopen it for another 24 hours."
  }
  const format = (value: Date | string) => new Date(value).toLocaleString("en-GB", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" }) + " (Lagos)"
  const start = access.opensAt ?? access.startsAt
  const end = access.closesAt ?? access.endsAt
  return `Access unavailable: ${access.reason.replaceAll("_", " ")}.${start ? ` Opens ${format(start)}.` : ""}${end ? ` Deadline: ${format(end)}.` : " No access schedule is available."} Request help at /student/appeals.`
}

/** Assessment access can fail with a schedule code or a plain sentence from getAssessmentAccess. */
function assessmentAccessMessage(access: { allowed: boolean; reason: string; startsAt?: Date | string | null; endsAt?: Date | string | null; opensAt?: Date | string | null; closesAt?: Date | string | null }) {
  return access.reason.includes(" ") ? access.reason : accessMessage(access)
}

async function courseGuard(studentId: string, courseId: string) {
  if (!Types.ObjectId.isValid(courseId)) return { error: "Course not found" }
  const access = await getStudentCourseAccess(studentId, courseId)
  return access.allowed ? null : { error: accessMessage(access) }
}

async function lessonGuard(studentId: string, lessonId: string) {
  if (!Types.ObjectId.isValid(lessonId)) return { error: "Lesson not found" }
  const lesson = await Lesson.findById(lessonId).lean()
  if (!lesson?.isPublished) return { error: "Lesson not found" }
  const courseError = await courseGuard(studentId, lesson.course.toString())
  if (courseError) return courseError
  const access = await getStudentModuleAccess(studentId, lesson.course.toString(), lesson.module.toString())
  if (!access.allowed) return { error: accessMessage(access) }
  const progress = await StudentProgress.findOne({ student: studentId, course: lesson.course }).lean()
  if (!progress) return { error: "Not enrolled" }
  const lessons = await Lesson.find({ module: lesson.module, isPublished: true }).sort({ order: 1, _id: 1 }).select("_id").lean()
  const index = lessons.findIndex(l => l._id.toString() === lessonId)
  if (index > 0 && !progress.completedLessons.some(id => id.equals(lessons[index - 1]._id))) {
    return { error: "Complete the previous lesson in this module first" }
  }
  return null
}

async function visibleCurriculum(studentId: string, courseId: string, curriculum: Awaited<ReturnType<typeof loadPublishedCurriculum>>) {
  const access = await Promise.all(curriculum.map(mod => getStudentModuleAccess(studentId, courseId, mod.id)))
  return curriculum.filter((_, index) => access[index].allowed)
}

/** Published modules + lessons of a course, with lesson type and whether each lesson has a test. */
async function loadPublishedCurriculum(courseId: string | Types.ObjectId) {
  const modules = await Module.find({ course: courseId, isPublished: true }).sort({ order: 1 }).lean()
  const moduleIds = modules.map((m) => m._id)
  const [lessons, tests, moduleAssessments] = await Promise.all([
    Lesson.find({ module: { $in: moduleIds }, isPublished: true })
      .sort({ order: 1 })
      .select("title order lessonType module")
      .lean(),
    Test.find({ course: courseId, isPublished: true }).select("lesson").lean(),
    Assessment.find({ course: courseId, module: { $in: moduleIds }, type: "test", isPublished: true })
      .select("module title questions durationMinutes passingMarks maxAttempts")
      .lean(),
  ])
  const lessonsWithTest = new Set(tests.map((t) => t.lesson.toString()))

  return modules.map((mod) => ({
    id: mod._id.toString(),
    title: mod.title,
    description: mod.description ?? "",
    order: mod.order,
    lessons: lessons
      .filter((l) => l.module.toString() === mod._id.toString())
      .map((l) => ({
        id: l._id.toString(),
        title: l.title,
        order: l.order,
        lessonType: (l.lessonType ?? "text") as "video" | "text",
        hasTest: lessonsWithTest.has(l._id.toString()),
      })),
    moduleTests: moduleAssessments
      .filter((a) => a.module?.toString() === mod._id.toString())
      .map((a) => ({
        id: a._id.toString(),
        title: a.title,
        questionCount: a.questions?.length ?? 0,
        durationMinutes: a.durationMinutes,
        passingMarks: a.passingMarks,
        maxAttempts: a.maxAttempts,
      })),
  }))
}

/** Number of lessons students can actually see (published lessons in published modules), per course. */
async function countVisibleLessons(courseIds: Types.ObjectId[]) {
  if (courseIds.length === 0) return new Map<string, number>()
  const modules = await Module.find({ course: { $in: courseIds }, isPublished: true }).select("_id").lean()
  const counts = await Lesson.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { module: { $in: modules.map((m) => m._id) }, isPublished: true } },
    { $group: { _id: "$course", count: { $sum: 1 } } },
  ])
  return new Map(counts.map((c) => [c._id.toString(), c.count]))
}

// ─── Enrollment & Course Listing ─────────────────────────────────────────────

export async function initializeCoursePayment(courseId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "student") return { error: "Unauthorized" }

  await connectDB()
  const accessError = await courseGuard(session.user.id, courseId)
  if (accessError) return accessError
  const course = await Course.findById(courseId).lean()
  if (!course || !course.isPublished) return { error: "Course not found" }
  if (!course.isPaid) return { error: "This course is free. Use direct enrollment." }
  if (await PaymentTransaction.exists({ student: session.user.id, course: courseId, status: "success", amount: { $gte: course.price ?? 0 } })) {
    return { error: "This course has already been paid for" }
  }
  const price = course.price ?? 0
  if (!(price > 0)) return { error: "This course is free. Use direct enrollment." }

  // Idempotent checkout: a double click or a retry reuses the open attempt instead of
  // creating a second charge. A different price always starts a new attempt.
  const openAttempt = await PaymentTransaction.findOne({
    student: session.user.id,
    course: courseId,
    amount: price,
    status: "pending",
    authorizationUrl: { $exists: true, $ne: null },
    createdAt: { $gt: new Date(Date.now() - 30 * 60 * 1000) },
  }).sort({ createdAt: -1 }).lean()
  if (openAttempt?.authorizationUrl) return { success: true, authorizationUrl: openAttempt.authorizationUrl }

  try {
    const paymentData = await initializePaystackPayment({
      email: session.user.email!,
      amount: price,
      courseId: course._id.toString(),
      studentId: session.user.id,
    })

    return { success: true, authorizationUrl: paymentData.authorization_url }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to initialize payment"
    return { error: message }
  }
}

export async function getEnrolledCourses() {
  const session = await auth()
  if (!session?.user || session.user.role !== "student") return []

  await connectDB()
  const progresses = await StudentProgress.find({ student: session.user.id })
    .populate({ path: "course", populate: { path: "teacher", select: "name" } })
    .sort({ updatedAt: -1 })
    .lean()

  type PopulatedCourse = {
    _id: Types.ObjectId
    title: string
    description: string
    coverImageUrl?: string
    isPublished: boolean
    teacher?: { name?: string } | null
  }

  const courseIds = progresses
    .map((p) => (p.course as unknown as PopulatedCourse | null)?._id)
    .filter((id): id is Types.ObjectId => !!id)
  const lessonCounts = await countVisibleLessons(courseIds)

  const access = await Promise.all(courseIds.map(id => getStudentCourseAccess(session.user.id, id.toString())))
  const allowedIds = new Set(courseIds.filter((_, i) => access[i].allowed).map(String))
  return progresses.flatMap((p) => {
    const course = p.course as unknown as PopulatedCourse | null

    if (!course?._id || !allowedIds.has(course._id.toString())) {
      return []
    }

    const totalLessons = lessonCounts.get(course._id.toString()) ?? 0
    const completedLessons = p.completedLessons.length
    const progressPercent = p.examPassed
      ? 100
      : totalLessons > 0
        ? Math.min(100, Math.round((completedLessons / totalLessons) * 100))
        : 0

    return [
      {
        courseId: course._id.toString(),
        title: course.title,
        description: course.description,
        coverImageUrl: course.coverImageUrl ?? null,
        teacherName: course.teacher?.name ?? "Instructor",
        isPublished: course.isPublished,
        completedLessons,
        totalLessons,
        progressPercent,
        examPassed: p.examPassed,
        certificateIssued: p.certificateIssued,
        enrolledAt: p.enrolledAt.toISOString(),
      },
    ]
  })
}

export async function getAvailableCourses() {
  const session = await auth()
  if (!session?.user || session.user.role !== "student") return []

  await connectDB()
  const enrolled = await StudentProgress.find({ student: session.user.id }).lean()
  const enrolledIds = enrolled.map((p) => p.course.toString())

  const courses = await Course.find({
    isPublished: true,
    _id: { $nin: enrolledIds.map((id) => new Types.ObjectId(id)) },
  })
    .populate("teacher", "name")
    .sort({ createdAt: -1 })
    .lean()

  const lessonCounts = await countVisibleLessons(courses.map((c) => c._id))

  const access = await Promise.all(courses.map(c => getStudentCourseAccess(session.user.id, c._id.toString())))
  return courses.filter((_, i) => access[i].allowed).map((c) => ({
    id: c._id.toString(),
    title: c.title,
    description: c.description,
    isPaid: c.isPaid,
    price: c.price,
    coverImageUrl: c.coverImageUrl ?? null,
    teacherName: (c.teacher as unknown as { name?: string } | null)?.name ?? "Instructor",
    lessonCount: lessonCounts.get(c._id.toString()) ?? 0,
  }))
}

/** Public, Udemy-style landing data for a course the student is browsing (enrolled or not). */
export async function getCoursePreview(courseId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "student") return null
  if (!Types.ObjectId.isValid(courseId)) return null

  await connectDB()
  const accessError = await courseGuard(session.user.id, courseId)
  if (accessError) return accessError
  const [course, progress] = await Promise.all([
    Course.findById(courseId).populate("teacher", "name avatarUrl").lean(),
    StudentProgress.exists({ student: session.user.id, course: courseId }),
  ])
  if (!course) return null
  const isEnrolled = !!progress
  if (!course.isPublished && !isEnrolled) return null

  const [curriculum, exam, studentCount] = await Promise.all([
    loadPublishedCurriculum(courseId),
    Assessment.exists({ course: courseId, type: "exam", isPublished: true }),
    StudentProgress.countDocuments({ course: courseId }),
  ])

  const allLessons = curriculum.flatMap((m) => m.lessons)
  const teacher = course.teacher as unknown as { name?: string; avatarUrl?: string } | null

  return {
    id: course._id.toString(),
    title: course.title,
    description: course.description,
    coverImageUrl: course.coverImageUrl ?? null,
    isPaid: course.isPaid ?? false,
    price: course.price ?? 0,
    updatedAt: course.updatedAt.toISOString(),
    instructor: { name: teacher?.name ?? "Instructor", avatarUrl: teacher?.avatarUrl ?? null },
    studentCount,
    isEnrolled,
    hasExam: !!exam,
    stats: {
      modules: curriculum.length,
      lessons: allLessons.length,
      videoLessons: allLessons.filter((l) => l.lessonType === "video").length,
      textLessons: allLessons.filter((l) => l.lessonType === "text").length,
      tests: allLessons.filter((l) => l.hasTest).length,
      moduleTests: curriculum.reduce((n, m) => n + m.moduleTests.length, 0),
    },
    modules: await visibleCurriculum(session.user.id, courseId, curriculum),
  }
}

export async function enrollInCourse(courseId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "student") return { error: "Unauthorized" }

  await connectDB()
  const accessError = await courseGuard(session.user.id, courseId)
  if (accessError) return accessError
  const course = await Course.findById(courseId).lean()
  if (!course || !course.isPublished) return { error: "Course not found" }

  const existing = await StudentProgress.findOne({
    student: session.user.id,
    course: courseId,
  })
  if (existing) return { error: "Already enrolled" }

  // A paid course only opens once a payment for it has succeeded for this student.
  if (course.isPaid) {
    const paid = await PaymentTransaction.exists({
      student: session.user.id,
      course: courseId,
      status: "success",
      amount: { $gte: course.price ?? 0 },
    })
    if (!paid) return { error: "Payment required to enroll in this course" }
  }

  await StudentProgress.create({
    student: session.user.id,
    course: courseId,
  })

  revalidatePath("/student/dashboard")
  return { success: true }
}

// ─── Course Viewer ────────────────────────────────────────────────────────────

export async function getCourseForStudent(courseId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "student") return null

  await connectDB()
  const accessError = await courseGuard(session.user.id, courseId)
  if (accessError) return accessError
  const progress = await StudentProgress.findOne({
    student: session.user.id,
    course: courseId,
  }).lean()
  if (!progress) return null

  const course = await Course.findById(courseId).populate("teacher", "name avatarUrl").lean()
  if (!course) return null

  const curriculum = await loadPublishedCurriculum(courseId)

  const completedLessonIds = new Set(progress.completedLessons.map((id) => id.toString()))
  const completedModuleIds = new Set(progress.completedModules.map((id) => id.toString()))

  // Same sequential rule as the lesson viewer: a lesson unlocks once the one before it
  // is complete; the first lesson of a module unlocks once the previous module is complete.
  let nextLesson: { id: string; title: string; moduleTitle: string } | null = null
  const visible = await visibleCurriculum(session.user.id, courseId, curriculum)

  // Module tests are published assessments of type "test" attached to a module.
  // Work out each one's status so the course page can link directly to it.
  const testIds = visible.flatMap((m) => m.moduleTests.map((t) => t.id))
  const testObjectIds = testIds.map((id) => new Types.ObjectId(id))
  const [passedDocs, attemptDocs] = await Promise.all([
    testObjectIds.length
      ? Submission.find({ student: session.user.id, assessment: { $in: testObjectIds }, passed: true }).select("assessment").lean()
      : Promise.resolve([]),
    testObjectIds.length
      ? Submission.aggregate<{ _id: Types.ObjectId; count: number }>([
          { $match: { student: new Types.ObjectId(session.user.id), assessment: { $in: testObjectIds } } },
          { $group: { _id: "$assessment", count: { $sum: 1 } } },
        ])
      : Promise.resolve([]),
  ])
  const passedTestIds = new Set(passedDocs.map((d) => d.assessment.toString()))
  const attemptCounts = new Map(attemptDocs.map((d) => [d._id.toString(), d.count]))

  type ModuleTestStatus = {
    id: string
    title: string
    moduleId: string
    moduleTitle: string
    questionCount: number
    durationMinutes: number
    passingMarks: number
    maxAttempts: number
    status: "passed" | "available" | "locked"
    reason?: string
    attemptsLeft: number
  }
  const moduleTestStatuses = new Map<string, ModuleTestStatus>()
  for (const mod of visible) {
    if (mod.moduleTests.length === 0) continue
    const access = await getAssessmentAccess(session.user.id, {
      course: new Types.ObjectId(courseId),
      module: new Types.ObjectId(mod.id),
      type: "test",
    })
    for (const test of mod.moduleTests) {
      const attemptsLeft = Math.max(0, test.maxAttempts - (attemptCounts.get(test.id) ?? 0))
      const passed = passedTestIds.has(test.id)
      const canTake = passed || access.allowed && attemptsLeft > 0
      moduleTestStatuses.set(test.id, {
        ...test,
        moduleId: mod.id,
        moduleTitle: mod.title,
        status: canTake ? (passed ? "passed" : "available") : "locked",
        reason: canTake ? undefined : !access.allowed ? assessmentAccessMessage(access) : `Maximum attempts (${test.maxAttempts}) reached`,
        attemptsLeft,
      })
    }
  }

  const modulesData = visible.map((mod) => {
    const isCompleted = completedModuleIds.has(mod.id)
    let prevLessonComplete = true
    const lessons = mod.lessons.map((l) => {
      const done = completedLessonIds.has(l.id)
      const locked = !done && !prevLessonComplete
      if (!done && !locked && !nextLesson) nextLesson = { id: l.id, title: l.title, moduleTitle: mod.title }
      prevLessonComplete = done
      return { ...l, isCompleted: done, locked }
    })
    return {
      ...mod,
      isCompleted,
      lessons,
      moduleTests: mod.moduleTests.map((t) => moduleTestStatuses.get(t.id)).filter((t): t is ModuleTestStatus => !!t),
    }
  })

  const exam = await Assessment.findOne({ course: courseId, type: "exam", isPublished: true }).lean()

  const totalLessons = curriculum.reduce((acc, mod) => acc + mod.lessons.length, 0)
  const completedLessonsCount = curriculum.reduce(
    (acc, mod) => acc + mod.lessons.filter((l) => completedLessonIds.has(l.id)).length,
    0
  )

  const teacher = course.teacher as unknown as { name?: string; avatarUrl?: string } | null

  return {
    id: course._id.toString(),
    title: course.title,
    description: course.description,
    coverImageUrl: course.coverImageUrl ?? null,
    instructor: { name: teacher?.name ?? "Instructor", avatarUrl: teacher?.avatarUrl ?? null },
    enrolledAt: progress.enrolledAt.toISOString(),
    nextLesson: nextLesson as { id: string; title: string; moduleTitle: string } | null,
    modules: modulesData,
    moduleTests: [...moduleTestStatuses.values()],
    passedModuleTestsCount: [...moduleTestStatuses.values()].filter((t) => t.status === "passed").length,
    hasExam: !!exam,
    examPassed: progress.examPassed,
    certificateIssued: progress.certificateIssued,
    allModulesComplete: curriculum.length > 0 && curriculum.every((m) => completedModuleIds.has(m.id)),
    totalModules: curriculum.length,
    completedModulesCount: curriculum.filter(m => completedModuleIds.has(m.id)).length,
    totalLessons,
    completedLessonsCount,
  }
}

// ─── Lesson Viewer ────────────────────────────────────────────────────────────

export async function getLessonForStudent(lessonId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "student") return null

  await connectDB()
  const accessError = await lessonGuard(session.user.id, lessonId)
  if (accessError) return accessError
  const lesson = await Lesson.findById(lessonId).lean()
  if (!lesson || !lesson.isPublished) return null

  const progress = await StudentProgress.findOne({
    student: session.user.id,
    course: lesson.course,
  }).lean()
  if (!progress) return null

  // Enforce sequential: check if previous lesson is complete
  const allLessons = await Lesson.find({ module: lesson.module, isPublished: true })
    .sort({ order: 1 })
    .lean()
  const lessonIndex = allLessons.findIndex((l) => l._id.toString() === lessonId)

  if (lessonIndex > 0) {
    const prevLesson = allLessons[lessonIndex - 1]
    const prevCompleted = progress.completedLessons
      .map((id) => id.toString())
      .includes(prevLesson._id.toString())
    if (!prevCompleted) return { error: "Complete the previous lesson first" }
  }

  const test = await Test.findOne({ lesson: lessonId, isPublished: true }).lean()
  const completedLessonIds = progress.completedLessons.map((id) => id.toString())
  const isCompleted = completedLessonIds.includes(lessonId)

  // Next lesson navigation
  let nextLessonId: string | null = null
  if (lessonIndex < allLessons.length - 1) {
    nextLessonId = allLessons[lessonIndex + 1]._id.toString()
  }

  // The media URL is never shipped to the browser: the player points at an
  // endpoint that re-checks enrollment and payment on every playback request.
  const storedVideoUrl = lesson.videoUrl ?? ""
  const youtubeMatch = storedVideoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?]+)/)
  const videoKind: "cloudinary" | "youtube" | "direct" | null = lesson.youtubeVideoId
    ? "youtube"
    : storedVideoUrl
      ? youtubeMatch
        ? "youtube"
        : storedVideoUrl.includes("cloudinary.com")
          ? "cloudinary"
          : "direct"
      : null

  return {
    id: lesson._id.toString(),
    title: lesson.title,
    lessonType: lesson.lessonType ?? "text",
    content: lesson.content,
    studentNotes: lesson.studentNotes ?? "",
    videoKind,
    videoUrl: videoKind && videoKind !== "youtube" ? `/api/lessons/${lessonId}/video` : null,
    youtubeVideoId: lesson.youtubeVideoId ?? youtubeMatch?.[1] ?? null,
    videoCues: (lesson.videoCues ?? []).map((cue) => ({
      id: cue._id?.toString() ?? "",
      timestamp: cue.timestamp,
      title: cue.title,
      questions: cue.questions.map((q) => ({
        text: q.text,
        type: q.type,
        options: q.options ?? [],
        points: q.points,
      })),
    })),
    courseId: lesson.course.toString(),
    moduleId: lesson.module.toString(),
    isCompleted,
    isViewed: (progress.viewedLessons ?? []).some(id => id.toString() === lessonId) || isCompleted,
    nextLessonId,
    test: test
      ? {
          id: test._id.toString(),
          title: test.title,
          passingScore: test.passingScore,
          maxAttempts: test.maxAttempts,
          questions: test.questions.map((q) => ({
            id: (q._id as Types.ObjectId).toString(),
            text: q.text,
            type: q.type,
            options: q.options ?? [],
            points: q.points,
          })),
        }
      : null,
  }
}

/**
 * Grades one in-video pop-up. The correct answers stay on the server so they are
 * never shipped to the browser before the student has answered.
 */
export async function gradeVideoCueAnswers(
  lessonId: string,
  cueTimestamp: number,
  answers: Record<string, string>
) {
  const session = await auth()
  if (!session?.user || session.user.role !== "student") return { error: "Unauthorized" }
  if (!Types.ObjectId.isValid(lessonId)) return { error: "Lesson not found" }

  await connectDB()
  const accessError = await lessonGuard(session.user.id, lessonId)
  if (accessError) return accessError
  const lesson = await Lesson.findById(lessonId)
    .select("isPublished course videoCues")
    .lean()
  if (!lesson || !lesson.isPublished) return { error: "Lesson not found" }

  const enrolled = await StudentProgress.exists({
    student: session.user.id,
    course: lesson.course,
  })
  if (!enrolled) return { error: "Not enrolled" }

  const cue = (lesson.videoCues ?? []).find((c) => c.timestamp === cueTimestamp)
  if (!cue) return { error: "Question not found" }

  const results = cue.questions.map((q, index) => {
    const given = (answers[String(index)] ?? "").trim().toLowerCase()
    return {
      correct: given === q.correctAnswer.trim().toLowerCase(),
      correctAnswer: q.correctAnswer,
    }
  })

  return { success: true, results, allCorrect: results.every((r) => r.correct) }
}

export async function markLessonViewed(lessonId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "student") return { error: "Unauthorized" }

  await connectDB()
  const accessError = await lessonGuard(session.user.id, lessonId)
  if (accessError) return accessError
  const lesson = await Lesson.findById(lessonId).lean()
  if (!lesson) return { error: "Lesson not found" }

  const progress = await StudentProgress.findOne({
    student: session.user.id,
    course: lesson.course,
  })
  if (!progress) return { error: "Not enrolled" }

  const alreadyDone = progress.completedLessons.map((id) => id.toString()).includes(lessonId)

  // Historical lesson completion is accepted; module completion alone is not proof of viewing.
  await recordStudentLessonView(session.user.id, lesson.course.toString(), lesson.module.toString(), lessonId)
  await StudentProgress.updateOne({ _id: progress._id }, { $addToSet: { viewedLessons: lesson._id } })
  // Only mark complete if no test (if there's a test, completion happens on test pass)
  const hasTest = await Test.exists({ lesson: lessonId, isPublished: true })
  if (!hasTest && !alreadyDone) {
    progress.completedLessons.push(new Types.ObjectId(lessonId))
    progress.updatedAt = new Date() // Force updatedAt change
    await progress.save()
    await checkModuleCompletion(progress._id.toString(), lesson.module.toString(), lesson.course.toString())
  }

  await recordStudentModuleActivity(session.user.id, lesson.course.toString(), lesson.module.toString())
  revalidatePath(`/student/courses/${lesson.course.toString()}`)
  return { success: true }
}

// ─── Test Submission ──────────────────────────────────────────────────────────

export async function submitTest(testId: string, answers: Record<string, string>) {
  const session = await auth()
  if (!session?.user || session.user.role !== "student") return { error: "Unauthorized" }

  await connectDB()
  const test = await Test.findById(testId).lean()
  if (!test?.isPublished) return { error: "Test not found" }
  const accessError = await lessonGuard(session.user.id, test.lesson.toString())
  if (accessError) return accessError

  const progress = await StudentProgress.findOne({
    student: session.user.id,
    course: test.course,
  })
  if (!progress) return { error: "Not enrolled" }

  const lesson = await Lesson.findById(test.lesson).lean()
  if (!lesson || !lesson.course.equals(test.course)) return { error: "Lesson not found" }
  if (lesson.lessonType === "video" && !(progress.viewedLessons ?? []).some(id => id.equals(test.lesson)) && !progress.completedLessons.some(id => id.equals(test.lesson))) {
    return { error: "Watch the video to the end before submitting the test" }
  }

  // Check attempt count
  const attemptCount = await TestSubmission.countDocuments({
    student: session.user.id,
    test: testId,
  })
  if (attemptCount >= test.maxAttempts) {
    return { error: `Maximum attempts (${test.maxAttempts}) reached` }
  }

  // Grade
  let totalPoints = 0
  let earnedPoints = 0
  const gradedAnswers = test.questions.map((q) => {
    const qId = (q._id as Types.ObjectId)
    const studentAnswer = answers[qId.toString()] ?? ""
    const normalise = (v: string) => v.trim().toLowerCase().replace(/[.,;:'"’“”]/g, "").replace(/\s+/g, " ").trim()
    const correct = (q.type as string) === "fill_blank"
      ? normalise(q.correctAnswer) === normalise(studentAnswer)
      : q.correctAnswer.trim().toLowerCase() === studentAnswer.trim().toLowerCase()
    totalPoints += q.points
    if (correct) earnedPoints += q.points
    return { questionId: qId, answer: studentAnswer }
  })

  const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0
  const passed = score >= test.passingScore

  const deadlineError = await lessonGuard(session.user.id, test.lesson.toString())
  if (deadlineError) return deadlineError

  await TestSubmission.create({
    student: session.user.id,
    test: testId,
    lesson: test.lesson,
    course: test.course,
    answers: gradedAnswers,
    score,
    passed,
    attemptNumber: attemptCount + 1,
  })

  if (passed) {
    const lessonId = test.lesson.toString()
    const alreadyComplete = progress.completedTests.map((id) => id.toString()).includes(testId)
    if (!alreadyComplete) {
      progress.completedTests.push(new Types.ObjectId(testId))
    }
    const lessonAlreadyComplete = progress.completedLessons.map((id) => id.toString()).includes(lessonId)
    if (!lessonAlreadyComplete) {
      progress.completedLessons.push(new Types.ObjectId(lessonId))
    }
    progress.updatedAt = new Date() // Force updatedAt change
    await progress.save()
    await checkModuleCompletion(
      progress._id.toString(),
      test.lesson.toString(),
      test.course.toString(),
      true
    )
  }

  await recordStudentModuleActivity(session.user.id, test.course.toString(), lesson.module.toString())
  revalidatePath(`/student/courses/${test.course.toString()}`)
  return { success: true, score, passed, passingScore: test.passingScore }
}

async function checkModuleCompletion(
  progressId: string,
  lessonOrModuleId: string,
  courseId: string,
  isLesson = false
) {
  const progress = await StudentProgress.findById(progressId)
  if (!progress) return

  let moduleId = lessonOrModuleId
  if (isLesson) {
    const lesson = await Lesson.findById(lessonOrModuleId).lean()
    if (!lesson) return
    moduleId = lesson.module.toString()
  }

  const completion = await getModuleCompletionAtDeadline(String(progress.student), courseId, moduleId, new Date(Date.now() + 1))
  const allLessonsDone = completion.complete

  if (allLessonsDone) {
    const alreadyDone = progress.completedModules.map((id) => id.toString()).includes(moduleId)
    if (!alreadyDone) {
      progress.completedModules.push(new Types.ObjectId(moduleId))
      await progress.save()
    }
    await issueCertificateIfCourseComplete(progress, courseId)
  }
}

/** Completing every published module earns the certificate of completion (idempotent). */
async function issueCertificateIfCourseComplete(progress: HydratedDocument<IStudentProgress> | null, courseId: string) {
  if (!progress) return
  const total = await Module.countDocuments({ course: courseId, isPublished: true })
  if (total === 0 || progress.completedModules.length < total) return
  if (!progress.certificateIssued) {
    progress.certificateIssued = true
    await progress.save()
  }
  await issueCertificate(String(progress.student), courseId)
}

// ─── Module Tests ─────────────────────────────────────────────────────────────

/** Validate access before mounting the generic assessment taker for a module test. */
export async function getModuleTestForStudent(courseId: string, testId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "student") return null
  if (!Types.ObjectId.isValid(courseId) || !Types.ObjectId.isValid(testId)) return { error: "Module test not found" }

  await connectDB()
  const accessError = await courseGuard(session.user.id, courseId)
  if (accessError) return accessError

  const test = await Assessment.findOne({
    _id: testId,
    course: courseId,
    type: "test",
    isPublished: true,
  }).lean()
  if (!test?.module) return { error: "Module test not found" }

  const access = await getAssessmentAccess(session.user.id, test)
  if (!access.allowed) return { error: assessmentAccessMessage(access) }

  const attempts = await Submission.countDocuments({ student: session.user.id, assessment: test._id })
  if (attempts >= test.maxAttempts) return { error: `Maximum attempts (${test.maxAttempts}) reached` }

  return {
    id: test._id.toString(),
    title: test.title,
    courseId,
    moduleId: test.module.toString(),
  }
}

// ─── Exam ─────────────────────────────────────────────────────────────────────

export async function getExamForStudent(courseId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "student") return null

  await connectDB()
  const accessError = await courseGuard(session.user.id, courseId)
  if (accessError) return accessError
  const progress = await StudentProgress.findOne({
    student: session.user.id,
    course: courseId,
  }).lean()
  if (!progress) return null

  // Check all modules complete
  const modules = await Module.find({ course: courseId, isPublished: true }).lean()
  const completedModuleIds = progress.completedModules.map((id) => id.toString())
  const allDone = modules.length > 0 && modules.every((m) => completedModuleIds.includes(m._id.toString()))
  if (!allDone) return { error: "Complete all modules before taking the exam" }

  if (progress.examPassed) return { error: "You have already passed this exam" }

  const exam = await Assessment.findOne({ course: courseId, type: "exam", isPublished: true }).lean()
  if (!exam) return { error: "No exam available for this course" }

  const attemptCount = await ExamSubmission.countDocuments({
    student: session.user.id,
    exam: exam._id,
  })
  if (attemptCount >= exam.maxAttempts) {
    return { error: `Maximum attempts (${exam.maxAttempts}) reached` }
  }

  return {
    id: exam._id.toString(),
    title: exam.title,
    passingScore: exam.passingMarks,
    maxAttempts: exam.maxAttempts,
    durationMinutes: exam.durationMinutes ?? null,
    attemptsUsed: attemptCount,
    questions: exam.questions.map((q) => ({
      id: (q._id as Types.ObjectId).toString(),
      text: q.text,
      type: q.type,
      options: q.options ?? [],
      points: q.points,
    })),
  }
}

export async function submitExam(examId: string, answers: Record<string, string>) {
  const session = await auth()
  if (!session?.user || session.user.role !== "student") return { error: "Unauthorized" }

  await connectDB()
  const exam = await Assessment.findById(examId).lean()
  if (!exam?.isPublished || exam.type !== "exam") return { error: "Exam not found" }
  const accessError = await getExamForStudent(exam.course.toString())
  if (!accessError) return { error: "Not enrolled" }
  if ("error" in accessError) return accessError

  const progress = await StudentProgress.findOne({
    student: session.user.id,
    course: exam.course,
  })
  if (!progress) return { error: "Not enrolled" }

  const attemptCount = await ExamSubmission.countDocuments({
    student: session.user.id,
    exam: examId,
  })
  if (attemptCount >= exam.maxAttempts) {
    return { error: "Maximum attempts reached" }
  }

  let totalPoints = 0
  let earnedPoints = 0
  const gradedAnswers = exam.questions.map((q) => {
    const qId = (q._id as Types.ObjectId)
    const studentAnswer = answers[qId.toString()] ?? ""
    const correct = q.correctAnswer.trim().toLowerCase() === studentAnswer.trim().toLowerCase()
    totalPoints += q.points
    if (correct) earnedPoints += q.points
    return { questionId: qId, answer: studentAnswer }
  })

  const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0
  const passed = score >= exam.passingMarks
  const attemptCountForSubmit = await ExamSubmission.countDocuments({
    student: session.user.id,
    exam: examId,
  })

  const deadlineError = await courseGuard(session.user.id, exam.course.toString())
  if (deadlineError) return deadlineError

  await ExamSubmission.create({
    student: session.user.id,
    exam: examId,
    course: exam.course,
    answers: gradedAnswers,
    score,
    passed,
    attemptNumber: attemptCountForSubmit + 1,
  })

  if (passed) {
    progress.examPassed = true
    progress.examScore = score
    progress.certificateIssued = true
    await progress.save()

    // Issue (or reuse) the certificate of completion and its serial number.
    await issueCertificate(session.user.id, exam.course.toString())
  }

  revalidatePath(`/student/courses/${exam.course.toString()}`)
  return { success: true, score, passed, passingScore: exam.passingMarks }
}
