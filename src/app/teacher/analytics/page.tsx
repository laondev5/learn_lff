import { getTeacherAllCoursesAnalytics } from "@/actions/announcement.actions"
import {
  ActivityRing,
  DashboardHero,
  HighlightList,
  MetricCard,
  SimpleBarChart,
} from "@/components/shared/dashboard-kit"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BookOpen, Eye, GraduationCap, Users } from "lucide-react"
import Link from "next/link"

export default async function TeacherAnalyticsPage() {
  const courses = await getTeacherAllCoursesAnalytics()

  const totalEnrolled = courses.reduce((sum, c) => sum + c.enrolled, 0)
  const totalPassed = courses.reduce((sum, c) => sum + c.passed, 0)
  const publishedCourses = courses.filter((course) => course.isPublished).length
  const passRate = totalEnrolled > 0 ? Math.round((totalPassed / totalEnrolled) * 100) : 0

  return (
    <div className="space-y-8">
      <DashboardHero
        eyebrow="Teacher Analytics"
        title="Understand what is working across all your courses."
        description="This analytics workspace highlights enrollment momentum, pass rates, and which courses are ready for deeper review."
        illustrationPrompt="teacher analytics illustration, instructor reviewing student growth charts and course metrics on dashboard screens, purple sky blue amber palette, modern SaaS vector website hero"
        illustrationAlt="Teacher analytics illustration"
      >
        <div className="flex flex-wrap gap-3">
          <Button asChild className="rounded-full px-5">
            <Link href="/teacher/dashboard">Back to Dashboard</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full px-5">
            <Link href="/teacher/courses">Manage Courses</Link>
          </Button>
        </div>
      </DashboardHero>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Courses"
          value={courses.length}
          description="Courses you currently own."
          icon={BookOpen}
          tone="violet"
        />
        <MetricCard
          title="Published"
          value={publishedCourses}
          description={`${courses.length - publishedCourses} courses are still drafts.`}
          icon={Eye}
          tone="sky"
        />
        <MetricCard
          title="Enrollments"
          value={totalEnrolled}
          description="Students reached across all your courses."
          icon={Users}
          tone="amber"
        />
        <MetricCard
          title="Exam Passes"
          value={totalPassed}
          description="Students who have successfully completed exams."
          icon={GraduationCap}
          tone="emerald"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <SimpleBarChart
          title="Course Enrollment"
          description="Enrollment performance by course."
          data={courses.map((course, index) => ({
            label: course.title,
            value: course.enrolled,
            note: `${course.passed} students passed`,
            color: [
              "linear-gradient(90deg,#7b5cff,#9c8bff)",
              "linear-gradient(90deg,#38bdf8,#60a5fa)",
              "linear-gradient(90deg,#f59e0b,#facc15)",
              "linear-gradient(90deg,#fb7185,#fdba74)",
              "linear-gradient(90deg,#22c55e,#84cc16)",
            ][index % 5],
          }))}
          emptyText="Create a course to start seeing analytics."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <ActivityRing
            title="Pass Rate"
            description="Exam success against total enrollments."
            value={passRate}
          />
          <HighlightList
            title="Analytics Snapshot"
            items={[
              { label: "Published courses", value: `${publishedCourses}`, tone: "rgba(56,189,248,0.14)" },
              { label: "Draft courses", value: `${courses.length - publishedCourses}`, tone: "rgba(251,146,60,0.16)" },
              { label: "Courses with enrollments", value: `${courses.filter((course) => course.enrolled > 0).length}`, tone: "rgba(123,92,255,0.12)" },
              { label: "Overall pass rate", value: `${passRate}%`, tone: "rgba(34,197,94,0.14)" },
            ]}
          />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="font-heading text-2xl font-semibold">Course Breakdown</h2>
        {courses.length === 0 ? (
          <Card className="border-primary/10">
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
                <Card
                  key={course.id}
                  className="border-primary/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(241,250,255,0.95))]"
                >
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
                        <div className="w-full max-w-xs h-1.5 bg-muted rounded-full mt-2">
                          <div
                            className="h-full rounded-full bg-[linear-gradient(90deg,#7b5cff,#38bdf8)]"
                            style={{ width: `${passRate}%` }}
                          />
                        </div>
                      </div>
                      <Button asChild variant="outline" size="sm" className="shrink-0 rounded-full">
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
