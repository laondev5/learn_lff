import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getEnrolledCourses } from "@/actions/student.actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Award, BookOpen, ChevronRight } from "lucide-react"
import Link from "next/link"

export default async function StudentCoursesPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== "student") redirect("/auth/login")

  const enrolled = await getEnrolledCourses()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Courses</h1>
        <p className="text-muted-foreground text-sm mt-1">
          All courses you are currently enrolled in
        </p>
      </div>

      {enrolled.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <BookOpen className="h-12 w-12 text-muted-foreground opacity-40" />
            <div className="text-center">
              <p className="font-medium">No courses yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Go to your dashboard to enrol in available courses.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/student/dashboard">Browse Courses</Link>
            </Button>
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
                    <Award className="h-4 w-4 text-yellow-500 shrink-0" aria-label="Certificate issued" />
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
    </div>
  )
}
