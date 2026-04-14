import { getCourseAnnouncements } from "@/actions/announcement.actions"
import { auth } from "@/auth"
import { connectDB } from "@/lib/mongoose"
import Course from "@/models/Course.model"
import { notFound } from "next/navigation"
import { AnnouncementsClient } from "@/components/teacher/AnnouncementsClient"

export default async function CourseAnnouncementsPage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = await params
  const session = await auth()

  await connectDB()
  const course = await Course.findOne({ _id: courseId, teacher: session!.user.id }).lean()
  if (!course) notFound()

  const announcements = await getCourseAnnouncements(courseId)

  return (
    <AnnouncementsClient
      courseId={courseId}
      courseTitle={course.title}
      announcements={announcements}
    />
  )
}
