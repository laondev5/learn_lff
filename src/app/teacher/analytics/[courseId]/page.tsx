import { getTeacherAnalytics } from "@/actions/announcement.actions"
import {
  ActivityRing,
  DashboardHero,
  HighlightList,
  MetricCard,
  SimpleBarChart,
} from "@/components/shared/dashboard-kit"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2, GraduationCap, Medal, Users, XCircle } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function CourseAnalyticsPage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = await params
  const data = await getTeacherAnalytics(courseId)
  if (!data) notFound()
  const passRate =
    data.totalEnrolled > 0 ? Math.round((data.examPassed / data.totalEnrolled) * 100) : 0
  const certificateRate =
    data.totalEnrolled > 0
      ? Math.round((data.certificatesIssued / data.totalEnrolled) * 100)
      : 0
  const studentsWithScores = data.students.filter((student) => student.examScore !== null)
  const averageScore = studentsWithScores.length > 0
    ? Math.round(
        data.students.reduce((sum, student) => sum + (student.examScore ?? 0), 0) /
          studentsWithScores.length
      )
    : 0
  const topLearners = [...data.students]
    .sort((a, b) => b.completedLessons - a.completedLessons)
    .slice(0, 6)

  return (
    <div className="space-y-8">
      <DashboardHero
        eyebrow="Course Analytics"
        title={data.courseTitle}
        description="Review learner progress, exam performance, and certificate completion for this course in one place."
        illustrationPrompt="course analytics illustration, instructor reviewing top students and exam progress on colorful education dashboard, purple blue gold palette, clean vector website graphic"
        illustrationAlt="Course analytics illustration"
      >
        <div className="flex flex-wrap gap-3">
          <Button asChild className="rounded-full px-5">
            <Link href="/teacher/analytics">Back to Analytics</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full px-5">
            <Link href={`/teacher/courses/${courseId}`}>View Course</Link>
          </Button>
        </div>
      </DashboardHero>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Enrolled"
          value={data.totalEnrolled}
          description="Students currently enrolled in this course."
          icon={Users}
          tone="violet"
        />
        <MetricCard
          title="Exam Passed"
          value={data.examPassed}
          description="Students who have cleared the final exam."
          icon={GraduationCap}
          tone="sky"
        />
        <MetricCard
          title="Certificates"
          value={data.certificatesIssued}
          description="Certificates issued from this course."
          icon={Medal}
          tone="amber"
        />
        <MetricCard
          title="Average Score"
          value={studentsWithScores.length > 0 ? `${averageScore}%` : "N/A"}
          description="Average score for learners with exam results."
          icon={CheckCircle2}
          tone="emerald"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <SimpleBarChart
          title="Top Learner Progress"
          description="Students with the highest number of completed lessons."
          data={topLearners.map((student, index) => ({
            label: student.name,
            value: student.completedLessons,
            note: student.examPassed ? "Exam passed" : "Exam pending",
            color: [
              "linear-gradient(90deg,#7b5cff,#9c8bff)",
              "linear-gradient(90deg,#38bdf8,#60a5fa)",
              "linear-gradient(90deg,#f59e0b,#facc15)",
              "linear-gradient(90deg,#fb7185,#fdba74)",
              "linear-gradient(90deg,#22c55e,#84cc16)",
            ][index % 5],
          }))}
          emptyText="No learners are enrolled in this course yet."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <ActivityRing
            title="Pass Rate"
            description="Exam passes against total enrollments."
            value={passRate}
          />
          <HighlightList
            title="Course Snapshot"
            items={[
              { label: "Certificate rate", value: `${certificateRate}%`, tone: "rgba(251,146,60,0.16)" },
              { label: "Students with exam score", value: `${studentsWithScores.length}`, tone: "rgba(56,189,248,0.14)" },
              { label: "Students passed", value: `${data.examPassed}`, tone: "rgba(34,197,94,0.14)" },
              { label: "Exam pending", value: `${data.totalEnrolled - data.examPassed}`, tone: "rgba(123,92,255,0.12)" },
            ]}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/teacher/analytics" className="hover:underline">
            Analytics
          </Link>
          <span>/</span>
          <span className="truncate">{data.courseTitle}</span>
        </div>
        <h2 className="font-heading text-2xl font-semibold">Students ({data.students.length})</h2>
        {data.students.length === 0 ? (
          <Card className="border-primary/10">
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              No students enrolled yet.
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-primary/10 bg-white/90">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Student</th>
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Lessons</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Modules</th>
                  <th className="text-left px-4 py-3 font-medium">Exam</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Score</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Enrolled</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.students.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.email}</div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">{s.completedLessons}</td>
                    <td className="px-4 py-3 hidden md:table-cell">{s.completedModules}</td>
                    <td className="px-4 py-3">
                      {s.examPassed ? (
                        <Badge variant="default" className="gap-1 text-xs">
                          <CheckCircle2 className="h-3 w-3" />Passed
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <XCircle className="h-3 w-3" />Pending
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {s.examScore !== null ? `${s.examScore}%` : "—"}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                      {new Date(s.enrolledAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
