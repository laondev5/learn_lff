import { auth } from "@/auth"
import { getEnrolledCourses, getAvailableCourses } from "@/actions/student.actions"
import {
  ActivityRing,
  DashboardHero,
  HighlightList,
  MetricCard,
  SimpleBarChart,
} from "@/components/shared/dashboard-kit"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Award,
  BookOpen,
  CalendarDays,
  ExternalLink,
  GraduationCap,
  Sparkles,
  Video,
} from "lucide-react"
import Link from "next/link"
import { CatalogCourseCard, LearningCourseCard } from "@/components/student/CourseCards"
import { getLiveClasses } from "@/actions/live-class.actions"

export default async function StudentDashboardPage() {
  const session = await auth()
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 3600000)

  const [enrolled, available, liveClasses] = await Promise.all([
    getEnrolledCourses(),
    getAvailableCourses(),
    getLiveClasses("student", session!.user.id),
  ])
  const upcomingClasses = liveClasses
    .filter((lc) => new Date(lc.startTime) > oneHourAgo)
    .slice(0, 3)
  const completedCourses = enrolled.filter((course) => course.examPassed).length
  const certificates = enrolled.filter((course) => course.certificateIssued).length
  const activeCourses = enrolled.filter((course) => !course.examPassed).length
  const totalLessonsCompleted = enrolled.reduce((sum, course) => sum + course.completedLessons, 0)
  const completionRate = enrolled.length > 0 ? Math.round((completedCourses / enrolled.length) * 100) : 0

  return (
    <div className="space-y-8">
      <DashboardHero
        eyebrow="Student Dashboard"
        title={`Welcome back, ${session!.user.name}.`}
        description="Track your courses, live classes, certificates, and learning momentum from one brighter dashboard built to keep you moving."
        illustrationPrompt="student learning dashboard illustration, young learner reviewing colorful charts, books, certificates and live class schedule on laptop, purple coral gold palette, modern clean vector hero for education website"
        illustrationAlt="Student dashboard illustration"
        illustrationSrc="/Students-cuate.svg"
      >
        <div className="flex flex-wrap gap-3">
          <Button asChild className="rounded-full px-5">
            <Link href="/student/courses">Continue Learning</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full px-5">
            <Link href="/student/certificates">View Certificates</Link>
          </Button>
          {session!.user.cohort ? (
            <Badge variant="secondary" className="rounded-full px-4 py-2 text-xs">
              Cohort: {session!.user.cohort}
            </Badge>
          ) : null}
        </div>
      </DashboardHero>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Enrolled Courses"
          value={enrolled.length}
          description="Courses currently in your learning path."
          icon={BookOpen}
          tone="violet"
        />
        <MetricCard
          title="Courses Completed"
          value={completedCourses}
          description={`${activeCourses} courses still in progress.`}
          icon={GraduationCap}
          tone="sky"
        />
        <MetricCard
          title="Certificates"
          value={certificates}
          description="Achievements unlocked from passed exams."
          icon={Award}
          tone="amber"
        />
        <MetricCard
          title="Upcoming Classes"
          value={upcomingClasses.length}
          description="Live sessions coming up soon."
          icon={CalendarDays}
          tone="rose"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <SimpleBarChart
          title="Learning Progress"
          description="Completed lessons across your enrolled courses."
          data={enrolled.map((course, index) => ({
            label: course.title,
            value: course.completedLessons,
            note: course.examPassed
              ? "Exam passed"
              : course.certificateIssued
                ? "Certificate issued"
                : "Progress in motion",
            color: [
              "linear-gradient(90deg,#7b5cff,#9c8bff)",
              "linear-gradient(90deg,#fb7185,#fdba74)",
              "linear-gradient(90deg,#38bdf8,#60a5fa)",
              "linear-gradient(90deg,#f59e0b,#facc15)",
              "linear-gradient(90deg,#22c55e,#84cc16)",
            ][index % 5],
          }))}
          emptyText="Enroll in a course to start building progress."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <ActivityRing
            title="Completion Rate"
            description="Share of your enrolled courses already completed."
            value={completionRate}
          />
          <HighlightList
            title="Learning Snapshot"
            items={[
              { label: "Lessons completed", value: `${totalLessonsCompleted}`, tone: "rgba(123,92,255,0.12)" },
              { label: "Available new courses", value: `${available.length}`, tone: "rgba(251,113,133,0.14)" },
              { label: "Upcoming live classes", value: `${upcomingClasses.length}`, tone: "rgba(56,189,248,0.14)" },
              { label: "Certificates earned", value: `${certificates}`, tone: "rgba(245,158,11,0.16)" },
            ]}
          />
        </div>
      </div>

      {/* Live Classes */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-heading text-2xl font-semibold">
            <Video className="h-5 w-5 text-primary" />
            Upcoming Live Classes
          </h2>
        </div>

        {upcomingClasses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingClasses.map((lc) => (
                <Card
                  key={lc._id.toString()}
                  className="border-primary/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(247,244,255,0.95))]"
                >
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start gap-2">
                      <CardTitle className="text-base line-clamp-1">{lc.title}</CardTitle>
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                        Live
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-2 h-10">
                      {lc.description}
                    </p>
                    <div className="text-xs space-y-1">
                      <p className="font-medium text-primary">
                        Starts: {new Date(lc.startTime).toLocaleString()}
                      </p>
                    </div>
                    <Button asChild className="w-full gap-2 rounded-full" size="sm">
                      <a href={lc.meetLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        Join Class
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              ))}
          </div>
        ) : (
          <Card className="border-primary/10 bg-[linear-gradient(135deg,rgba(255,195,0,0.12),rgba(255,99,132,0.1),rgba(123,92,255,0.08))]">
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              <Sparkles className="mx-auto mb-3 h-8 w-8 text-primary/60" />
              <p>No live classes scheduled at the moment.</p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Enrolled courses */}
      <section className="space-y-4">
        <h2 className="font-heading text-2xl font-semibold">My Courses</h2>
        {enrolled.length === 0 ? (
          <Card className="border-primary/10">
            <CardContent className="py-12 text-center text-muted-foreground">
              <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>You haven&apos;t enrolled in any courses yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {enrolled.map((c) => <LearningCourseCard key={c.courseId} course={c} />)}
          </div>
        )}
      </section>

      {/* Available courses */}
      {available.length > 0 && (
        <section id="available" className="space-y-4 scroll-mt-4">
          <div>
            <h2 className="font-heading text-2xl font-semibold">Available Courses</h2>
            <p className="text-sm text-muted-foreground">Click a course to see what&apos;s inside before you enroll.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {available.map((c) => <CatalogCourseCard key={c.id} course={c} />)}
          </div>
        </section>
      )}
    </div>
  )
}
