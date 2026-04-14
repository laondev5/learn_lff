import { connectDB } from "@/lib/mongoose"
import User from "@/models/User.model"
import Course from "@/models/Course.model"
import StudentProgress from "@/models/StudentProgress.model"
import Certificate from "@/models/Certificate.model"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, BookOpen, GraduationCap, Award, TrendingUp, UserCheck } from "lucide-react"
import Link from "next/link"

async function getStats() {
  await connectDB()
  const [
    totalStudents, totalTeachers, totalAdmins,
    totalCourses, publishedCourses,
    totalEnrollments, examPassed, totalCertificates,
    recentCerts,
  ] = await Promise.all([
    User.countDocuments({ role: "student", isActive: true }),
    User.countDocuments({ role: "teacher", isActive: true }),
    User.countDocuments({ role: "admin", isActive: true }),
    Course.countDocuments(),
    Course.countDocuments({ isPublished: true }),
    StudentProgress.countDocuments(),
    StudentProgress.countDocuments({ examPassed: true }),
    Certificate.countDocuments(),
    Certificate.find().sort({ issuedAt: -1 }).limit(5)
      .populate("student", "name email")
      .populate("course", "title")
      .lean(),
  ])

  return {
    totalStudents, totalTeachers, totalAdmins,
    totalCourses, publishedCourses,
    totalEnrollments, examPassed, totalCertificates,
    passRate: totalEnrollments > 0 ? Math.round((examPassed / totalEnrollments) * 100) : 0,
    recentCerts: recentCerts.map((c) => {
      const student = c.student as unknown as { name: string; email: string }
      const course = c.course as unknown as { title: string }
      return {
        id: c._id.toString(),
        studentName: student?.name ?? "Unknown",
        studentEmail: student?.email ?? "",
        courseTitle: course?.title ?? "Unknown Course",
        issuedAt: c.issuedAt.toISOString(),
      }
    }),
  }
}

export default async function AdminDashboardPage() {
  const stats = await getStats()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of the LFF Learning Management System</p>
      </div>

      {/* User & Course Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalStudents}</div>
            <p className="text-xs text-muted-foreground mt-1">Active accounts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Teachers</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTeachers}</div>
            <p className="text-xs text-muted-foreground mt-1">Active accounts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Published Courses</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.publishedCourses}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.totalCourses} total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Certificates</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCertificates}</div>
            <p className="text-xs text-muted-foreground mt-1">Issued to date</p>
          </CardContent>
        </Card>
      </div>

      {/* Learning Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Enrollments</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEnrollments}</div>
            <p className="text-xs text-muted-foreground mt-1">Student–course pairs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exam Passes</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.examPassed}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all courses</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Pass Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.passRate}%</div>
            <div className="w-full h-1.5 bg-muted rounded-full mt-2">
              <div className="h-full bg-primary rounded-full" style={{ width: `${stats.passRate}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Certificates */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Certificates</h2>
          <Link href="/admin/users" className="text-sm text-primary hover:underline">Manage Users →</Link>
        </div>
        {stats.recentCerts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              No certificates issued yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {stats.recentCerts.map((c) => (
              <Card key={c.id}>
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
    </div>
  )
}
