import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { BookOpen } from "lucide-react"
import { getEnrolledCourses } from "@/actions/student.actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { LearningCourseCard } from "@/components/student/CourseCards"

export default async function StudentCoursesPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== "student") redirect("/auth/login")

  const enrolled = await getEnrolledCourses()
  const inProgress = enrolled.filter((c) => !c.examPassed && c.progressPercent < 100)
  const completed = enrolled.filter((c) => c.examPassed || c.progressPercent >= 100)

  return (
    <div className="space-y-8">
      <div className="-mx-4 -mt-4 bg-gray-900 px-4 pb-6 pt-8 text-white md:-mx-6 md:-mt-6 md:px-6 lg:-mx-8 lg:-mt-8 lg:px-8">
        <h1 className="text-3xl font-extrabold">My learning</h1>
        <p className="mt-1 text-sm text-gray-300">
          {enrolled.length} course{enrolled.length !== 1 ? "s" : ""} · {completed.length} completed
        </p>
      </div>

      {enrolled.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <BookOpen className="h-12 w-12 text-muted-foreground opacity-40" />
            <div className="text-center">
              <p className="font-medium">Start learning today</p>
              <p className="text-sm text-muted-foreground mt-1">
                When you enroll in a course, it will appear here.
              </p>
            </div>
            <Button asChild>
              <Link href="/student/dashboard#available">Browse courses</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {inProgress.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-bold">In progress</h2>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {inProgress.map((c) => <LearningCourseCard key={c.courseId} course={c} />)}
              </div>
            </section>
          )}
          {completed.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-bold">Completed</h2>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {completed.map((c) => <LearningCourseCard key={c.courseId} course={c} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
