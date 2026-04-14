"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronRight, CheckCircle2, Loader2, Video } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { markLessonViewed, submitTest } from "@/actions/student.actions"
import { YouTubePlayerWithQuiz } from "@/components/student/YouTubePlayerWithQuiz"
import { CloudinaryVideoPlayer } from "@/components/student/CloudinaryVideoPlayer"

type QuestionType = "mcq" | "true_false" | "short_answer"

interface CueQuestion {
  text: string
  type: QuestionType
  options: string[]
  correctAnswer: string
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

  async function handleMarkComplete() {
    setMarking(true)
    await markLessonViewed(lesson.id)
    toast.success("Lesson marked complete")
    setMarking(false)
    if (lesson.nextLessonId) {
      router.push(`/student/courses/${courseId}/lessons/${lesson.nextLessonId}`)
    } else {
      router.push(`/student/courses/${courseId}`)
    }
  }

  async function handleSubmitTest(e: React.FormEvent) {
    e.preventDefault()
    if (!lesson.test) return
    setSubmitting(true)
    const result = await submitTest(lesson.test.id, answers)
    if (result.error) {
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
  const isCloudinaryVideo = lesson.videoUrl?.includes("cloudinary.com") ?? false

  function resolveYouTubeId(): string | null {
    if (isCloudinaryVideo) return null
    if (lesson.youtubeVideoId) return lesson.youtubeVideoId
    if (lesson.videoUrl) {
      const match = lesson.videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?]+)/)
      return match ? match[1] : null
    }
    return null
  }

  const youtubeVideoId = resolveYouTubeId()

  return (
    <div className="space-y-6 max-w-3xl">
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
      {isVideoLesson && isCloudinaryVideo && lesson.videoUrl && (
        <CloudinaryVideoPlayer
          videoUrl={lesson.videoUrl}
          cues={lesson.videoCues}
        />
      )}

      {/* YouTube video lesson */}
      {isVideoLesson && !isCloudinaryVideo && youtubeVideoId && (
        <YouTubePlayerWithQuiz
          videoId={youtubeVideoId}
          cues={lesson.videoCues}
        />
      )}

      {/* Fallback: external video link */}
      {isVideoLesson && !isCloudinaryVideo && !youtubeVideoId && lesson.videoUrl && (
        <div className="rounded-md overflow-hidden border">
          <div className="flex items-center gap-2 p-4 bg-muted/30">
            <Video className="h-4 w-4" />
            <a href={lesson.videoUrl} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline text-primary">
              Watch Video
            </a>
          </div>
        </div>
      )}

      {/* Text Content */}
      {lesson.content && (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{lesson.content}</pre>
        </div>
      )}

      <Separator />

      {/* Video lesson without test: mark complete button */}
      {isVideoLesson && !lesson.test && !lesson.isCompleted && (
        <Button onClick={handleMarkComplete} disabled={marking}>
          {marking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
          Mark as Complete
        </Button>
      )}

      {/* Text lesson without test: mark complete button */}
      {!isVideoLesson && !lesson.test && !lesson.isCompleted && (
        <Button onClick={handleMarkComplete} disabled={marking}>
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
                      {idx + 1}. {q.text}
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
                  </CardContent>
                </Card>
              ))}

              <Button
                type="submit"
                disabled={submitting || Object.keys(answers).length < lesson.test.questions.length}
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
