"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { saveExam } from "@/actions/course.actions"

type QuestionType = "mcq" | "true_false" | "short_answer"

interface Question {
  text: string
  type: QuestionType
  options: string[]
  correctAnswer: string
  points: number
}

interface ExamData {
  id: string
  title: string
  passingScore: number
  maxAttempts: number
  durationMinutes: number | null
  isPublished: boolean
  questions: Question[]
}

const emptyQuestion = (): Question => ({
  text: "",
  type: "mcq",
  options: ["", "", "", ""],
  correctAnswer: "",
  points: 1,
})

export function ExamBuilderClient({
  courseId,
  exam,
}: {
  courseId: string
  exam: ExamData | null
}) {
  const [title, setTitle] = useState(exam?.title ?? "Final Exam")
  const [passingScore, setPassingScore] = useState(String(exam?.passingScore ?? 70))
  const [maxAttempts, setMaxAttempts] = useState(String(exam?.maxAttempts ?? 2))
  const [duration, setDuration] = useState(String(exam?.durationMinutes ?? ""))
  const [questions, setQuestions] = useState<Question[]>(exam?.questions ?? [emptyQuestion()])
  const [saving, setSaving] = useState(false)

  function addQuestion() {
    setQuestions((prev) => [...prev, emptyQuestion()])
  }

  function removeQuestion(idx: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateQuestion(idx: number, patch: Partial<Question>) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== idx) return q
        const updated = { ...q, ...patch }
        if (patch.type === "true_false") {
          updated.options = ["True", "False"]
          updated.correctAnswer = ""
        } else if (patch.type === "mcq" && q.type !== "mcq") {
          updated.options = ["", "", "", ""]
          updated.correctAnswer = ""
        } else if (patch.type === "short_answer") {
          updated.options = []
        }
        return updated
      })
    )
  }

  function updateOption(qIdx: number, optIdx: number, value: string) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q
        const opts = [...q.options]
        opts[optIdx] = value
        return { ...q, options: opts }
      })
    )
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const result = await saveExam(courseId, {
      title,
      passingScore: Number(passingScore),
      maxAttempts: Number(maxAttempts),
      durationMinutes: duration ? Number(duration) : undefined,
      questions,
    })
    if (result.error) toast.error(result.error)
    else toast.success(exam ? "Exam updated" : "Exam created")
    setSaving(false)
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="sm:col-span-2 space-y-2">
          <Label>Exam Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Passing Score (%)</Label>
          <Input type="number" min={1} max={100} value={passingScore} onChange={(e) => setPassingScore(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Max Attempts</Label>
          <Input type="number" min={1} value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Duration (minutes, optional)</Label>
          <Input type="number" min={5} value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="No limit" />
        </div>
      </div>

      <div className="space-y-4">
        {questions.map((q, idx) => (
          <ExamQuestionEditor
            key={idx}
            index={idx}
            question={q}
            onUpdate={(patch) => updateQuestion(idx, patch)}
            onUpdateOption={(optIdx, val) => updateOption(idx, optIdx, val)}
            onRemove={() => removeQuestion(idx)}
            canRemove={questions.length > 1}
          />
        ))}
      </div>

      <Button type="button" variant="outline" onClick={addQuestion} className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        Add Question
      </Button>

      <Button type="submit" disabled={saving} className="w-full">
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {exam ? "Update Exam" : "Save Exam"}
      </Button>
    </form>
  )
}

function ExamQuestionEditor({
  index,
  question,
  onUpdate,
  onUpdateOption,
  onRemove,
  canRemove,
}: {
  index: number
  question: Question
  onUpdate: (patch: Partial<Question>) => void
  onUpdateOption: (optIdx: number, val: string) => void
  onRemove: () => void
  canRemove: boolean
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Question {index + 1}</CardTitle>
          {canRemove && (
            <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-3 space-y-2">
            <Label>Question Text</Label>
            <Textarea value={question.text} onChange={(e) => onUpdate({ text: e.target.value })} rows={2} placeholder="Enter question..." />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={question.type} onValueChange={(v) => onUpdate({ type: v as QuestionType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mcq">Multiple Choice</SelectItem>
                <SelectItem value="true_false">True / False</SelectItem>
                <SelectItem value="short_answer">Short Answer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {question.type === "mcq" && (
          <div className="space-y-2">
            <Label>Options (select correct answer)</Label>
            {question.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={opt} onChange={(e) => onUpdateOption(i, e.target.value)} placeholder={`Option ${i + 1}`} />
                <input
                  type="radio"
                  name={`exam-correct-${index}`}
                  checked={question.correctAnswer === opt && opt !== ""}
                  onChange={() => onUpdate({ correctAnswer: opt })}
                  title="Mark as correct"
                />
              </div>
            ))}
          </div>
        )}

        {question.type === "true_false" && (
          <div className="space-y-2">
            <Label>Correct Answer</Label>
            <Select value={question.correctAnswer ?? ""} onValueChange={(v) => onUpdate({ correctAnswer: v ?? "" })}>
              <SelectTrigger><SelectValue placeholder="Select answer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="True">True</SelectItem>
                <SelectItem value="False">False</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {question.type === "short_answer" && (
          <div className="space-y-2">
            <Label>Model Answer</Label>
            <Input value={question.correctAnswer} onChange={(e) => onUpdate({ correctAnswer: e.target.value })} placeholder="Expected answer" />
          </div>
        )}

        <div className="w-24 space-y-2">
          <Label>Points</Label>
          <Input type="number" min={1} value={question.points} onChange={(e) => onUpdate({ points: Number(e.target.value) })} />
        </div>
      </CardContent>
    </Card>
  )
}
