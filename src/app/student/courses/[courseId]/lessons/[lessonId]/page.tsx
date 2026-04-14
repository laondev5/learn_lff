import { notFound } from "next/navigation"
import { getLessonForStudent } from "@/actions/student.actions"
import { LessonViewerClient } from "@/components/student/LessonViewerClient"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

interface Props {
  params: Promise<{ courseId: string; lessonId: string }>
}

export default async function StudentLessonPage({ params }: Props) {
  const { courseId, lessonId } = await params
  const lesson = await getLessonForStudent(lessonId)

  if (!lesson) notFound()
  if ("error" in lesson) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href={`/student/courses/${courseId}`} className="hover:underline">Course</Link>
          <ChevronRight className="h-3 w-3" />
          <span>Lesson Locked</span>
        </div>
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {lesson.error}
        </div>
      </div>
    )
  }

  return <LessonViewerClient lesson={lesson} courseId={courseId} />
}
