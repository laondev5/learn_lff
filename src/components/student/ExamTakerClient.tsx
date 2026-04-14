"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronRight, Loader2, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { submitExam } from "@/actions/student.actions"

type QuestionType = "mcq" | "true_false" | "short_answer"

interface Question {
  id: string
  text: string
  type: QuestionType
  options: string[]
  points: number
}

interface ExamData {
  id: string
  title: string
  passingScore: number
  maxAttempts: number
  durationMinutes: number | null
  attemptsUsed: number
  questions: Question[]
}

function useCountdown(minutes: number | null) {
  const [secondsLeft, setSecondsLeft] = useState(minutes ? minutes * 60 : null)
  useEffect(() => {
    if (!secondsLeft) return
    const timer = setInterval(() => {
      setSecondsLeft((s) => (s !== null && s > 0 ? s - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [secondsLeft])
  return secondsLeft
}

export function ExamTakerClient({
  exam,
  courseId,
}: {
  exam: ExamData
  courseId: string
}) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ score: number; passed: boolean; passingScore: number } | null>(null)
  const secondsLeft = useCountdown(exam.durationMinutes)
  const autoSubmitRef = useRef(false)

  // Auto-submit when timer expires
  useEffect(() => {
    if (secondsLeft === 0 && !autoSubmitRef.current && !result) {
      autoSubmitRef.current = true
      toast.warning("Time's up! Submitting exam...")
      handleSubmit()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft])

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    setSubmitting(true)
    const res = await submitExam(exam.id, answers)
    if (res.error) {
      toast.error(res.error)
    } else {
      setResult({ score: res.score!, passed: res.passed!, passingScore: res.passingScore! })
      if (res.passed) {
        toast.success(`Exam passed! Score: ${res.score}%`)
      } else {
        toast.error(`Exam failed. Score: ${res.score}%`)
      }
    }
    setSubmitting(false)
  }

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  if (result) {
    return (
      <div className="max-w-xl space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href={`/student/courses/${courseId}`} className="hover:underline">Course</Link>
          <ChevronRight className="h-3 w-3" />
          <span>Final Exam</span>
        </div>
        <div className={`rounded-lg border p-6 text-center space-y-3 ${result.passed ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"}`}>
          <p className="text-3xl font-bold">{result.score}%</p>
          <p className="font-medium">{result.passed ? "Exam Passed!" : "Exam Failed"}</p>
          <p className="text-sm text-muted-foreground">
            {result.passed
              ? "Congratulations! Your certificate has been issued."
              : `Required: ${result.passingScore}%. You can try again.`}
          </p>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline" className="flex-1">
            <Link href={`/student/courses/${courseId}`}>Back to Course</Link>
          </Button>
          {result.passed && (
            <Button asChild className="flex-1">
              <Link href="/student/certificates">View Certificate</Link>
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/student/courses/${courseId}`} className="hover:underline">Course</Link>
        <ChevronRight className="h-3 w-3" />
        <span>{exam.title}</span>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{exam.title}</h1>
          <p className="text-sm text-muted-foreground">
            Passing score: {exam.passingScore}% · Attempt {exam.attemptsUsed + 1} of {exam.maxAttempts}
          </p>
        </div>
        {secondsLeft !== null && (
          <div className={`flex items-center gap-2 font-mono text-lg font-semibold ${secondsLeft < 120 ? "text-destructive" : ""}`}>
            <Clock className="h-5 w-5" />
            {formatTime(secondsLeft)}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {exam.questions.map((q, idx) => (
          <Card key={q.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                {idx + 1}. {q.text}
                <span className="ml-2 text-xs font-normal text-muted-foreground">({q.points} pt{q.points !== 1 ? "s" : ""})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {q.type === "mcq" && q.options.map((opt) => (
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

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Submit Exam
        </Button>
      </form>
    </div>
  )
}
