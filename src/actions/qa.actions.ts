"use server"

import { auth } from "@/auth"
import { connectDB } from "@/lib/mongoose"
import CourseQuestion, { IQuestionAnswer } from "@/models/CourseQuestion.model"
import Course from "@/models/Course.model"
import User, { IUser } from "@/models/User.model"
import { sendEmail, urgentQuestionEmailHtml } from "@/lib/email"
import { revalidatePath } from "next/cache"
import { Types } from "mongoose"

export async function askQuestion(courseId: string, data: { title: string, content: string, isUrgent: boolean }) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }

  const { title, content, isUrgent } = data

  if (!title || !content) return { error: "Please fill in all fields" }

  await connectDB()

  const course = await Course.findById(courseId).populate<{ teacher: IUser }>("teacher").lean()
  if (!course) return { error: "Course not found" }

  const question = await CourseQuestion.create({
    course: courseId,
    author: session.user.id,
    title,
    content,
    isUrgent,
  })

  if (isUrgent) {
    const teacher = course.teacher
    if (teacher?.email) {
      try {
        await sendEmail({
          to: teacher.email,
          subject: `Urgent Question: ${title}`,
          html: urgentQuestionEmailHtml(
            teacher.name,
            session.user.name || "A student",
            course.title,
            title,
            content
          ),
        })
      } catch (error) {
        console.error("Failed to send urgent question email:", error)
      }
    }
  }

  revalidatePath(`/student/courses/${courseId}`)
  revalidatePath(`/teacher/courses/${courseId}`)
  return { success: true, questionId: question._id.toString() }
}

export async function answerQuestion(questionId: string, courseId: string, content: string) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }

  if (!content) return { error: "Content is required" }

  await connectDB()

  const question = await CourseQuestion.findById(questionId)
  if (!question) return { error: "Question not found" }

  const newAnswer = {
    author: new Types.ObjectId(session.user.id),
    content,
  }

  question.answers.push(newAnswer as IQuestionAnswer)

  await question.save()

  revalidatePath(`/student/courses/${courseId}`)
  revalidatePath(`/teacher/courses/${courseId}`)
  return { success: true }
}

export async function getCourseQuestions(courseId: string) {
  await connectDB()
  const questions = await CourseQuestion.find({ course: courseId })
    .populate("author", "name role avatarUrl")
    .populate("answers.author", "name role avatarUrl")
    .sort({ createdAt: -1 })
    .lean()

  return JSON.parse(JSON.stringify(questions))
}

export async function toggleQuestionResolved(questionId: string, courseId: string) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }

  await connectDB()
  const question = await CourseQuestion.findById(questionId)
  if (!question) return { error: "Question not found" }

  // Only author or teacher can mark as resolved
  const course = await Course.findById(courseId).lean()
  const isTeacher = session.user.role === "teacher" && course?.teacher.toString() === session.user.id
  const isAuthor = question.author.toString() === session.user.id

  if (!isTeacher && !isAuthor) return { error: "Unauthorized" }

  question.isResolved = !question.isResolved
  await question.save()

  revalidatePath(`/student/courses/${courseId}`)
  revalidatePath(`/teacher/courses/${courseId}`)
  return { success: true }
}
