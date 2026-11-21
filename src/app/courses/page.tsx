import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, BookOpen, CalendarClock, CheckCircle2, Clock3 } from "lucide-react"
import { getPublicCourses } from "@/lib/public-courses"
import { CourseCover } from "@/components/student/CourseCards"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Courses | Living Faith Foundation Learning Portal" }

function lagosDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric" }) : "—"
}

export default async function PublicCoursesPage() {
  const courses = await getPublicCourses()

  return (
    <main className="min-h-screen bg-background">
      <div className="bg-gray-900 px-5 py-14 text-white md:py-20">
        <div className="mx-auto max-w-6xl space-y-3">
          <Link href="/" className="text-sm text-gray-300 hover:text-white">← Back to home</Link>
          <h1 className="text-4xl font-extrabold">Our Courses</h1>
          <p className="max-w-2xl text-gray-300">
            Structured teaching in the foundations of the faith, the life of the church family and ministry.
            Browse a course below, then apply for the next cohort.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-8 px-5 py-12">
        {courses.length === 0 ? (
          <Card>
            <CardContent className="py-14 text-center text-muted-foreground">
              <BookOpen className="mx-auto mb-3 h-10 w-10 opacity-40" />
              No courses are published yet. Please check back soon.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Card key={course.id} className="group overflow-hidden">
                <Link href={`/courses/${course.id}`}>
                  <CourseCover url={course.coverImageUrl} title={course.title} className="h-44 w-full" />
                </Link>
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={course.status === "open" ? "default" : "secondary"}>
                      {course.status === "open"
                        ? "Applications open"
                        : course.status === "started"
                          ? "Registration closed"
                          : "Cohort coming soon"}
                    </Badge>
                    {course.isPaid ? <Badge variant="outline">₦{course.price.toLocaleString()}</Badge> : <Badge variant="outline">Free</Badge>}
                  </div>
                  <CardTitle className="text-lg">
                    <Link href={`/courses/${course.id}`} className="hover:underline">{course.title}</Link>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{course.moduleCount} modules · {course.teacherName}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="line-clamp-3 text-sm text-muted-foreground">{course.description}</p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {course.status === "open" ? (
                      <><CalendarClock className="h-3.5 w-3.5" /> {course.cohortName} · starts {course.startDate} · apply by {lagosDate(course.registrationClosesAt)}</>
                    ) : course.status === "started" ? (
                      <><Clock3 className="h-3.5 w-3.5" /> {course.cohortName} registration closed {lagosDate(course.registrationClosesAt)} — wait for the next cohort</>
                    ) : (
                      <><Clock3 className="h-3.5 w-3.5" /> No cohort scheduled yet</>
                    )}
                  </div>
                  <Button asChild className="w-full">
                    <Link href={`/courses/${course.id}`}>
                      View course <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4" />
          Already have an account? <Link href="/auth/login" className="text-primary underline">Sign in</Link> to continue, or <Link href="/apply" className="text-primary underline">apply here</Link>.
        </div>
      </div>
    </main>
  )
}
