import { auth } from "@/auth"
import { getEnrolledCourses, getAvailableCourses } from "@/actions/student.actions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BookOpen, Award, ChevronRight, Plus } from "lucide-react"
import Link from "next/link"
import { EnrollCourseButton } from "@/components/student/EnrollCourseButton"

export default async function StudentDashboardPage() {
  const session = await auth()
  const [enrolled, available] = await Promise.all([
    getEnrolledCourses(),
    getAvailableCourses(),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">My Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Welcome back, {session!.user.name}
          {session!.user.cohort && (
            <span className="ml-2 text-xs">· {session!.user.cohort}</span>
          )}
        </p>
      </div>

      {/* Enrolled courses */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">My Courses</h2>
        {enrolled.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>You haven&apos;t enrolled in any courses yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {enrolled.map((c) => (
              <Card key={c.courseId} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">{c.title}</CardTitle>
                    {c.certificateIssued && (
                      <Award className="h-4 w-4 text-yellow-500 shrink-0" />
                    )}
                  </div>
                  <CardDescription className="line-clamp-2">{c.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto space-y-3">
                  <div className="flex items-center gap-2">
                    {c.examPassed ? (
                      <Badge variant="default">Completed</Badge>
                    ) : (
                      <Badge variant="secondary">{c.completedLessons} lessons done</Badge>
                    )}
                  </div>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/student/courses/${c.courseId}`}>
                      Continue <ChevronRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Available courses */}
      {available.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Available Courses</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {available.map((c) => (
              <Card key={c.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{c.title}</CardTitle>
                  <CardDescription className="line-clamp-2">{c.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <EnrollCourseButton courseId={c.id} />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
