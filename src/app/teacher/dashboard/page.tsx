import { auth } from "@/auth"
import { connectDB } from "@/lib/mongoose"
import Course from "@/models/Course.model"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ActivityRing,
  DashboardHero,
  HighlightList,
  MetricCard,
  SimpleBarChart,
} from "@/components/shared/dashboard-kit"
import { getTeacherAllCoursesAnalytics } from "@/actions/announcement.actions"
import {
  BarChart3,
  BookOpen,
  ExternalLink,
  Eye,
  GraduationCap,
  Users,
  Video,
} from "lucide-react"
import Link from "next/link"
import { CreateLiveClassDialog } from "@/components/teacher/CreateLiveClassDialog"
import { getLiveClasses } from "@/actions/live-class.actions"

async function getTeacherStats(teacherId: string) {
  await connectDB()
  const [total, published, liveClasses, courseAnalytics] = await Promise.all([
    Course.countDocuments({ teacher: teacherId }),
    Course.countDocuments({ teacher: teacherId, isPublished: true }),
    getLiveClasses("teacher", teacherId),
    getTeacherAllCoursesAnalytics(),
  ])

  const totalEnrolled = courseAnalytics.reduce((sum, course) => sum + course.enrolled, 0)
  const totalPassed = courseAnalytics.reduce((sum, course) => sum + course.passed, 0)
  const passRate = totalEnrolled > 0 ? Math.round((totalPassed / totalEnrolled) * 100) : 0

  return {
    total,
    published,
    drafts: total - published,
    liveClasses,
    courseAnalytics,
    totalEnrolled,
    totalPassed,
    passRate,
  }
}

export default async function TeacherDashboardPage() {
  const session = await auth()
  const { total, published, drafts, liveClasses, courseAnalytics, totalEnrolled, totalPassed, passRate } =
    await getTeacherStats(session!.user.id)
  const upcomingClasses = liveClasses.filter((item) => new Date(item.startTime) > new Date())
  const topCourses = [...courseAnalytics].sort((a, b) => b.enrolled - a.enrolled).slice(0, 4)

  return (
    <div className="space-y-8">
      <DashboardHero
        eyebrow="Teacher Studio"
        title={`Welcome back, ${session!.user.name}.`}
        description="Your dashboard now brings course reach, student outcomes, and live class activity together, with brighter visuals and quicker access to analytics."
        illustrationPrompt="teacher dashboard illustration, educator presenting online course analytics with students on laptop screens, purple blue yellow palette, modern SaaS vector style, clean website hero"
        illustrationAlt="Teacher dashboard illustration"
        illustrationSrc="/Teacher student-pana.svg"
      >
        <div className="flex flex-wrap gap-3">
          <CreateLiveClassDialog>
            <Button className="gap-2 rounded-full px-5">
              <Video className="h-4 w-4" />
              Schedule Live Class
            </Button>
          </CreateLiveClassDialog>
          <Button asChild variant="outline" className="rounded-full px-5">
            <Link href="/teacher/analytics">View Analytics</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full px-5">
            <Link href="/teacher/courses">Manage Courses</Link>
          </Button>
        </div>
      </DashboardHero>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Courses"
          value={total}
          description="All courses owned by you."
          icon={BookOpen}
          tone="violet"
        />
        <MetricCard
          title="Published"
          value={published}
          description={`${drafts} draft courses waiting on polish.`}
          icon={Eye}
          tone="sky"
        />
        <MetricCard
          title="Enrollments"
          value={totalEnrolled}
          description="Students enrolled across your courses."
          icon={Users}
          tone="amber"
        />
        <MetricCard
          title="Passes"
          value={totalPassed}
          description="Students who have passed course exams."
          icon={GraduationCap}
          tone="emerald"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <SimpleBarChart
          title="Course Reach"
          description="Enrollment by course, ordered from strongest to weakest."
          data={courseAnalytics.map((course, index) => ({
            label: course.title,
            value: course.enrolled,
            note: `${course.passed} passed`,
            color: [
              "linear-gradient(90deg,#7b5cff,#9c8bff)",
              "linear-gradient(90deg,#38bdf8,#60a5fa)",
              "linear-gradient(90deg,#f59e0b,#fbbf24)",
              "linear-gradient(90deg,#fb7185,#fdba74)",
              "linear-gradient(90deg,#22c55e,#84cc16)",
            ][index % 5],
          }))}
          emptyText="Create a course to start building analytics."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <ActivityRing
            title="Pass Rate"
            description="Exam success across your enrolled students."
            value={passRate}
          />
          <HighlightList
            title="Teaching Snapshot"
            items={[
              { label: "Upcoming live classes", value: `${upcomingClasses.length}`, tone: "rgba(56,189,248,0.14)" },
              { label: "Draft courses", value: `${drafts}`, tone: "rgba(245,158,11,0.14)" },
              { label: "Published ratio", value: `${total > 0 ? Math.round((published / total) * 100) : 0}%`, tone: "rgba(123,92,255,0.12)" },
              { label: "Analytics-ready courses", value: `${courseAnalytics.length}`, tone: "rgba(34,197,94,0.14)" },
            ]}
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 font-heading text-xl">
              <BarChart3 className="h-5 w-5 text-primary" />
              Course Performance
            </CardTitle>
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link href="/teacher/analytics">Open Analytics</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {topCourses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No course activity yet.</p>
            ) : (
              topCourses.map((course) => {
                const passRateByCourse = course.enrolled > 0 ? Math.round((course.passed / course.enrolled) * 100) : 0

                return (
                  <div key={course.id} className="rounded-2xl border border-primary/10 bg-muted/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{course.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {course.enrolled} students enrolled
                        </p>
                      </div>
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        {passRateByCourse}% pass rate
                      </span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#7b5cff,#38bdf8)]"
                        style={{ width: `${passRateByCourse}%` }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-heading text-2xl font-semibold">
              <Video className="h-5 w-5 text-primary" />
              Live Classes
            </h2>
          </div>

          {liveClasses.length > 0 ? (
            <div className="grid gap-4">
              {liveClasses.slice(0, 3).map((lc) => (
                <Card key={lc._id.toString()} className="border-primary/10 bg-white/80">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start gap-2">
                      <CardTitle className="text-base line-clamp-1">{lc.title}</CardTitle>
                      <span className="rounded-full border border-primary/15 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                        {new Date(lc.startTime) > new Date() ? "Upcoming" : "Past"}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="line-clamp-2 h-10 text-sm text-muted-foreground">
                      {lc.description}
                    </p>
                    <div className="space-y-1 text-xs">
                      <p className="font-medium">
                        Start: {new Date(lc.startTime).toLocaleString()}
                      </p>
                      <p className="text-muted-foreground">
                        End: {new Date(lc.endTime).toLocaleString()}
                      </p>
                    </div>
                    <Button asChild className="w-full gap-2 rounded-full" variant="secondary" size="sm">
                      <a href={lc.meetLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        Join Google Meet
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-primary/10">
              <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <Video className="mb-4 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No live classes scheduled yet.</p>
                <CreateLiveClassDialog>
                  <Button variant="link" size="sm">Schedule your first class</Button>
                </CreateLiveClassDialog>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
