import Image from "next/image"
import Link from "next/link"
import { Award, BookOpen, PlayCircle, UserRound } from "lucide-react"
import { EnrollCourseButton } from "@/components/student/EnrollCourseButton"
import { cn } from "@/lib/utils"

export function CourseCover({
  url, title, className, sizes = "(max-width: 768px) 100vw, 400px",
}: {
  url: string | null
  title: string
  className?: string
  sizes?: string
}) {
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {url ? (
        <Image src={url} alt={title} fill sizes={sizes} className="object-cover transition-transform duration-500 group-hover:scale-105" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/25 via-primary/10 to-amber-200/40">
          <BookOpen className="h-10 w-10 text-primary/50" />
        </div>
      )}
    </div>
  )
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${value}%` }} />
    </div>
  )
}

export function ProgressRing({ value, size = 96, stroke = 8, label }: { value: number; size?: number; stroke?: number; label?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (value / 100) * c}
          className="stroke-primary transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold leading-none">{value}%</span>
        {label && <span className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>}
      </div>
    </div>
  )
}

/** "My learning" card for an enrolled course: cover, instructor and progress. */
export function LearningCourseCard({
  course,
}: {
  course: {
    courseId: string
    title: string
    coverImageUrl: string | null
    teacherName: string
    progressPercent: number
    completedLessons: number
    totalLessons: number
    examPassed: boolean
    certificateIssued: boolean
  }
}) {
  const notStarted = course.completedLessons === 0 && !course.examPassed
  return (
    <Link
      href={`/student/courses/${course.courseId}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-lg"
    >
      <div className="relative">
        <CourseCover url={course.coverImageUrl} title={course.title} className="aspect-video" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
          <PlayCircle className="h-12 w-12 text-white opacity-0 drop-shadow-lg transition-opacity group-hover:opacity-100" />
        </div>
        {course.certificateIssued && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-semibold text-amber-950 shadow">
            <Award className="h-3 w-3" />Certified
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="line-clamp-2 font-semibold leading-snug">{course.title}</h3>
        <p className="text-xs text-muted-foreground">{course.teacherName}</p>
        <div className="mt-auto pt-3 space-y-1.5">
          <ProgressBar value={course.progressPercent} />
          <div className="flex items-center justify-between text-xs">
            {notStarted ? (
              <span className="font-semibold uppercase tracking-wide text-primary">Start course</span>
            ) : course.examPassed ? (
              <span className="font-semibold text-primary">Completed</span>
            ) : (
              <span className="text-muted-foreground">{course.progressPercent}% complete</span>
            )}
            {course.totalLessons > 0 && (
              <span className="text-muted-foreground">{course.completedLessons}/{course.totalLessons} lessons</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

/** Catalogue card for a course the student hasn't enrolled in yet. */
export function CatalogCourseCard({
  course,
}: {
  course: {
    id: string
    title: string
    description: string
    coverImageUrl: string | null
    teacherName: string
    lessonCount: number
    isPaid: boolean
    price: number
  }
}) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-lg">
      <Link href={`/student/courses/${course.id}`} className="flex flex-1 flex-col">
        <CourseCover url={course.coverImageUrl} title={course.title} className="aspect-video" />
        <div className="flex flex-1 flex-col gap-1.5 p-4 pb-2">
          <h3 className="line-clamp-2 font-semibold leading-snug group-hover:text-primary transition-colors">{course.title}</h3>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <UserRound className="h-3 w-3" />{course.teacherName}
          </p>
          <p className="line-clamp-2 text-xs text-muted-foreground">{course.description}</p>
          <div className="mt-auto flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">{course.lessonCount} lesson{course.lessonCount !== 1 ? "s" : ""}</span>
            <span className="text-base font-bold">{course.isPaid ? `₦${course.price.toLocaleString()}` : "Free"}</span>
          </div>
        </div>
      </Link>
      <div className="flex gap-2 p-4 pt-2">
        <Link
          href={`/student/courses/${course.id}`}
          className="inline-flex flex-1 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors hover:bg-muted h-9"
        >
          Preview
        </Link>
        <div className="flex-1">
          <EnrollCourseButton courseId={course.id} isPaid={course.isPaid} price={course.price} label={course.isPaid ? "Buy now" : "Enroll"} />
        </div>
      </div>
    </div>
  )
}
