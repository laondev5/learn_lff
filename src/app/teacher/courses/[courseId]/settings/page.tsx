import { notFound, redirect } from "next/navigation"
import { auth } from "@/auth"
import { connectDB } from "@/lib/mongoose"
import Course from "@/models/Course.model"
import { CourseSettingsClient } from "@/components/teacher/CourseSettingsClient"

export const dynamic = "force-dynamic"

interface Props {
  params: Promise<{ courseId: string }>
}

export default async function CourseSettingsPage({ params }: Props) {
  const { courseId } = await params
  const session = await auth()
  
  if (!session?.user || session.user.role !== "teacher") {
    redirect("/auth/login")
  }

  await connectDB()
  
  // Verify the course exists and belongs to the teacher
  const course = await Course.findOne({ _id: courseId, teacher: session.user.id }).lean()
  if (!course) notFound()

  return (
    <CourseSettingsClient 
      courseId={courseId} 
      courseTitle={course.title ?? ""} 
    />
  )
}
