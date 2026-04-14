import { notFound } from "next/navigation"
import { getLessonWithTest } from "@/lib/course.queries"
import { LessonDetailClient } from "@/components/teacher/LessonDetailClient"

interface Props {
  params: Promise<{ courseId: string; moduleId: string; lessonId: string }>
}

export default async function LessonDetailPage({ params }: Props) {
  const { lessonId } = await params
  const lesson = await getLessonWithTest(lessonId)
  if (!lesson) notFound()

  return <LessonDetailClient lesson={lesson} />
}
