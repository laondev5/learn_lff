import { getCourseExam } from "@/lib/course.queries"
import { AssessmentBuilderClient } from "@/components/teacher/AssessmentBuilderClient"
import { ChevronRight } from "lucide-react"
import Link from "next/link"

interface Props {
  params: Promise<{ courseId: string }>
}

export default async function ExamPage({ params }: Props) {
  const { courseId } = await params
  const exam = await getCourseExam(courseId)

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <Link href="/teacher/courses" className="hover:underline">Courses</Link>
          <ChevronRight className="h-3 w-3" />
          <Link href={`/teacher/courses/${courseId}`} className="hover:underline">Course</Link>
          <ChevronRight className="h-3 w-3" />
          <span>Final Exam</span>
        </div>
        <h1 className="text-2xl font-bold">Final Exam</h1>
        <p className="text-sm text-muted-foreground">
          Students take this exam after completing all modules
        </p>
      </div>
      
      <AssessmentBuilderClient courseId={courseId} assessment={exam} />
    </div>
  )
}
