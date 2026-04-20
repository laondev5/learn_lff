import { notFound } from "next/navigation"
import { getCourseWithModules } from "@/lib/course.queries"
import { CourseDetailClient } from "@/components/teacher/CourseDetailClient"
import { getCourseQuestions } from "@/actions/qa.actions"
import { auth } from "@/auth"

export const dynamic = "force-dynamic"

interface Props {
  params: Promise<{ courseId: string }>
}

export default async function CourseDetailPage({ params }: Props) {
  const { courseId } = await params
  const session = await auth()
  
  const [course, questions] = await Promise.all([
    getCourseWithModules(courseId),
    getCourseQuestions(courseId),
  ])

  if (!course) notFound()

  return (
    <CourseDetailClient 
      course={course} 
      questions={questions} 
      currentUserId={session!.user.id} 
    />
  )
}
