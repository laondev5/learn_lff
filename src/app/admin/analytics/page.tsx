import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ActivityRing,
  DashboardHero,
  HighlightList,
  MetricCard,
  SimpleBarChart,
} from "@/components/shared/dashboard-kit"
import { getAdminDashboardData } from "@/lib/admin-dashboard"
import { Award, BookOpen, GraduationCap, Users } from "lucide-react"

export default async function AdminAnalyticsPage() {
  const data = await getAdminDashboardData()

  return (
    <div className="space-y-8">
      <DashboardHero
        eyebrow="Platform Analytics"
        title="Deep analytics for admin decisions."
        description="Explore growth, learner outcomes, and the courses leading the platform. This view turns the dashboard snapshot into something you can act on."
        illustrationPrompt="premium analytics illustration for education SaaS, admin team presenting charts and KPI cards, purple orange blue palette, clean vector website style, modern dashboard scene"
        illustrationAlt="Admin analytics scene"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Students"
          value={data.totals.totalStudents}
          description="Active learner accounts"
          icon={Users}
          tone="violet"
        />
        <MetricCard
          title="Teachers"
          value={data.totals.totalTeachers}
          description="Instructors currently active"
          icon={GraduationCap}
          tone="sky"
        />
        <MetricCard
          title="Courses"
          value={data.totals.totalCourses}
          description={`${data.totals.publishedCourses} published and live.`}
          icon={BookOpen}
          tone="amber"
        />
        <MetricCard
          title="Certificates"
          value={data.totals.totalCertificates}
          description="Issued across all cohorts"
          icon={Award}
          tone="rose"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <SimpleBarChart
          title="Six-Month Enrollment Trend"
          description="A month-by-month read of new enrollments."
          data={data.monthlyTrend}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <ActivityRing
            title="Exam Success Rate"
            description="Platform-wide completion against enrollments."
            value={data.totals.passRate}
          />
          <HighlightList
            title="Key Ratios"
            items={[
              { label: "Certificate conversion", value: `${data.totals.certificateRate}%`, tone: "rgba(245,158,11,0.14)" },
              { label: "Draft courses", value: `${data.totals.draftCourses}`, tone: "rgba(59,130,246,0.12)" },
              { label: "Exam passes", value: `${data.totals.examPassed}`, tone: "rgba(123,92,255,0.12)" },
              { label: "Enrollments", value: `${data.totals.totalEnrollments}`, tone: "rgba(244,114,182,0.14)" },
            ]}
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <SimpleBarChart
          title="Account Distribution"
          description="Role mix across the active platform."
          data={data.distribution}
        />

        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle className="font-heading text-xl">Top Courses by Reach</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.topCourses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No course performance data available yet.</p>
            ) : (
              data.topCourses.map((course) => {
                const passRate = course.enrolled > 0 ? Math.round((course.passed / course.enrolled) * 100) : 0

                return (
                  <div key={course.courseId} className="rounded-2xl border border-primary/10 bg-muted/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{course.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {course.enrolled} enrolled • {course.passed} passed • {course.certificates} certificates
                        </p>
                      </div>
                      <Badge variant={course.isPublished ? "default" : "secondary"}>
                        {course.isPublished ? "Published" : "Draft"}
                      </Badge>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#7b5cff,#ff9a62)]"
                        style={{ width: `${passRate}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{passRate}% pass rate</p>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
