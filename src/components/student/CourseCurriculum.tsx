"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, ChevronDown, ClipboardCheck, FileText, Lock, PlayCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CurriculumLesson {
  id: string
  title: string
  lessonType: "video" | "text"
  hasTest: boolean
  isCompleted?: boolean
  locked?: boolean
}

export interface CurriculumSection {
  id: string
  title: string
  lessons: CurriculumLesson[]
}

/**
 * Udemy-style "Course content" accordion.
 *  - preview:  catalogue view, lesson titles only (no links)
 *  - learning: enrolled course overview with completion state and links
 *  - sidebar:  compact list next to the lesson player
 */
export function CourseCurriculum({
  sections,
  courseId,
  mode,
  currentLessonId,
  nextLessonId,
}: {
  sections: CurriculumSection[]
  courseId: string
  mode: "preview" | "learning" | "sidebar"
  currentLessonId?: string
  nextLessonId?: string | null
}) {
  const initiallyOpen = () => {
    const focusId = currentLessonId ?? nextLessonId
    const focusSection = sections.find((s) => s.lessons.some((l) => l.id === focusId))
    if (focusSection) return new Set([focusSection.id])
    return new Set(sections.slice(0, 1).map((s) => s.id))
  }
  const [open, setOpen] = useState<Set<string>>(initiallyOpen)
  const totalLessons = sections.reduce((n, s) => n + s.lessons.length, 0)
  const allOpen = open.size === sections.length
  const compact = mode === "sidebar"

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (sections.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        The instructor is still adding content. Check back soon.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">
            {sections.length} section{sections.length !== 1 ? "s" : ""} · {totalLessons} lesson{totalLessons !== 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={() => setOpen(allOpen ? new Set() : new Set(sections.map((s) => s.id)))}
            className="font-semibold text-primary hover:underline"
          >
            {allOpen ? "Collapse all sections" : "Expand all sections"}
          </button>
        </div>
      )}

      <div className={cn("overflow-hidden border", compact ? "rounded-none border-0" : "rounded-xl")}>
        {sections.map((section, sIdx) => {
          const isOpen = open.has(section.id)
          const done = section.lessons.filter((l) => l.isCompleted).length
          const showProgress = mode !== "preview"
          return (
            <div key={section.id} className={cn(sIdx > 0 && "border-t")}>
              <button
                type="button"
                onClick={() => toggle(section.id)}
                aria-expanded={isOpen}
                className={cn(
                  "flex w-full items-start gap-3 bg-muted/50 text-left transition-colors hover:bg-muted",
                  compact ? "px-4 py-3" : "px-5 py-4"
                )}
              >
                <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 transition-transform duration-200", isOpen && "rotate-180")} />
                <div className="min-w-0 flex-1">
                  <p className={cn("font-semibold leading-snug", compact ? "text-sm" : "text-base")}>
                    Section {sIdx + 1}: {section.title}
                  </p>
                  {compact && showProgress && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {done} / {section.lessons.length}
                    </p>
                  )}
                </div>
                {!compact && (
                  <span className="shrink-0 text-xs text-muted-foreground pt-1">
                    {showProgress ? `${done} / ${section.lessons.length} lessons` : `${section.lessons.length} lesson${section.lessons.length !== 1 ? "s" : ""}`}
                  </span>
                )}
              </button>

              <div className={cn("grid transition-all duration-300", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                <ul className="overflow-hidden">
                  {section.lessons.length === 0 && (
                    <li className="px-5 py-3 text-xs italic text-muted-foreground">No lessons yet</li>
                  )}
                  {section.lessons.map((lesson, lIdx) => (
                    <LessonRow
                      key={lesson.id}
                      lesson={lesson}
                      number={lIdx + 1}
                      mode={mode}
                      courseId={courseId}
                      isCurrent={lesson.id === currentLessonId}
                      isNext={lesson.id === nextLessonId && mode === "learning"}
                    />
                  ))}
                </ul>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LessonRow({
  lesson, number, mode, courseId, isCurrent, isNext,
}: {
  lesson: CurriculumLesson
  number: number
  mode: "preview" | "learning" | "sidebar"
  courseId: string
  isCurrent: boolean
  isNext: boolean
}) {
  const TypeIcon = lesson.lessonType === "video" ? PlayCircle : FileText
  const compact = mode === "sidebar"
  const clickable = mode !== "preview" && !lesson.locked

  const status =
    mode === "preview" ? null : lesson.isCompleted ? (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-primary text-primary-foreground">
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
    ) : lesson.locked ? (
      <Lock className="h-4 w-4 shrink-0 text-muted-foreground/60" />
    ) : (
      <span className="h-4 w-4 shrink-0 rounded-sm border-2 border-muted-foreground/40" />
    )

  const body = (
    <>
      {status}
      <div className="min-w-0 flex-1">
        <p className={cn(
          "leading-snug",
          compact ? "text-sm" : "text-sm",
          lesson.locked && "text-muted-foreground",
          isCurrent && "font-semibold"
        )}>
          {number}. {lesson.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <TypeIcon className="h-3.5 w-3.5" />
            {lesson.lessonType === "video" ? "Video" : "Reading"}
          </span>
          {lesson.hasTest && (
            <span className="inline-flex items-center gap-1">
              <ClipboardCheck className="h-3.5 w-3.5" />Quiz
            </span>
          )}
          {isNext && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">Up next</span>
          )}
        </div>
      </div>
    </>
  )

  const className = cn(
    "flex items-start gap-3 transition-colors",
    compact ? "px-4 py-3" : "px-5 py-3",
    isCurrent && "bg-primary/10 border-l-4 border-primary",
    isNext && !isCurrent && "bg-primary/5",
    clickable && !isCurrent && "hover:bg-muted/60"
  )

  return (
    <li>
      {clickable ? (
        <Link href={`/student/courses/${courseId}/lessons/${lesson.id}`} className={className} aria-current={isCurrent ? "page" : undefined}>
          {body}
        </Link>
      ) : (
        <div className={className} title={lesson.locked ? "Complete the previous lesson to unlock" : undefined}>
          {body}
        </div>
      )}
    </li>
  )
}
