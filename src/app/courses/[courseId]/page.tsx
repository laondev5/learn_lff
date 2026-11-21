import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, BookOpen, CalendarClock, CheckCircle2, ClipboardList, Clock3, Video } from "lucide-react"
import { getPublicCourse } from "@/lib/public-courses"
import { CourseCover } from "@/components/student/CourseCards"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export const dynamic = "force-dynamic"

function lagosDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric" }) : "—"
}

export async function generateMetadata({ params }: { params: Promise<{ courseId: string }> }): Promise<Metadata> {
  const { courseId } = await params
  const course = await getPublicCourse(courseId)
  return { title: course ? `${course.title} | LFF Learning Portal` : "Course not found" }
}

export default async function PublicCourseDetailPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  const course = await getPublicCourse(courseId)
  if (!course) notFound()

  const canApply = course.status === "open" && course.scheduleId
  const applyHref = canApply ? `/apply?course=${course.id}&schedule=${course.scheduleId}` : "/apply"

  return (
    <main className="min-h-screen bg-background">
      <div className="bg-gray-900 px-5 py-8 text-white md:py-12">
        <div className="mx-auto max-w-5xl space-y-3">
          <Link href="/courses" className="inline-flex items-center gap-1 text-sm text-gray-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> All courses
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-8 px-5 py-10">
        <div className="grid gap-8 md:grid-cols-[260px_1fr]">
          <div className="space-y-4">
            <CourseCover url={course.coverImageUrl} title={course.title} className="aspect-video w-full rounded-lg" />
            <div className="flex flex-wrap gap-2">
              <Badge variant={course.isPaid ? "default" : "secondary"}>
                {course.isPaid ? `₦${course.price.toLocaleString()}` : "Free"}
              </Badge>
              <Badge variant="outline">{course.modules.length} modules</Badge>
            </div>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">{course.teacherName}</p>
              <h1 className="text-3xl font-extrabold">{course.title}</h1>
              <p className="whitespace-pre-line text-muted-foreground">{course.description}</p>
            </div>

            {course.status === "open" ? (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-5 space-y-3">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-5 w-5 text-primary" /> Applications are open
                </div>
                <p className="text-sm text-muted-foreground">
                  The <strong>{course.cohortName}</strong> cohort starts on <strong>{course.startDate}</strong> and ends {course.endDate}. Applications stay open until <strong>{lagosDate(course.registrationClosesAt)}</strong> — one week after the start date. Your pastor will be invited as your accountability partner and admission is confirmed when they accept.
                </p>
                <Button asChild><Link href={applyHref}>Apply for this cohort</Link></Button>
              </div>
            ) : course.status === "started" ? (
              <div className="rounded-lg border border-amber-400/40 bg-amber-50 p-5 space-y-3">
                <div className="flex items-center gap-2 font-semibold text-amber-900">
                  <Clock3 className="h-5 w-5" /> Registration for this cohort is closed
                </div>
                <p className="text-sm text-amber-900/80">
                  The <strong>{course.cohortName}</strong> cohort began on <strong>{course.startDate}</strong>. Applications closed on <strong>{lagosDate(course.registrationClosesAt)}</strong>, one week after it started.
                  Please wait for the next cohort — applications will reopen here as soon as the next intake is scheduled.
                </p>
                <Button asChild variant="outline"><Link href="/apply">Notify me about the next cohort</Link></Button>
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/30 p-5 space-y-3">
                <div className="flex items-center gap-2 font-semibold">
                  <CalendarClock className="h-5 w-5" /> A new cohort is being prepared
                </div>
                <p className="text-sm text-muted-foreground">
                  No cohort is scheduled for this course yet. Check back soon or visit the application page for other open courses.
                </p>
                <Button asChild variant="outline"><Link href="/apply">See open cohorts</Link></Button>
              </div>
            )}
          </div>
        </div>

        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-xl font-bold"><BookOpen className="h-5 w-5 text-primary" /> What you will learn</h2>
          <div className="rounded-lg border">
            {course.modules.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{m.order}</span>
                  <span className="font-medium">{m.title}</span>
                </div>
                <span className="flex items-center gap-1 text-xs text-muted-foreground"><Video className="h-3.5 w-3.5" /> {m.lessonCount} lessons</span>
              </div>
            ))}
            {course.modules.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">Curriculum coming soon.</p>}
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ClipboardList className="h-3.5 w-3.5" /> Each module includes notes and a test to check your understanding.</p>
        </section>
      </div>
    </main>
  )
}
