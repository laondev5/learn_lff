import { auth } from "@/auth"
import { connectDB } from "@/lib/mongoose"
import Course from "@/models/Course.model"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen, Eye, EyeOff, Video, ExternalLink } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CreateLiveClassDialog } from "@/components/teacher/CreateLiveClassDialog"
import { getLiveClasses } from "@/actions/live-class.actions"

async function getTeacherStats(teacherId: string) {
  await connectDB()
  const [total, published, liveClasses] = await Promise.all([
    Course.countDocuments({ teacher: teacherId }),
    Course.countDocuments({ teacher: teacherId, isPublished: true }),
    getLiveClasses("teacher", teacherId),
  ])
  return { total, published, drafts: total - published, liveClasses }
}

export default async function TeacherDashboardPage() {
  const session = await auth()
  const { total, published, drafts, liveClasses } = await getTeacherStats(session!.user.id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Welcome back, {session!.user.name}
          </p>
        </div>
        <CreateLiveClassDialog>
          <Button variant="outline" className="gap-2">
            <Video className="h-4 w-4" />
            Schedule Live Class
          </Button>
        </CreateLiveClassDialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Published</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{published}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Drafts</CardTitle>
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{drafts}</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Video className="h-5 w-5" />
            Live Classes
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/teacher/live-classes">View All</Link>
          </Button>
        </div>

        {liveClasses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveClasses.slice(0, 3).map((lc) => (
              <Card key={lc._id.toString()}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-base line-clamp-1">{lc.title}</CardTitle>
                    <span className="text-xs px-2 py-0.5 border rounded-full">
                      {new Date(lc.startTime) > new Date() ? "Upcoming" : "Past"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-2 h-10">
                    {lc.description}
                  </p>
                  <div className="text-xs space-y-1">
                    <p className="font-medium">
                      Start: {new Date(lc.startTime).toLocaleString()}
                    </p>
                    <p className="text-muted-foreground">
                      End: {new Date(lc.endTime).toLocaleString()}
                    </p>
                  </div>
                  <Button asChild className="w-full gap-2" variant="secondary" size="sm">
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
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <Video className="h-10 w-10 text-muted-foreground/50 mb-4" />
              <p className="text-sm text-muted-foreground">No live classes scheduled yet.</p>
              <CreateLiveClassDialog>
                <Button variant="link" size="sm">Schedule your first class</Button>
              </CreateLiveClassDialog>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Button asChild>
          <Link href="/teacher/courses">Manage Courses</Link>
        </Button>
      </div>
    </div>
  )
}
