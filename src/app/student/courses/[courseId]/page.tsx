import Link from "next/link"
import { getStudentCourseAccess } from "@/lib/cohort-access"
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
    if ("error" in preview) return <div className="space-y-4"><h1 className="text-2xl font-bold">Course access</h1><p role="status">{preview.error}</p><Link href="/student/appeals" className="text-primary underline">View access status or request an appeal</Link></div>
    return <CoursePreviewView course={preview} />
  }

  const questions = await getCourseQuestions(courseId)
  const access = await getStudentCourseAccess(session!.user.id, courseId)
  const deadline = access.endsAt ? new Date(access.endsAt).toLocaleString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" }) : null

  return (
    <div className="space-y-6">
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
    <aside className="rounded-lg border p-4 text-sm space-y-2"><p>One module opens per day and stays open for 24 hours. Write the module test within that window — if you miss it, the module locks and you must appeal to reopen it.</p><p>{deadline ? `Course access closes ${deadline} (Lagos time).` : "Module availability follows your cohort schedule."}</p><Link href="/student/appeals" className="text-primary underline">View module access status or request an appeal</Link></aside>
    </div>
  )
}
