import { notFound } from "next/navigation"
import { getCourseWithModules } from "@/lib/course.queries"
import { CourseDetailClient } from "@/components/teacher/CourseDetailClient"

export const dynamic = "force-dynamic"

interface Props {
  params: Promise<{ courseId: string }>
}

export default async function CourseDetailPage({ params }: Props) {
  const { courseId } = await params
  const course = await getCourseWithModules(courseId)
  if (!course) notFound()

  return <CourseDetailClient course={course} />
}
