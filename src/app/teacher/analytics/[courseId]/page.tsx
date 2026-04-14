import { getTeacherAnalytics } from "@/actions/announcement.actions"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, GraduationCap, Users, XCircle } from "lucide-react"
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/teacher/analytics" className="hover:underline">Analytics</Link>
            <span>/</span>
            <span className="truncate">{data.courseTitle}</span>
          </div>
          <h1 className="text-2xl font-bold truncate">{data.courseTitle}</h1>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/teacher/courses/${courseId}`}>View Course</Link>
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enrolled</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{data.totalEnrolled}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exam Passed</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{data.examPassed}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Certificates</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{data.certificatesIssued}</div></CardContent>
        </Card>
      </div>

      {/* Student table */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Students ({data.students.length})</h2>
        {data.students.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              No students enrolled yet.
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-md border">
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
