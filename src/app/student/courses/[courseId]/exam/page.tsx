import { getExamForStudent } from "@/actions/student.actions"
import { ExamTakerClient } from "@/components/student/ExamTakerClient"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

interface Props {
  params: Promise<{ courseId: string }>
}

export default async function StudentExamPage({ params }: Props) {
  const { courseId } = await params
  const exam = await getExamForStudent(courseId)

  if (!exam) {
    return (
      <div className="max-w-xl space-y-4">
        <p className="text-muted-foreground">You are not enrolled in this course.</p>
      </div>
    )
  }

  if ("error" in exam) {
    return (
      <div className="max-w-xl space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href={`/student/courses/${courseId}`} className="hover:underline">Course</Link>
          <ChevronRight className="h-3 w-3" />
          <span>Final Exam</span>
        </div>
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {exam.error}
        </div>
      </div>
    )
  }

  return <ExamTakerClient exam={exam} courseId={courseId} />
}
