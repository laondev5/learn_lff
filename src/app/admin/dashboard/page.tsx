import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ActivityRing,
  DashboardHero,
  HighlightList,
  MetricCard,
  SimpleBarChart,
} from "@/components/shared/dashboard-kit"
import { getAdminDashboardData } from "@/lib/admin-dashboard"
import {
  Award,
  BookOpen,
  ChartNoAxesCombined,
  GraduationCap,
  Settings,
  UserCheck,
  Users,
} from "lucide-react"
import Link from "next/link"

export default async function AdminDashboardPage() {
  const data = await getAdminDashboardData()

  return (
    <div className="space-y-8">
      <DashboardHero
        eyebrow="Admin Command Center"
        title="See the health of the entire learning platform at a glance."
        description="Track users, course growth, certificate issuance, and the learning outcomes that matter most. The dashboard now brings your analytics into the main workflow instead of hiding them."
        illustrationPrompt="modern SaaS admin dashboard illustration, diverse education operations team reviewing analytics on large monitor, purple yellow coral palette, clean flat vector style, premium website hero, bright soft lighting"
        illustrationAlt="Admin analytics illustration"
        illustrationSrc="/Admin-pana.svg"
      >
        <div className="flex flex-wrap gap-3">
          <Button asChild className="rounded-full px-5">
            <Link href="/admin/analytics">Open Analytics</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full px-5">
            <Link href="/admin/users">Manage Users</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full px-5">
            <Link href="/admin/settings">System Settings</Link>
          </Button>
        </div>
      </DashboardHero>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Active Students"
          value={data.totals.totalStudents}
          description="Learners currently active on the platform."
          icon={Users}
          tone="violet"
        />
        <MetricCard
          title="Teaching Team"
          value={data.totals.totalTeachers}
          description="Instructors available to publish and manage courses."
          icon={GraduationCap}
          tone="sky"
        />
        <MetricCard
          title="Published Courses"
          value={data.totals.publishedCourses}
          description={`${data.totals.draftCourses} drafts still in preparation.`}
          icon={BookOpen}
          tone="amber"
        />
        <MetricCard
          title="Certificates Issued"
          value={data.totals.totalCertificates}
          description="Verified completions generated across the LMS."
          icon={Award}
          tone="rose"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <SimpleBarChart
          title="Enrollment Trend"
          description="New enrollments over the last six months."
          data={data.monthlyTrend.map((item, index) => ({
            ...item,
            color: [
              "linear-gradient(90deg,#7b5cff,#9c8bff)",
              "linear-gradient(90deg,#5cb8ff,#6fd5ff)",
              "linear-gradient(90deg,#ffbd4a,#ffd56b)",
              "linear-gradient(90deg,#ff8ba7,#ff9b77)",
              "linear-gradient(90deg,#8b5cf6,#ec4899)",
              "linear-gradient(90deg,#22c55e,#84cc16)",
            ][index % 6],
          }))}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <ActivityRing
            title="Platform Pass Rate"
            description="Exam passes against all enrollments."
            value={data.totals.passRate}
          />
          <HighlightList
            title="Operational Snapshot"
            description="A quick read on the platform right now."
            items={[
              { label: "Total enrollments", value: `${data.totals.totalEnrollments}`, tone: "rgba(123,92,255,0.12)" },
              { label: "Exam passes", value: `${data.totals.examPassed}`, tone: "rgba(59,130,246,0.12)" },
              { label: "Certificate rate", value: `${data.totals.certificateRate}%`, tone: "rgba(245,158,11,0.14)" },
              { label: "Admin accounts", value: `${data.totals.totalAdmins}`, tone: "rgba(244,114,182,0.14)" },
            ]}
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.05fr]">
        <SimpleBarChart
          title="Account Distribution"
          description="How active roles are spread across the platform."
          data={data.distribution}
        />

        <Card className="border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-heading text-xl">Top Performing Courses</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Courses with the strongest enrollment pull.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link href="/admin/analytics">View All</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.topCourses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No course analytics yet.</p>
            ) : (
              data.topCourses.slice(0, 4).map((course) => {
                const passRate = course.enrolled > 0 ? Math.round((course.passed / course.enrolled) * 100) : 0

                return (
                  <div key={course.courseId} className="rounded-2xl border border-primary/10 bg-muted/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">{course.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {course.enrolled} enrolled • {course.certificates} certificates
                        </p>
                      </div>
                      <Badge variant={course.isPublished ? "default" : "secondary"}>
                        {course.isPublished ? "Published" : "Draft"}
                      </Badge>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#7b5cff,#ff7c98)]"
                        style={{ width: `${passRate}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{passRate}% exam pass rate</p>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-semibold">Recent Certificates</h2>
          <Link href="/admin/users" className="text-sm text-primary hover:underline">
            Manage Users →
          </Link>
        </div>
        {data.recentCerts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              No certificates issued yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {data.recentCerts.map((c) => (
              <Card key={c.id} className="border-primary/10">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-sm font-medium">{c.studentName}</p>
                      <p className="text-xs text-muted-foreground">{c.studentEmail}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-xs mb-1">{c.courseTitle}</Badge>
                      <p className="text-xs text-muted-foreground">
                        {new Date(c.issuedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading text-lg">
              <ChartNoAxesCombined className="h-5 w-5 text-primary" />
              Analytics Workspace
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Dive into course performance, growth signals, and platform outcomes.</p>
            <Button asChild variant="outline" className="w-full rounded-full">
              <Link href="/admin/analytics">Open Admin Analytics</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading text-lg">
              <UserCheck className="h-5 w-5 text-primary" />
              User Operations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Review accounts, roles, and activation status to keep onboarding smooth.</p>
            <Button asChild variant="outline" className="w-full rounded-full">
              <Link href="/admin/users">Review Users</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading text-lg">
              <Settings className="h-5 w-5 text-primary" />
              System Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Adjust platform-wide settings and keep the LMS configured for growth.</p>
            <Button asChild variant="outline" className="w-full rounded-full">
              <Link href="/admin/settings">Open Settings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
