import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { connectDB } from "@/lib/mongoose"
import Course from "@/models/Course.model"
import { CourseMonitoringClient } from "@/components/teacher/CourseMonitoringClient"

export default async function MonitoringPage({ 
  params 
}: { 
  params: Promise<{ courseId: string }> 
}) {
  const { courseId } = await params
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") {
    redirect("/auth/signin")
  }

  await connectDB()
  const course = await Course.findOne({ 
    _id: courseId, 
    teacher: session.user.id 
  })

  if (!course) {
    redirect("/teacher/courses")
  }

  return (
    <div className="container py-8">
      <CourseMonitoringClient courseId={courseId} />
    </div>
  )
}
