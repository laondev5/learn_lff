"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { 
  Loader2, 
  MessageCircle, 
  AlertCircle, 
  CheckCircle2, 
  Send, 
  User as UserIcon,
  ChevronDown,
  ChevronUp,
  MoreVertical
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { askQuestion, answerQuestion, toggleQuestionResolved } from "@/actions/qa.actions"
import { cn } from "@/lib/utils"

const questionSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  content: z.string().min(10, "Content must be at least 10 characters"),
  isUrgent: z.boolean(),
})

type QuestionFormData = {
  title: string
  content: string
  isUrgent: boolean
}

export interface Answer {
  _id: string
  author: {
    _id: string
    name: string
    role: string
    avatarUrl?: string
  }
  content: string
  createdAt: string
}

export interface Question {
  _id: string
  author: {
    _id: string
    name: string
    role: string
    avatarUrl?: string
  }
  title: string
  content: string
  isUrgent: boolean
  isResolved: boolean
  answers: Answer[]
  createdAt: string
}

interface CourseQAClientProps {
  courseId: string
  initialQuestions: Question[]
  currentUserId: string
  userRole: string
  isTeacherOfCourse: boolean
}

export function CourseQAClient({ 
  courseId, 
  initialQuestions, 
  currentUserId, 
  userRole,
  isTeacherOfCourse 
}: CourseQAClientProps) {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions)
  const [isAsking, setIsAsking] = useState(false)
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null)
  const [submittingQuestion, setSubmittingQuestion] = useState(false)
  const [submittingAnswer, setSubmittingAnswer] = useState<string | null>(null)
  const [answerContent, setAnswerContent] = useState("")

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<QuestionFormData>({
    resolver: zodResolver(questionSchema),
    defaultValues: { 
      title: "",
      content: "",
      isUrgent: false 
    }
  })

  const isUrgent = watch("isUrgent")

  const onAskQuestion = handleSubmit(async (data: QuestionFormData) => {
    setSubmittingQuestion(true)
    const result = await askQuestion(courseId, data)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Question posted!")
      setIsAsking(false)
      reset()
      window.location.reload()
    }
    setSubmittingQuestion(false)
  })

  async function onAnswerQuestion(questionId: string) {
    if (!answerContent.trim()) return
    setSubmittingAnswer(questionId)

    const result = await answerQuestion(questionId, courseId, answerContent)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Answer posted!")
      setAnswerContent("")
      window.location.reload()
    }
    setSubmittingAnswer(null)
  }

  async function onToggleResolved(questionId: string) {
    const result = await toggleQuestionResolved(questionId, courseId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Status updated")
      window.location.reload()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Course Q&A
        </h2>
        {userRole === "student" && (
          <Button onClick={() => setIsAsking(!isAsking)} variant={isAsking ? "outline" : "default"}>
            {isAsking ? "Cancel" : "Ask a Question"}
          </Button>
        )}
      </div>

      {isAsking && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">New Question</CardTitle>
            <CardDescription>Ask a question about this course. Teachers will be notified if it&apos;s urgent.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onAskQuestion} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" placeholder="e.g. Question about Lesson 3" {...register("title")} disabled={submittingQuestion} />
                {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Your Question</Label>
                <Textarea id="content" placeholder="Describe what you're having trouble with..." {...register("content")} disabled={submittingQuestion} />
                {errors.content && <p className="text-xs text-destructive">{errors.content.message}</p>}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isUrgent"
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  {...register("isUrgent")}
                  disabled={submittingQuestion}
                />
                <Label htmlFor="isUrgent" className="flex items-center gap-1.5 cursor-pointer">
                  <AlertCircle className={cn("h-4 w-4", isUrgent ? "text-red-500" : "text-muted-foreground")} />
                  This is urgent (Notify the teacher)
                </Label>
              </div>
              <Button type="submit" disabled={submittingQuestion} className="w-full">
                {submittingQuestion ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Post Question
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {questions.length === 0 ? (
          <div className="text-center py-10 border rounded-lg bg-muted/20">
            <MessageCircle className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-muted-foreground">No questions yet. Be the first to ask!</p>
          </div>
        ) : (
          questions.map((q) => (
            <Card key={q._id} className={cn("overflow-hidden", q.isUrgent && !q.isResolved && "border-red-200")}>
              <div 
                className="p-4 cursor-pointer hover:bg-muted/5 transition-colors"
                onClick={() => setExpandedQuestion(expandedQuestion === q._id ? null : q._id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg">{q.title}</h3>
                      {q.isUrgent && !q.isResolved && (
                        <span className="inline-flex items-center rounded-md bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground ring-1 ring-inset ring-destructive/10 gap-1">
                          <AlertCircle className="h-3 w-3" /> Urgent
                        </span>
                      )}
                      {q.isResolved && (
                        <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground ring-1 ring-inset ring-secondary/10 gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Resolved
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{q.author.name}</span>
                      <span>•</span>
                      <span>{new Date(q.createdAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" /> {q.answers.length} {q.answers.length === 1 ? 'answer' : 'answers'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(isTeacherOfCourse || q.author._id === currentUserId) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon-sm" onClick={(e) => e.stopPropagation()}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onToggleResolved(q._id)}>
                            {q.isResolved ? "Mark as Unresolved" : "Mark as Resolved"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    {expandedQuestion === q._id ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                  </div>
                </div>
              </div>

              {expandedQuestion === q._id && (
                <div className="border-t">
                  <div className="p-4 bg-muted/5">
                    <p className="text-sm whitespace-pre-wrap">{q.content}</p>
                  </div>

                  <div className="p-4 space-y-4">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      Answers
                    </h4>
                    
                    <div className="space-y-4">
                      {q.answers.map((ans) => (
                        <div key={ans._id} className="flex gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <UserIcon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold">{ans.author.name}</span>
                                {ans.author.role === "teacher" && (
                                  <span className="inline-flex items-center rounded-md border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                    Teacher
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(ans.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm">{ans.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-4 border-t space-y-3">
                      <Label htmlFor={`answer-${q._id}`} className="text-xs font-medium">Post an Answer</Label>
                      <div className="flex gap-2">
                        <Textarea 
                          id={`answer-${q._id}`}
                          placeholder="Share your knowledge or respond as a teacher..."
                          value={answerContent}
                          onChange={(e) => setAnswerContent(e.target.value)}
                          className="min-h-[80px] text-sm"
                          disabled={submittingAnswer === q._id}
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button 
                          onClick={() => onAnswerQuestion(q._id)} 
                          disabled={submittingAnswer === q._id || !answerContent.trim()}
                          size="sm"
                          className="gap-2"
                        >
                          {submittingAnswer === q._id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                          Post Answer
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
