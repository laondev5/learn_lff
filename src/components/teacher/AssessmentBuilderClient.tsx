"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Plus, Trash2, Shield, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"


type QuestionType = "mcq" | "true_false" | "short_answer"

interface Question {
  _id?: string
  text: string
  type: QuestionType
  options?: string[]
  correctAnswer: string
  points: number
}

interface AssessmentData {
  _id?: string
  title: string
  type: "quiz" | "test" | "attendance" | "exam"
  passingMarks: number
  maxAttempts: number
  durationMinutes: number
  proctoringEnabled: boolean
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

export function AssessmentBuilderClient({
  courseId,
  moduleId,
  assessment,
}: {
  courseId: string
  moduleId?: string
  assessment: AssessmentData | null
}) {
  const router = useRouter()
  const [title, setTitle] = useState(assessment?.title ?? "")
  const [type, setType] = useState<"quiz" | "test" | "attendance" | "exam">(assessment?.type ?? (moduleId ? "test" : "exam"))
  const [passingMarks, setPassingMarks] = useState(String(assessment?.passingMarks ?? 50))
  const [maxAttempts, setMaxAttempts] = useState(String(assessment?.maxAttempts ?? 2))
  const [duration, setDuration] = useState(String(assessment?.durationMinutes ?? 30))
  const [proctoringEnabled, setProctoringEnabled] = useState(assessment?.proctoringEnabled ?? false)
  const [questions, setQuestions] = useState<Question[]>(assessment?.questions?.length ? assessment.questions : [emptyQuestion()])
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
        const opts = q.options ? [...q.options] : ["", "", "", ""]
        opts[optIdx] = value
        return { ...q, options: opts }
      })
    )
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    
    // Basic validation
    if (!title.trim()) return toast.error("Please enter a title")
    if (questions.some(q => !q.text.trim())) return toast.error("All questions must have text")
    if (questions.some(q => !q.correctAnswer)) return toast.error("All questions must have a correct answer selected/entered")

    setSaving(true)
    
    const payload = {
      title,
      type,
      courseId,
      moduleId,
      passingMarks: Number(passingMarks),
      maxAttempts: Number(maxAttempts),
      durationMinutes: Number(duration),
      proctoringEnabled,
      isPublished: true,
      questions,
    }

    try {
      const url = assessment?._id ? `/api/assessments/${assessment._id}` : `/api/assessments`
      const method = assessment?._id ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      
      if (res.ok) {
        toast.success(assessment ? "Assessment updated" : "Assessment created")
        if (moduleId) {
          router.push(`/teacher/courses/${courseId}/modules/${moduleId}`)
        } else {
          router.push(`/teacher/courses/${courseId}`)
        }
        router.refresh()
      } else {
        toast.error(data.error || "Failed to save assessment")
      }
    } catch (err) {
      toast.error("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-8 pb-20">
      <Card>
        <CardHeader>
          <CardTitle>Assessment Details</CardTitle>
          <CardDescription>Configure the rules and settings for this assessment.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="sm:col-span-2 space-y-2">
            <Label>Title</Label>
            <Input 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              placeholder="e.g. Module 1 Test"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as "quiz" | "test" | "attendance" | "exam")} disabled={!!assessment}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="quiz">Quiz</SelectItem>
                <SelectItem value="test">Test</SelectItem>
                <SelectItem value="attendance">Attendance</SelectItem>
                <SelectItem value="exam">Final Exam</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Duration (minutes)</Label>
            <Input type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Passing Marks</Label>
            <Input type="number" min={1} value={passingMarks} onChange={(e) => setPassingMarks(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Max Attempts</Label>
            <Input type="number" min={1} value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} required />
          </div>
          <div className="sm:col-span-2 flex items-center justify-between border rounded-lg p-3 bg-muted/50">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Enable Proctoring
              </Label>
              <p className="text-xs text-muted-foreground">Monitors tab switching and fullscreen.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={proctoringEnabled}
              onClick={() => setProctoringEnabled(!proctoringEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                proctoringEnabled ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform ${
                  proctoringEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Questions</h3>
          <span className="text-sm font-medium bg-muted px-3 py-1 rounded-full border">
            Total Points: {questions.reduce((sum, q) => sum + (q.points || 0), 0)}
          </span>
        </div>
        
        {questions.map((q, idx) => (
          <QuestionEditor
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

      <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t">
        <Button type="button" variant="outline" onClick={addQuestion} className="flex-1 border-dashed">
          <Plus className="mr-2 h-4 w-4" />
          Add Question
        </Button>
        <Button type="submit" disabled={saving} className="flex-1">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {assessment ? "Update Assessment" : "Save Assessment"}
        </Button>
      </div>
    </form>
  )
}

function QuestionEditor({
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
    <Card className="border-2 shadow-sm focus-within:border-primary/50 transition-colors">
      <CardHeader className="pb-3 bg-muted/20">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">
              {index + 1}
            </span>
            Question
          </CardTitle>
          {canRemove && (
            <Button type="button" variant="ghost" size="icon" onClick={onRemove} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-3 space-y-2">
            <Label>Question Text</Label>
            <Textarea 
              value={question.text} 
              onChange={(e) => onUpdate({ text: e.target.value })} 
              rows={2} 
              placeholder="Enter question text..." 
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Question Type</Label>
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

        <div className="bg-muted/30 p-4 rounded-lg border">
          {question.type === "mcq" && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                Options
                <span className="text-xs font-normal text-muted-foreground">(Select the radio button for the correct answer)</span>
              </Label>
              {question.options?.map((opt, i) => (
                <div key={i} className="flex items-center gap-3">
                  <input
                    type="radio"
                    name={`correct-ans-${index}`}
                    className="w-4 h-4 text-primary accent-primary cursor-pointer"
                    checked={question.correctAnswer === opt && opt !== ""}
                    onChange={() => onUpdate({ correctAnswer: opt })}
                    required
                  />
                  <Input 
                    value={opt} 
                    onChange={(e) => onUpdateOption(i, e.target.value)} 
                    placeholder={`Option ${i + 1}`} 
                    className={question.correctAnswer === opt && opt !== "" ? "border-primary bg-primary/5" : ""}
                    required
                  />
                </div>
              ))}
            </div>
          )}

          {question.type === "true_false" && (
            <div className="space-y-3">
              <Label>Correct Answer</Label>
              <Select value={question.correctAnswer ?? undefined} onValueChange={(v) => onUpdate({ correctAnswer: v ?? "" })}>
                <SelectTrigger className="w-full sm:max-w-xs"><SelectValue placeholder="Select correct answer" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="True">True</SelectItem>
                  <SelectItem value="False">False</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {question.type === "short_answer" && (
            <div className="space-y-3">
              <Label>Model / Expected Answer</Label>
              <Input 
                value={question.correctAnswer} 
                onChange={(e) => onUpdate({ correctAnswer: e.target.value })} 
                placeholder="Enter exact expected answer (case-insensitive)" 
                required
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Short answers are graded automatically based on exact text match.
              </p>
            </div>
          )}
        </div>

        <div className="w-32 space-y-2">
          <Label>Points Awarded</Label>
          <Input type="number" min={1} value={question.points} onChange={(e) => onUpdate({ points: Number(e.target.value) })} required />
        </div>
      </CardContent>
    </Card>
  )
}
