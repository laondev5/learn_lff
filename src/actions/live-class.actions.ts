"use server"

import { getStudentCourseAccess } from "@/lib/cohort-access"
import StudentProgress from "@/models/StudentProgress.model"
import { auth } from "@/auth"
import { connectDB } from "@/lib/mongoose"
import LiveClass, { ILiveClass } from "@/models/LiveClass.model"
import { createCalendarEvent } from "@/lib/google-calendar"
import { revalidatePath } from "next/cache"

export async function createLiveClass(formData: FormData) {
  const session = await auth()

  if (!session || session.user.role !== "teacher") {
    return { error: "Unauthorized" }
  }

  const title = formData.get("title") as string
  const description = formData.get("description") as string
  const startTime = formData.get("startTime") as string
  const endTime = formData.get("endTime") as string
  const courseId = formData.get("courseId") as string

  if (!title || !description || !startTime || !endTime) {
    return { error: "Please fill in all fields" }
  }

  try {
    // 1. Create Google Calendar Event and get Meet Link
    const { meetLink, googleEventId } = await createCalendarEvent(session.user.id, {
      title,
      description,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
    })

    // 2. Save to database
    await connectDB()
    const liveClass = new LiveClass({
      title,
      description,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      meetLink,
      googleEventId,
      instructor: session.user.id,
      course: courseId || undefined,
    })

    await liveClass.save()

    revalidatePath("/teacher/dashboard")
    return { success: true, meetLink }
  } catch (error) {
    console.error("Error creating live class:", error)
    return { error: error instanceof Error ? error.message : "Failed to create live class" }
  }
}

export async function getLiveClasses(role: "teacher" | "student", userId: string) {
  const session = await auth()
  if (!session?.user || session.user.id !== userId || session.user.role !== role) return []
  await connectDB()
  const filter = role === "teacher" ? { instructor: userId } : {}
  const classes = await LiveClass.find(filter).sort({ startTime: 1 }).lean()
  const access = role === "student" ? await Promise.all(classes.map(async c => !c.course || ((await getStudentCourseAccess(userId, c.course.toString())).allowed && !!(await StudentProgress.exists({ student: userId, course: c.course }))))) : classes.map(() => true)
  return JSON.parse(JSON.stringify(classes.filter((_, i) => access[i]))) as ILiveClass[] // Using ILiveClass[] for proper typing
}
