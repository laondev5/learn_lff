import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { getModuleTestForStudent } from "@/actions/student.actions"
import { ExamTakerClient } from "@/components/student/ExamTakerClient"

interface Props {
  params: Promise<{ courseId: string; testId: string }>
}

export default async function StudentModuleTestPage({ params }: Props) {
  const { courseId, testId } = await params
  const test = await getModuleTestForStudent(courseId, testId)

  if (!test) {
    return (
      <div className="max-w-xl space-y-4">
        <p className="text-muted-foreground">You are not enrolled in this course.</p>
        <Link href="/student/courses" className="text-primary underline">Back to my courses</Link>
      </div>
    )
  }

  if ("error" in test) {
    return (
      <div className="max-w-xl space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href={`/student/courses/${courseId}`} className="hover:underline">Course</Link>
          <ChevronRight className="h-3 w-3" />
          <span>Module test</span>
        </div>
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {test.error}
        </div>
        <Link href={`/student/courses/${courseId}`} className="text-primary underline">Return to course</Link>
      </div>
    )
  }

  return <ExamTakerClient assessmentId={test.id} courseId={courseId} kind="module-test" />
}
