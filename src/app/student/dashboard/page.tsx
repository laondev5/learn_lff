import { auth } from "@/auth"
import { getEnrolledCourses, getAvailableCourses } from "@/actions/student.actions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BookOpen, Award, ChevronRight, Video, ExternalLink } from "lucide-react"
import Link from "next/link"
import { EnrollCourseButton } from "@/components/student/EnrollCourseButton"
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">My Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Welcome back, {session!.user.name}
          {session!.user.cohort && (
            <span className="ml-2 text-xs">· {session!.user.cohort}</span>
          )}
        </p>
      </div>

      {/* Live Classes */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            Upcoming Live Classes
          </h2>
        </div>

        {liveClasses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveClasses
              .filter((lc) => new Date(lc.startTime) > oneHourAgo) // Show current and future classes
              .slice(0, 3)
              .map((lc) => (
                <Card key={lc._id.toString()} className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start gap-2">
                      <CardTitle className="text-base line-clamp-1">{lc.title}</CardTitle>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-primary text-primary-foreground rounded-full">
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
                    <Button asChild className="w-full gap-2" size="sm">
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
          <Card className="bg-muted/30">
            <CardContent className="py-6 text-center text-muted-foreground text-sm">
              <p>No live classes scheduled at the moment.</p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Enrolled courses */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">My Courses</h2>
        {enrolled.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>You haven&apos;t enrolled in any courses yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {enrolled.map((c) => (
              <Card key={c.courseId} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">{c.title}</CardTitle>
                    {c.certificateIssued && (
                      <Award className="h-4 w-4 text-yellow-500 shrink-0" />
                    )}
                  </div>
                  <CardDescription className="line-clamp-2">{c.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto space-y-3">
                  <div className="flex items-center gap-2">
                    {c.examPassed ? (
                      <Badge variant="default">Completed</Badge>
                    ) : (
                      <Badge variant="secondary">{c.completedLessons} lessons done</Badge>
                    )}
                  </div>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/student/courses/${c.courseId}`}>
                      Continue <ChevronRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Available courses */}
      {available.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Available Courses</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {available.map((c) => (
              <Card key={c.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{c.title}</CardTitle>
                  <CardDescription className="line-clamp-2">{c.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <EnrollCourseButton courseId={c.id} />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
