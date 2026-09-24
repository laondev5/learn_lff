import Image from "next/image"
import Link from "next/link"
import {
  Award, BookOpen, Check, ChevronRight, CircleDashed, ClipboardCheck, Clock, FileText,
  GraduationCap, Infinity as InfinityIcon, Lock, MessageCircle, PlayCircle, Trophy, Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { CourseCurriculum, type CurriculumSection } from "@/components/student/CourseCurriculum"
import { CourseCover, ProgressBar, ProgressRing } from "@/components/student/CourseCards"
import { EnrollCourseButton } from "@/components/student/EnrollCourseButton"
import { SectionTabs } from "@/components/shared/SectionTabs"
import { cn } from "@/lib/utils"

const HERO_BLEED = "-mx-4 -mt-4 md:-mx-6 md:-mt-6 lg:-mx-8 lg:-mt-8"

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")
}

function InstructorAvatar({ name, url, size = 48 }: { name: string; url: string | null; size?: number }) {
  return (
    <div className="relative shrink-0 overflow-hidden rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold" style={{ width: size, height: size, fontSize: size / 2.6 }}>
      {url ? <Image src={url} alt={name} fill sizes={`${size}px`} className="object-cover" /> : initials(name)}
    </div>
  )
}

// ─── Preview (not enrolled) ───────────────────────────────────────────────────

export interface CoursePreviewData {
  id: string
  title: string
  description: string
  coverImageUrl: string | null
  isPaid: boolean
  price: number
  updatedAt: string
  instructor: { name: string; avatarUrl: string | null }
  studentCount: number
  isEnrolled: boolean
  hasExam: boolean
  stats: { modules: number; lessons: number; videoLessons: number; textLessons: number; tests: number }
  modules: CurriculumSection[]
}

export function CoursePreviewView({ course }: { course: CoursePreviewData }) {
  const updated = new Date(course.updatedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })

  const includes = [
    { icon: BookOpen, text: `${course.stats.lessons} lesson${course.stats.lessons !== 1 ? "s" : ""} in ${course.stats.modules} section${course.stats.modules !== 1 ? "s" : ""}` },
    course.stats.videoLessons > 0 && { icon: PlayCircle, text: `${course.stats.videoLessons} video lesson${course.stats.videoLessons !== 1 ? "s" : ""}` },
    course.stats.textLessons > 0 && { icon: FileText, text: `${course.stats.textLessons} reading lesson${course.stats.textLessons !== 1 ? "s" : ""}` },
    course.stats.tests > 0 && { icon: ClipboardCheck, text: `${course.stats.tests} lesson quiz${course.stats.tests !== 1 ? "zes" : ""}` },
    course.hasExam && { icon: GraduationCap, text: "Final exam" },
    course.hasExam && { icon: Trophy, text: "Certificate of completion" },
    { icon: MessageCircle, text: "Q&A with the instructor" },
    { icon: InfinityIcon, text: "Learn at your own pace" },
  ].filter(Boolean) as { icon: typeof BookOpen; text: string }[]

  const enrollCard = (
    <div className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xl">
      <CourseCover url={course.coverImageUrl} title={course.title} className="aspect-video" sizes="340px" />
      <div className="space-y-4 p-5">
        <p className="text-3xl font-extrabold">{course.isPaid ? `₦${course.price.toLocaleString()}` : "Free"}</p>
        {course.isEnrolled ? (
          <Button asChild size="lg" className="w-full">
            <Link href={`/student/courses/${course.id}`}>Go to course</Link>
          </Button>
        ) : (
          <EnrollCourseButton
            courseId={course.id}
            isPaid={course.isPaid}
            price={course.price}
            size="lg"
            label={course.isPaid ? "Buy this course" : "Enroll now, it's free"}
            className="h-12 text-base font-bold"
          />
        )}
        <div>
          <p className="mb-2 text-sm font-bold">This course includes:</p>
          <ul className="space-y-2 text-sm">
            {includes.map((item) => (
              <li key={item.text} className="flex items-center gap-2.5">
                <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )

  return (
    <div className="pb-12">
      {/* Dark hero band */}
      <section className={cn(HERO_BLEED, "bg-gray-900 text-white")}>
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:px-6 lg:grid-cols-[1fr_340px] lg:px-8 lg:py-12">
          <div className="space-y-4 min-w-0">
            <nav className="flex items-center gap-1.5 text-sm font-semibold text-primary-foreground/80">
              <Link href="/student/dashboard" className="text-amber-300 hover:underline">Courses</Link>
              <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
              <span className="truncate text-amber-300">{course.title}</span>
            </nav>
            <div className="lg:hidden overflow-hidden rounded-lg">
              <CourseCover url={course.coverImageUrl} title={course.title} className="aspect-video" />
            </div>
            <h1 className="text-3xl font-extrabold leading-tight lg:text-4xl">{course.title}</h1>
            <p className="line-clamp-3 text-base text-gray-200 lg:text-lg">{course.description}</p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-200">
              {!course.isPaid && (
                <span className="rounded bg-emerald-300 px-2 py-0.5 text-xs font-bold text-emerald-950">Free</span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" />{course.studentCount.toLocaleString()} student{course.studentCount !== 1 ? "s" : ""}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" />Last updated {updated}
              </span>
            </div>
            <p className="text-sm">
              Created by <span className="font-semibold text-amber-300 underline underline-offset-2">{course.instructor.name}</span>
            </p>
          </div>
          {/* Desktop: card overlaps the hero, like Udemy */}
          <div className="relative hidden lg:block">
            <div className="absolute inset-x-0 top-0 z-10">{enrollCard}</div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-10 pt-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-10">
          <div className="lg:hidden">{enrollCard}</div>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">Course content</h2>
            <CourseCurriculum sections={course.modules} courseId={course.id} mode="preview" />
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold">Description</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{course.description}</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">Instructor</h2>
            <div className="flex items-center gap-4">
              <InstructorAvatar name={course.instructor.name} url={course.instructor.avatarUrl} size={72} />
              <div>
                <p className="text-lg font-bold text-primary">{course.instructor.name}</p>
                <p className="text-sm text-muted-foreground">Living Faith Foundation instructor</p>
                <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />{course.studentCount.toLocaleString()} students on this course
                </p>
              </div>
            </div>
          </section>
        </div>
        {/* Spacer column so content doesn't run under the overlapping card */}
        <div className="hidden lg:block" />
      </div>
    </div>
  )
}

// ─── Learning view (enrolled) ─────────────────────────────────────────────────

export interface CourseLearningData {
  id: string
  title: string
  description: string
  coverImageUrl: string | null
  instructor: { name: string; avatarUrl: string | null }
  enrolledAt: string
  nextLesson: { id: string; title: string; moduleTitle: string } | null
  modules: (CurriculumSection & { isCompleted: boolean })[]
  hasExam: boolean
  examPassed: boolean
  certificateIssued: boolean
  allModulesComplete: boolean
  totalLessons: number
  completedLessonsCount: number
}

export function CourseLearningView({
  course,
  qa,
  questionCount,
}: {
  course: CourseLearningData
  qa: React.ReactNode
  questionCount: number
}) {
  const progress = course.examPassed
    ? 100
    : course.totalLessons > 0
      ? Math.round((course.completedLessonsCount / course.totalLessons) * 100)
      : 0
  const allLessonsDone = course.totalLessons > 0 && course.completedLessonsCount >= course.totalLessons
  const sectionsDone = course.modules.filter((m) => m.isCompleted).length
  const firstLessonId = course.modules.find((m) => m.lessons.length > 0)?.lessons[0]?.id

  // Primary action (same rules as before, now surfaced as the "continue" card)
  let action: { href: string | null; label: string; icon: typeof PlayCircle }
  if (course.totalLessons === 0) action = { href: null, label: "Coming soon", icon: Clock }
  else if (course.examPassed) action = { href: "/student/certificates", label: "View certificate", icon: Award }
  else if (course.allModulesComplete && course.hasExam) action = { href: `/student/courses/${course.id}/exam`, label: "Take final exam", icon: GraduationCap }
  else if (allLessonsDone) action = { href: firstLessonId ? `/student/courses/${course.id}/lessons/${firstLessonId}` : null, label: "Review course", icon: BookOpen }
  else action = {
    href: course.nextLesson ? `/student/courses/${course.id}/lessons/${course.nextLesson.id}` : null,
    label: course.completedLessonsCount === 0 ? "Start course" : "Continue learning",
    icon: PlayCircle,
  }
  const ActionIcon = action.icon

  const milestones = [
    { label: "Start the course", done: course.completedLessonsCount > 0 },
    { label: "Complete all lessons", done: allLessonsDone },
    ...(course.hasExam
      ? [
          { label: "Pass the final exam", done: course.examPassed },
          { label: "Earn your certificate", done: course.certificateIssued },
        ]
      : []),
  ]

  return (
    <div className="pb-12">
      {/* Dark hero band */}
      <section className={cn(HERO_BLEED, "bg-gray-900 text-white")}>
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:flex-row md:items-center md:px-6 lg:px-8">
          <div className="min-w-0 flex-1 space-y-3">
            <nav className="flex items-center gap-1.5 text-sm font-semibold">
              <Link href="/student/courses" className="text-amber-300 hover:underline">My learning</Link>
              <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
              <span className="truncate text-amber-300">{course.title}</span>
            </nav>
            <h1 className="text-2xl font-extrabold leading-tight md:text-3xl">{course.title}</h1>
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <InstructorAvatar name={course.instructor.name} url={course.instructor.avatarUrl} size={24} />
              {course.instructor.name}
            </div>
            <div className="max-w-md space-y-1.5 pt-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-amber-400 transition-all duration-700" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-sm text-gray-300">
                <span className="font-semibold text-white">{progress}% complete</span> · {course.completedLessonsCount} of {course.totalLessons} lessons
              </p>
            </div>
          </div>
          {course.examPassed && (
            <div className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3">
              <Trophy className="h-8 w-8 text-amber-300" />
              <div>
                <p className="font-bold">Course completed!</p>
                <p className="text-xs text-gray-300">Well done. Your certificate is ready.</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 pt-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-10">
          {/* Continue card */}
          <div className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm sm:flex-row">
            <CourseCover url={course.coverImageUrl} title={course.title} className="aspect-video sm:aspect-auto sm:w-56 shrink-0" sizes="224px" />
            <div className="flex flex-1 flex-col justify-center gap-3 p-5">
              {course.nextLesson && !allLessonsDone ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                    {course.completedLessonsCount === 0 ? "Start here" : "Up next"} · {course.nextLesson.moduleTitle}
                  </p>
                  <p className="mt-1 text-lg font-bold leading-snug">{course.nextLesson.title}</p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                    {course.totalLessons === 0 ? "Content coming soon" : course.examPassed ? "All done" : "All lessons complete"}
                  </p>
                  <p className="mt-1 text-lg font-bold leading-snug">
                    {course.totalLessons === 0
                      ? "Your instructor is still adding lessons."
                      : course.examPassed
                        ? "You've completed this course."
                        : course.hasExam
                          ? "You're ready for the final exam."
                          : "Revisit any lesson below."}
                  </p>
                </div>
              )}
              <div>
                {action.href ? (
                  <Button asChild size="lg" className="font-semibold">
                    <Link href={action.href}><ActionIcon className="mr-2 h-5 w-5" />{action.label}</Link>
                  </Button>
                ) : (
                  <Button size="lg" disabled><ActionIcon className="mr-2 h-5 w-5" />{action.label}</Button>
                )}
              </div>
            </div>
          </div>

          <SectionTabs
            tabs={[
              {
                key: "content",
                label: "Course content",
                icon: <BookOpen className="h-4 w-4" />,
                content: (
                  <div className="space-y-4">
                    <CourseCurriculum
                      sections={course.modules}
                      courseId={course.id}
                      mode="learning"
                      nextLessonId={course.nextLesson?.id ?? null}
                    />

                    {course.hasExam && (
                      <div className={cn(
                        "flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center",
                        course.allModulesComplete && !course.examPassed ? "border-primary/40 bg-primary/5" : "bg-muted/30"
                      )}>
                        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", course.examPassed ? "bg-emerald-500/15 text-emerald-600" : "bg-primary/10 text-primary")}>
                          {course.examPassed ? <Check className="h-6 w-6" /> : course.allModulesComplete ? <GraduationCap className="h-6 w-6" /> : <Lock className="h-6 w-6 text-muted-foreground" />}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold">Final Certification Exam</p>
                          <p className="text-sm text-muted-foreground">
                            {course.examPassed
                              ? "Passed. Your certificate has been issued."
                              : course.allModulesComplete
                                ? "Test your knowledge and earn your official certificate of completion."
                                : "Unlocks once you complete every section."}
                          </p>
                        </div>
                        {course.allModulesComplete && !course.examPassed && (
                          <Button asChild className="font-semibold">
                            <Link href={`/student/courses/${course.id}/exam`}>Take exam<ChevronRight className="ml-1.5 h-4 w-4" /></Link>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ),
              },
              { key: "qa", label: "Q&A", icon: <MessageCircle className="h-4 w-4" />, count: questionCount, content: qa },
              {
                key: "about",
                label: "About",
                icon: <FileText className="h-4 w-4" />,
                content: (
                  <div className="space-y-6">
                    <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{course.description}</p>
                    <div className="flex items-center gap-4 rounded-xl border p-4">
                      <InstructorAvatar name={course.instructor.name} url={course.instructor.avatarUrl} size={56} />
                      <div>
                        <p className="text-xs text-muted-foreground">Instructor</p>
                        <p className="font-bold">{course.instructor.name}</p>
                      </div>
                    </div>
                  </div>
                ),
              },
            ]}
          />
        </div>

        {/* Progress sidebar */}
        <aside className="lg:order-none -order-1">
          <div className="space-y-4 lg:sticky lg:top-4">
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <p className="text-sm font-bold">Your progress</p>
              <div className="mt-4 flex items-center gap-5">
                <ProgressRing value={progress} label="done" />
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Lessons</dt>
                    <dd className="font-semibold">{course.completedLessonsCount} / {course.totalLessons}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Sections</dt>
                    <dd className="font-semibold">{sectionsDone} / {course.modules.length}</dd>
                  </div>
                </dl>
              </div>
              <ProgressBar value={progress} className="mt-4 lg:hidden" />
              <ul className="mt-5 space-y-2.5 border-t pt-4 text-sm">
                {milestones.map((m) => (
                  <li key={m.label} className="flex items-center gap-2.5">
                    {m.done ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    ) : (
                      <CircleDashed className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className={cn(!m.done && "text-muted-foreground")}>{m.label}</span>
                  </li>
                ))}
              </ul>
              {course.certificateIssued && (
                <Button asChild variant="outline" className="mt-4 w-full">
                  <Link href="/student/certificates"><Award className="mr-2 h-4 w-4" />View certificate</Link>
                </Button>
              )}
            </div>
            <p className="px-1 text-xs text-muted-foreground">
              Enrolled {new Date(course.enrolledAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
