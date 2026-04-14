import { getTeacherAllCoursesAnalytics } from "@/actions/announcement.actions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BarChart3, BookOpen, GraduationCap, Users } from "lucide-react"
import Link from "next/link"

export default async function TeacherAnalyticsPage() {
  const courses = await getTeacherAllCoursesAnalytics()

  const totalEnrolled = courses.reduce((sum, c) => sum + c.enrolled, 0)
  const totalPassed = courses.reduce((sum, c) => sum + c.passed, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">Student progress across all your courses</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{courses.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Enrollments</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEnrolled}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exam Passes</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPassed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalEnrolled > 0 ? Math.round((totalPassed / totalEnrolled) * 100) : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-course breakdown */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Course Breakdown</h2>
        {courses.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              No courses yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {courses.map((course) => {
              const passRate = course.enrolled > 0
                ? Math.round((course.passed / course.enrolled) * 100)
                : 0
              return (
                <Card key={course.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium truncate">{course.title}</h3>
                          <Badge variant={course.isPublished ? "default" : "secondary"} className="text-xs shrink-0">
                            {course.isPublished ? "Published" : "Draft"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {course.enrolled} enrolled
                          </span>
                          <span className="flex items-center gap-1">
                            <GraduationCap className="h-3 w-3" />
                            {course.passed} passed
                          </span>
                          <span>{passRate}% pass rate</span>
                        </div>
                        {/* Progress bar */}
                        <div className="w-full max-w-xs h-1.5 bg-muted rounded-full mt-2">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${passRate}%` }}
                          />
                        </div>
                      </div>
                      <Button asChild variant="outline" size="sm" className="shrink-0">
                        <Link href={`/teacher/analytics/${course.id}`}>
                          View Details
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
