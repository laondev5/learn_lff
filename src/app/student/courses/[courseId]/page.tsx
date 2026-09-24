import { notFound } from "next/navigation"
import { getCourseForStudent, getCoursePreview } from "@/actions/student.actions"
import { CourseQAClient } from "@/components/shared/CourseQAClient"
import { CourseLearningView, CoursePreviewView } from "@/components/student/CourseViews"
import { getCourseQuestions } from "@/actions/qa.actions"
import { auth } from "@/auth"

interface Props {
  params: Promise<{ courseId: string }>
}

export default async function StudentCoursePage({ params }: Props) {
  const { courseId } = await params
  const session = await auth()
  const course = await getCourseForStudent(courseId)

  // Not enrolled: show the public course landing page instead of a 404
  if (!course || "error" in course) {
    const preview = await getCoursePreview(courseId)
    if (!preview) notFound()
    return <CoursePreviewView course={preview} />
  }

  const questions = await getCourseQuestions(courseId)

  return (
    <CourseLearningView
      course={course}
      questionCount={questions.length}
      qa={
        <CourseQAClient
          courseId={courseId}
          initialQuestions={questions}
          currentUserId={session!.user.id}
          userRole={session!.user.role}
          isTeacherOfCourse={false}
        />
      }
    />
  )
}
