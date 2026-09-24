import { notFound } from "next/navigation"
import { getCourseForStudent, getLessonForStudent } from "@/actions/student.actions"
import { LessonViewerClient } from "@/components/student/LessonViewerClient"
import { CourseCurriculum } from "@/components/student/CourseCurriculum"
import { ProgressBar } from "@/components/student/CourseCards"
import Link from "next/link"
import { ChevronRight, Trophy } from "lucide-react"

interface Props {
  params: Promise<{ courseId: string; lessonId: string }>
}

export default async function StudentLessonPage({ params }: Props) {
  const { courseId, lessonId } = await params
  const [lesson, course] = await Promise.all([
    getLessonForStudent(lessonId),
    getCourseForStudent(courseId),
  ])

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

  const hasCurriculum = course && !("error" in course)
  const progress = hasCurriculum && course.totalLessons > 0
    ? Math.round((course.completedLessonsCount / course.totalLessons) * 100)
    : 0

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0">
        <LessonViewerClient lesson={lesson} courseId={courseId} />
      </div>

      {hasCurriculum && (
        <aside className="xl:sticky xl:top-0 xl:self-start">
          <div className="overflow-hidden rounded-xl border bg-card xl:max-h-[calc(100vh-4rem)] xl:overflow-y-auto">
            <div className="space-y-2 border-b p-4">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/student/courses/${courseId}`} className="font-bold hover:underline line-clamp-1">
                  Course content
                </Link>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <Trophy className="h-3.5 w-3.5 text-amber-500" />{progress}%
                </span>
              </div>
              <ProgressBar value={progress} />
              <p className="text-xs text-muted-foreground">
                {course.completedLessonsCount} of {course.totalLessons} lessons complete
              </p>
            </div>
            <CourseCurriculum
              sections={course.modules}
              courseId={courseId}
              mode="sidebar"
              currentLessonId={lessonId}
            />
          </div>
        </aside>
      )}
    </div>
  )
}
