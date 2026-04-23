"use server"

import { connectDB } from "@/lib/mongoose"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import Course from "@/models/Course.model"
import Module from "@/models/Module.model"
import Lesson from "@/models/Lesson.model"
import Test from "@/models/Test.model"
import Assessment from "@/models/Assessment.model"
import StudentProgress from "@/models/StudentProgress.model"
import TestSubmission from "@/models/TestSubmission.model"
import ExamSubmission from "@/models/ExamSubmission.model"
import Certificate from "@/models/Certificate.model"
import { Types } from "mongoose"

import { initializePaystackPayment } from "@/lib/paystack"

// ─── Enrollment & Course Listing ─────────────────────────────────────────────

export async function initializeCoursePayment(courseId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "student") return { error: "Unauthorized" }

  await connectDB()
  const course = await Course.findById(courseId).lean()
  if (!course) return { error: "Course not found" }
  if (!course.isPaid) return { error: "This course is free. Use direct enrollment." }

  try {
    const paymentData = await initializePaystackPayment({
      email: session.user.email!,
      amount: course.price,
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
    .populate("course")
    .lean()

  return progresses.map((p) => {
    const course = p.course as unknown as {
      _id: Types.ObjectId
      title: string
      description: string
      isPublished: boolean
    }
    return {
      courseId: course._id.toString(),
      title: course.title,
      description: course.description,
      isPublished: course.isPublished,
      completedLessons: p.completedLessons.length,
      examPassed: p.examPassed,
      certificateIssued: p.certificateIssued,
      enrolledAt: p.enrolledAt.toISOString(),
    }
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
  }).lean()

  return courses.map((c) => ({
    id: c._id.toString(),
    title: c.title,
    description: c.description,
    isPaid: c.isPaid,
    price: c.price,
  }))
}

export async function enrollInCourse(courseId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "student") return { error: "Unauthorized" }

  await connectDB()
  const existing = await StudentProgress.findOne({
    student: session.user.id,
    course: courseId,
  })
  if (existing) return { error: "Already enrolled" }

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
  const progress = await StudentProgress.findOne({
    student: session.user.id,
    course: courseId,
  }).lean()
  if (!progress) return null

  const course = await Course.findById(courseId).lean()
  if (!course) return null

  const modules = await Module.find({ course: courseId, isPublished: true }).sort({ order: 1 }).lean()

  const completedLessonIds = progress.completedLessons.map((id) => id.toString())
  const completedModuleIds = progress.completedModules.map((id) => id.toString())

  const modulesData = await Promise.all(
    modules.map(async (mod) => {
      const lessons = await Lesson.find({ module: mod._id, isPublished: true })
        .sort({ order: 1 })
        .lean()
      return {
        id: mod._id.toString(),
        title: mod.title,
        order: mod.order,
        isCompleted: completedModuleIds.includes(mod._id.toString()),
        lessons: lessons.map((l) => ({
          id: l._id.toString(),
          title: l.title,
          order: l.order,
          isCompleted: completedLessonIds.includes(l._id.toString()),
        })),
      }
    })
  )

  const exam = await Assessment.findOne({ course: courseId, type: "exam", isPublished: true }).lean()

  const totalLessons = modulesData.reduce((acc, mod) => acc + mod.lessons.length, 0)
  const completedLessonsCount = modulesData.reduce(
    (acc, mod) => acc + mod.lessons.filter((l) => l.isCompleted).length,
    0
  )

  return {
    id: course._id.toString(),
    title: course.title,
    description: course.description,
    coverImageUrl: course.coverImageUrl ?? null,
    modules: modulesData,
    hasExam: !!exam,
    examPassed: progress.examPassed,
    certificateIssued: progress.certificateIssued,
    allModulesComplete: modulesData.every((m) => m.isCompleted),
    totalLessons,
    completedLessonsCount,
  }
}

// ─── Lesson Viewer ────────────────────────────────────────────────────────────

export async function getLessonForStudent(lessonId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "student") return null

  await connectDB()
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
    courseId: lesson.course.toString(),
    moduleId: lesson.module.toString(),
    isCompleted,
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

export async function markLessonViewed(lessonId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "student") return { error: "Unauthorized" }

  await connectDB()
  const lesson = await Lesson.findById(lessonId).lean()
  if (!lesson) return { error: "Lesson not found" }

  const progress = await StudentProgress.findOne({
    student: session.user.id,
    course: lesson.course,
  })
  if (!progress) return { error: "Not enrolled" }

  const alreadyDone = progress.completedLessons.map((id) => id.toString()).includes(lessonId)

  // Only mark complete if no test (if there's a test, completion happens on test pass)
  const hasTest = await Test.exists({ lesson: lessonId, isPublished: true })
  if (!hasTest && !alreadyDone) {
    progress.completedLessons.push(new Types.ObjectId(lessonId))
    progress.updatedAt = new Date() // Force updatedAt change
    await progress.save()
    await checkModuleCompletion(progress._id.toString(), lesson.module.toString(), lesson.course.toString())
  }

  revalidatePath(`/student/courses/${lesson.course.toString()}`)
  return { success: true }
}

// ─── Test Submission ──────────────────────────────────────────────────────────

export async function submitTest(testId: string, answers: Record<string, string>) {
  const session = await auth()
  if (!session?.user || session.user.role !== "student") return { error: "Unauthorized" }

  await connectDB()
  const test = await Test.findById(testId).lean()
  if (!test) return { error: "Test not found" }

  const progress = await StudentProgress.findOne({
    student: session.user.id,
    course: test.course,
  })
  if (!progress) return { error: "Not enrolled" }

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
    const correct = q.correctAnswer.trim().toLowerCase() === studentAnswer.trim().toLowerCase()
    totalPoints += q.points
    if (correct) earnedPoints += q.points
    return { questionId: qId, answer: studentAnswer }
  })

  const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0
  const passed = score >= test.passingScore

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

  const moduleLessons = await Lesson.find({ module: moduleId, isPublished: true }).lean()
  const completedLessonIds = progress.completedLessons.map((id) => id.toString())
  const allLessonsDone = moduleLessons.every((l) => completedLessonIds.includes(l._id.toString()))

  if (allLessonsDone) {
    const alreadyDone = progress.completedModules.map((id) => id.toString()).includes(moduleId)
    if (!alreadyDone) {
      progress.completedModules.push(new Types.ObjectId(moduleId))
      await progress.save()
    }
  }
}

// ─── Exam ─────────────────────────────────────────────────────────────────────

export async function getExamForStudent(courseId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "student") return null

  await connectDB()
  const progress = await StudentProgress.findOne({
    student: session.user.id,
    course: courseId,
  }).lean()
  if (!progress) return null

  // Check all modules complete
  const modules = await Module.find({ course: courseId, isPublished: true }).lean()
  const completedModuleIds = progress.completedModules.map((id) => id.toString())
  const allDone = modules.every((m) => completedModuleIds.includes(m._id.toString()))
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
  if (!exam) return { error: "Exam not found" }

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

    // Create certificate record
    await Certificate.findOneAndUpdate(
      { student: session.user.id, course: exam.course },
      { student: session.user.id, course: exam.course, issuedAt: new Date() },
      { upsert: true }
    )
  }

  revalidatePath(`/student/courses/${exam.course.toString()}`)
  return { success: true, score, passed, passingScore: exam.passingMarks }
}
