"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronRight, CheckCircle2, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { markLessonViewed, submitTest } from "@/actions/student.actions"
import { YouTubePlayerWithQuiz } from "@/components/student/YouTubePlayerWithQuiz"
import { CloudinaryVideoPlayer } from "@/components/student/CloudinaryVideoPlayer"

type QuestionType = "mcq" | "true_false" | "short_answer" | "fill_blank"

interface CueQuestion {
  text: string
  type: "mcq" | "true_false" | "short_answer"
  options: string[]
  points: number
}

interface VideoCue {
  id?: string
  timestamp: number
  title: string
  questions: CueQuestion[]
}

interface Question {
  id: string
  text: string
  type: QuestionType
  options: string[]
  points: number
}

interface TestData {
  id: string
  title: string
  passingScore: number
  maxAttempts: number
  questions: Question[]
}

interface LessonData {
  id: string
  title: string
  lessonType: string
  content: string
  studentNotes?: string
  videoKind: "cloudinary" | "r2" | "youtube" | "direct" | null
  videoUrl: string | null
  youtubeVideoId: string | null
  videoCues: VideoCue[]
  courseId: string
  moduleId: string
  isCompleted: boolean
  nextLessonId: string | null
  test: TestData | null
}

export function LessonViewerClient({
  lesson,
  courseId,
}: {
  lesson: LessonData
  courseId: string
}) {
  const router = useRouter()
  const [viewed, setViewed] = useState(lesson.isCompleted)
  const [videoEnded, setVideoEnded] = useState(false)
  const viewPending = useRef(false)
  const [marking, setMarking] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [testResult, setTestResult] = useState<{ score: number; passed: boolean; passingScore: number } | null>(null)

  // Auto-mark viewed for text lessons without test
  useEffect(() => {
    if (!lesson.isCompleted && !lesson.test && lesson.lessonType === "text") {
      markLessonViewed(lesson.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id])

  async function recordViewed(): Promise<boolean> {
    if (viewPending.current) return false
    viewPending.current = true
    setMarking(true)
    try {
      const result = await markLessonViewed(lesson.id)
      if ("error" in result) { toast.error(result.error); return false }
      setViewed(true)
      return true
    } catch {
      toast.error("Could not save your viewing progress. Please retry.")
      return false
    } finally {
      viewPending.current = false
      setMarking(false)
    }
  }

  async function handleVideoEnded() {
    setVideoEnded(true)
    await recordViewed()
  }

  async function handleMarkComplete() {
    if (lesson.lessonType === "video" && !videoEnded && !viewed) return
    if (!await recordViewed()) return
    toast.success("Lesson marked complete")
    router.push(lesson.nextLessonId ? `/student/courses/${courseId}/lessons/${lesson.nextLessonId}` : `/student/courses/${courseId}`)
  }

  async function handleSubmitTest(e: React.FormEvent) {
    e.preventDefault()
    if (!lesson.test) return
    if (lesson.lessonType === "video" && !viewed) { toast.error("Watch the video to the end before submitting the test"); return }
    setSubmitting(true)
    const result = await submitTest(lesson.test.id, answers)
    if ("error" in result) {
      toast.error(result.error)
    } else {
      setTestResult({ score: result.score!, passed: result.passed!, passingScore: result.passingScore! })
      if (result.passed) {
        toast.success(`Test passed with ${result.score}%!`)
        setTimeout(() => {
          if (lesson.nextLessonId) {
            router.push(`/student/courses/${courseId}/lessons/${lesson.nextLessonId}`)
          } else {
            router.push(`/student/courses/${courseId}`)
          }
        }, 2000)
      } else {
        toast.error(`Test failed. Score: ${result.score}%. Required: ${result.passingScore}%`)
      }
    }
    setSubmitting(false)
  }

  const isVideoLesson = lesson.lessonType === "video"

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <Link href={`/student/courses/${courseId}`} className="hover:underline">Course</Link>
        <ChevronRight className="h-3 w-3" />
        <span>{lesson.title}</span>
        {lesson.isCompleted && (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </Badge>
        )}
      </div>

      <h1 className="text-2xl font-bold">{lesson.title}</h1>

      {/* Cloudinary video lesson */}
      {isVideoLesson && ["cloudinary", "r2", "direct"].includes(lesson.videoKind ?? "") && lesson.videoUrl && (
        <CloudinaryVideoPlayer
          key={lesson.id}
          onEnded={handleVideoEnded}
          lessonId={lesson.id}
          videoUrl={lesson.videoUrl}
          cues={lesson.videoCues}
        />
      )}

      {/* YouTube video lesson */}
      {isVideoLesson && lesson.videoKind === "youtube" && lesson.youtubeVideoId && (
        <YouTubePlayerWithQuiz
          key={lesson.id}
          onEnded={handleVideoEnded}
          lessonId={lesson.id}
          videoId={lesson.youtubeVideoId}
          cues={lesson.videoCues}
        />
      )}

      {/* Text Content */}
      {lesson.content && (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{lesson.content}</pre>
        </div>
      )}

      {lesson.studentNotes && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Teacher Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{lesson.studentNotes}</pre>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Video lesson without test: mark complete button */}
      {isVideoLesson && !lesson.test && !lesson.isCompleted && (
        <Button onClick={handleMarkComplete} disabled={marking || (isVideoLesson && !videoEnded && !viewed)}>
          {marking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
          Mark as Complete
        </Button>
      )}

      {/* Text lesson without test: mark complete button */}
      {!isVideoLesson && !lesson.test && !lesson.isCompleted && (
        <Button onClick={handleMarkComplete} disabled={marking || (isVideoLesson && !videoEnded && !viewed)}>
          {marking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
          Mark as Complete
        </Button>
      )}

      {!lesson.test && lesson.isCompleted && lesson.nextLessonId && (
        <Button asChild>
          <Link href={`/student/courses/${courseId}/lessons/${lesson.nextLessonId}`}>
            Next Lesson <ChevronRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      )}

      {isVideoLesson && !viewed && (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>{marking ? "Saving viewing progress…" : "Watch the video to the end to unlock completion and the lesson test."}</p>
          {videoEnded && !marking && <Button variant="outline" onClick={() => void recordViewed()}>Retry saving viewing progress</Button>}
        </div>
      )}

      {/* Lesson Test */}
      {lesson.test && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{lesson.test.title}</h2>
          <p className="text-sm text-muted-foreground">
            Passing score: {lesson.test.passingScore}% · Max attempts: {lesson.test.maxAttempts}
          </p>

          {testResult && (
            <div className={`rounded-md p-4 text-sm ${testResult.passed ? "bg-primary/10 border border-primary/30 text-primary" : "bg-destructive/10 border border-destructive/30 text-destructive"}`}>
              {testResult.passed
                ? `Passed! Score: ${testResult.score}%`
                : `Failed. Score: ${testResult.score}% (required ${testResult.passingScore}%). Try again.`}
            </div>
          )}

          {!lesson.isCompleted && (
            <form onSubmit={handleSubmitTest} className="space-y-4">
              {lesson.test.questions.map((q, idx) => (
                <Card key={q.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">
                      {idx + 1}. {q.type === "fill_blank" ? "Fill in the gap" : q.text}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {q.type === "mcq" && q.options.map((opt) => (
                      <label key={opt} className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          value={opt}
                          checked={answers[q.id] === opt}
                          onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                        />
                        <span className="text-sm group-hover:text-foreground">{opt}</span>
                      </label>
                    ))}
                    {q.type === "true_false" && ["True", "False"].map((opt) => (
                      <label key={opt} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          value={opt}
                          checked={answers[q.id] === opt}
                          onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                        />
                        <span className="text-sm">{opt}</span>
                      </label>
                    ))}
                    {q.type === "short_answer" && (
                      <input
                        type="text"
                        className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                        placeholder="Your answer..."
                        value={answers[q.id] ?? ""}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      />
                    )}
                    {q.type === "fill_blank" && (
                      <div className="space-y-2">
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {q.text.split(/_+/).map((part, i, arr) => (
                            <span key={i}>
                              {part}
                              {i < arr.length - 1 && (
                                <span className="mx-1 inline-block min-w-[80px] border-b-2 border-primary/60 bg-primary/5 px-2 text-center font-semibold text-primary">
                                  {arr.length > 2 ? `(${i + 1})` : "?"}
                                </span>
                              )}
                            </span>
                          ))}
                        </p>
                        <input
                          type="text"
                          className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                          placeholder={(q.text.match(/_+/g) ?? []).length > 1 ? "Answers in order, separated by commas" : "Missing word..."}
                          value={answers[q.id] ?? ""}
                          onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              <Button
                type="submit"
                disabled={submitting || marking || (isVideoLesson && !viewed) || Object.keys(answers).length < lesson.test.questions.length}
                className="w-full"
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Submit Test
              </Button>
            </form>
          )}

          {lesson.isCompleted && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <CheckCircle2 className="h-4 w-4" />
              Test passed — lesson complete
            </div>
          )}
        </div>
      )}
    </div>
  )
}
