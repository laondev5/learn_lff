"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, ClipboardCheck, Eye, EyeOff, FileText,
  Link2, Loader2, MoreHorizontal, NotebookPen, PartyPopper, Plus, Rocket, Trash2, Type, Upload, Video, X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  createLesson, toggleLessonPublished, deleteLesson,
} from "@/actions/course.actions"
import { Stepper, StepHint, VisibilityToggle, type StepItem } from "@/components/teacher/Stepper"
import { cn } from "@/lib/utils"

const MAX_VIDEO_INPUT_SIZE = 500 * 1024 * 1024 // 500 MB max before compression
const COMPRESS_THRESHOLD = 100 * 1024 * 1024 // auto-compress anything ≥ 100 MB
const CHUNK_SIZE = 5 * 1024 * 1024 // 5 MB per upload chunk

async function uploadToCloudinary(
  file: File,
  onProgress: (pct: number) => void
): Promise<string> {
  const sigRes = await fetch("/api/video/sign")
  if (!sigRes.ok) throw new Error("Failed to get upload credentials")
  const { cloudName, apiKey, timestamp, signature, folder } = await sigRes.json()

  const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
  let secureUrl = ""

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)

    await new Promise<void>((resolve, reject) => {
      const fd = new FormData()
      fd.append("file", chunk)
      fd.append("api_key", apiKey)
      fd.append("timestamp", String(timestamp))
      fd.append("signature", signature)
      fd.append("folder", folder)

      const xhr = new XMLHttpRequest()
      xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`)
      xhr.setRequestHeader("X-Unique-Upload-Id", uploadId)
      xhr.setRequestHeader("Content-Range", `bytes ${start}-${end - 1}/${file.size}`)

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          const chunkPct = ev.loaded / ev.total
          onProgress(Math.round(((i + chunkPct) / totalChunks) * 100))
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText)
          secureUrl = data.secure_url
          onProgress(Math.round(((i + 1) / totalChunks) * 100))
          resolve()
        } else {
          try {
            const errData = JSON.parse(xhr.responseText)
            reject(new Error(errData?.error?.message ?? `Upload failed (${xhr.status})`))
          } catch {
            reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`))
          }
        }
      }
      xhr.onerror = () => reject(new Error("Network error during upload"))
      xhr.send(fd)
    })
  }

  return secureUrl
}

function isValidUrl(value: string) {
  try {
    const u = new URL(value)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

interface Lesson {
  id: string
  title: string
  order: number
  lessonType: string
  isPublished: boolean
  hasTest: boolean
  testId: string | null
}

interface ModuleData {
  id: string
  title: string
  description?: string
  courseId: string
  isPublished: boolean
  lessons: Lesson[]
}

const LESSON_STEPS: StepItem[] = [
  { label: "Basics", icon: Type },
  { label: "Content", icon: BookOpen },
  { label: "Notes", icon: NotebookPen, optional: true },
  { label: "Review", icon: Rocket },
]

export function ModuleDetailClient({ mod }: { mod: ModuleData }) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [title, setTitle] = useState("")
  const [lessonType, setLessonType] = useState<"text" | "video">("text")
  const [videoSource, setVideoSource] = useState<"upload" | "link">("upload")
  const [videoLink, setVideoLink] = useState("")
  const [content, setContent] = useState("")
  const [studentNotes, setStudentNotes] = useState("")
  const [visible, setVisible] = useState(true)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [compressionProgress, setCompressionProgress] = useState(0)
  const [adding, setAdding] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [stepError, setStepError] = useState("")
  const [createdLessonId, setCreatedLessonId] = useState<string | null>(null)
  const fileInputId = "add-lesson-video-file"

  const busy = uploading || adding || compressing
  const isLast = step === LESSON_STEPS.length - 1

  function resetWizard() {
    setStep(0)
    setTitle("")
    setLessonType("text")
    setVideoSource("upload")
    setVideoLink("")
    setContent("")
    setStudentNotes("")
    setVisible(true)
    setVideoFile(null)
    setUploadProgress(0)
    setStepError("")
    setCreatedLessonId(null)
  }

  async function acceptVideoFile(file: File | undefined, input?: HTMLInputElement) {
    if (!file) return
    if (!file.type.startsWith("video/")) {
      toast.error("That doesn't look like a video file.")
      return
    }
    if (file.size > MAX_VIDEO_INPUT_SIZE) {
      toast.error("Video exceeds 500 MB. Please trim it before uploading.")
      if (input) input.value = ""
      return
    }

    setUploadProgress(0)
    setStepError("")

    if (file.size >= COMPRESS_THRESHOLD) {
      setCompressing(true)
      setCompressionProgress(0)
      toast.info("Video is over 100 MB — compressing before upload…")
      try {
        const { compressVideoIfNeeded } = await import("@/lib/compress-video")
        const compressed = await compressVideoIfNeeded(file, setCompressionProgress)
        setVideoFile(compressed)
        setCompressionProgress(100)
        toast.success(`Compressed to ${(compressed.size / 1024 / 1024).toFixed(1)} MB — ready to upload`)
      } catch (err) {
        toast.error("Compression failed: " + (err instanceof Error ? err.message : "Unknown error"))
        if (input) input.value = ""
        setVideoFile(null)
      } finally {
        setCompressing(false)
      }
    } else {
      setVideoFile(file)
    }
  }

  function validateStep(index: number): string {
    if (index === 0 && title.trim().length < 2) return "Give your lesson a title (at least 2 characters)."
    if (index === 1 && lessonType === "video") {
      if (compressing) return "Please wait for compression to finish."
      if (videoSource === "upload" && !videoFile) return "Choose a video file to upload, or switch to “Paste a link”."
      if (videoSource === "link" && !isValidUrl(videoLink.trim())) return "Enter a valid video link starting with https://"
    }
    return ""
  }

  function goNext() {
    const err = validateStep(step)
    setStepError(err)
    if (!err) setStep((s) => Math.min(s + 1, LESSON_STEPS.length - 1))
  }

  function goTo(index: number) {
    if (busy) return
    if (index <= step) { setStepError(""); return setStep(index) }
    for (let i = step; i < index; i++) {
      const err = validateStep(i)
      if (err) { setStepError(err); return setStep(i) }
    }
    setStepError("")
    setStep(index)
  }

  async function handleAddLesson(e: React.FormEvent) {
    e.preventDefault()
    if (!isLast) return goNext()
    for (let i = 0; i < LESSON_STEPS.length - 1; i++) {
      const err = validateStep(i)
      if (err) { setStepError(err); return setStep(i) }
    }

    let videoUrl = ""

    if (lessonType === "video") {
      if (videoSource === "link") {
        videoUrl = videoLink.trim()
      } else if (videoFile) {
        setUploading(true)
        try {
          videoUrl = await uploadToCloudinary(videoFile, setUploadProgress)
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Upload failed")
          setUploading(false)
          return
        }
        setUploading(false)
      }
    }

    setAdding(true)
    const fd = new FormData()
    fd.set("title", title)
    fd.set("lessonType", lessonType)
    fd.set("content", content)
    fd.set("studentNotes", studentNotes)
    if (videoUrl) fd.set("videoUrl", videoUrl)
    const result = await createLesson(mod.id, fd)
    if (result.error) {
      toast.error(result.error)
    } else {
      if (visible && result.lessonId) await toggleLessonPublished(result.lessonId)
      setCreatedLessonId(result.lessonId ?? null)
      const el = document.getElementById(fileInputId) as HTMLInputElement | null
      if (el) el.value = ""
      router.refresh()
    }
    setAdding(false)
  }

  const nextLessonNumber = mod.lessons.length + 1

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <Link href="/teacher/courses" className="hover:underline">Courses</Link>
          <ChevronRight className="h-3 w-3" />
          <Link href={`/teacher/courses/${mod.courseId}`} className="hover:underline">Course</Link>
          <ChevronRight className="h-3 w-3" />
          <span>{mod.title}</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">{mod.title}</h1>
          <Badge variant={mod.isPublished ? "default" : "secondary"}>{mod.isPublished ? "Published" : "Draft"}</Badge>
        </div>
        {mod.description && <p className="text-sm text-muted-foreground">{mod.description}</p>}
      </div>

      <Separator />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Lessons</h2>
          <p className="text-xs text-muted-foreground">Students go through these in order. Open a lesson to add quizzes and a test.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/teacher/courses/${mod.courseId}/modules/${mod.id}/test`}>
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Module Test
            </Link>
          </Button>
          <Dialog
            open={addOpen}
            onOpenChange={(o) => {
              if (busy) return
              setAddOpen(o)
              if (!o) resetWizard()
            }}
          >
            <DialogTrigger render={<Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Lesson</Button>} />
            <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-y-auto">
              {createdLessonId ? (
                /* ── SUCCESS SCREEN ── */
                <div className="flex flex-col items-center text-center gap-4 py-6 animate-in fade-in-0 zoom-in-95 duration-300">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <PartyPopper className="h-7 w-7" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg">Lesson created!</DialogTitle>
                    <DialogDescription className="mt-1 max-w-sm">
                      &ldquo;{title}&rdquo; has been added{visible ? " and is visible to students" : " as a draft"}.
                      {lessonType === "video"
                        ? " Next, you can add in-video quizzes and a lesson test."
                        : " Next, you can add a lesson test to check understanding."}
                    </DialogDescription>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Button asChild>
                      <Link href={`/teacher/courses/${mod.courseId}/modules/${mod.id}/lessons/${createdLessonId}`}>
                        {lessonType === "video" ? "Add quizzes & test" : "Add a lesson test"}
                        <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Link>
                    </Button>
                    <Button variant="outline" onClick={resetWizard}>
                      <Plus className="mr-1.5 h-4 w-4" />Add another lesson
                    </Button>
                    <Button variant="ghost" onClick={() => { setAddOpen(false); resetWizard() }}>Done</Button>
                  </div>
                </div>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Add Lesson {nextLessonNumber}</DialogTitle>
                    <DialogDescription>to &ldquo;{mod.title}&rdquo; · {LESSON_STEPS.length} quick steps</DialogDescription>
                  </DialogHeader>

                  <Stepper steps={LESSON_STEPS} current={step} onStepClick={busy ? undefined : goTo} className="mt-2 mb-2" />

                  <form onSubmit={handleAddLesson} className="space-y-5">
                    <div key={step} className="animate-in fade-in-0 slide-in-from-right-4 duration-300 space-y-4 min-h-60">
                      {/* ── STEP 1: BASICS ── */}
                      {step === 0 && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="lesson-title">Lesson title</Label>
                            <Input
                              id="lesson-title"
                              autoFocus
                              value={title}
                              onChange={(e) => { setTitle(e.target.value); setStepError("") }}
                              placeholder={`e.g. Lesson ${nextLessonNumber}: The Parable of the Sower`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>What kind of lesson is it?</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {([
                                { value: "video", icon: Video, title: "Video lesson", desc: "Upload a video or paste a YouTube link. You can add quizzes that pop up during the video." },
                                { value: "text", icon: FileText, title: "Text lesson", desc: "Write the lesson as reading material, like an article or study guide." },
                              ] as const).map((opt) => {
                                const selected = lessonType === opt.value
                                return (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => { setLessonType(opt.value); setStepError("") }}
                                    className={cn(
                                      "relative flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all",
                                      selected ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40 hover:bg-muted/40"
                                    )}
                                  >
                                    {selected && (
                                      <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                        <Check className="h-3 w-3" />
                                      </span>
                                    )}
                                    <opt.icon className={cn("h-6 w-6", selected ? "text-primary" : "text-muted-foreground")} />
                                    <span className="font-semibold">{opt.title}</span>
                                    <span className="text-xs text-muted-foreground">{opt.desc}</span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        </>
                      )}

                      {/* ── STEP 2: CONTENT ── */}
                      {step === 1 && lessonType === "text" && (
                        <>
                          <div>
                            <h3 className="font-semibold text-base">Write your lesson</h3>
                            <p className="text-muted-foreground text-xs mt-0.5">This is what students will read. Line breaks are kept as you type them.</p>
                          </div>
                          <Textarea
                            autoFocus
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Start writing the lesson content…"
                            rows={10}
                            className="max-h-[45vh] resize-y overflow-y-auto"
                          />
                          <div className="flex justify-between text-[11px] text-muted-foreground">
                            <span>You can edit this later from the lesson page.</span>
                            <span>{content.trim() ? content.trim().split(/\s+/).length : 0} words</span>
                          </div>
                        </>
                      )}

                      {step === 1 && lessonType === "video" && (
                        <>
                          <div>
                            <h3 className="font-semibold text-base">Add your video</h3>
                            <p className="text-muted-foreground text-xs mt-0.5">Upload a file from your computer, or paste a YouTube / video link.</p>
                          </div>
                          <div className="inline-flex rounded-lg border p-1 bg-muted/40">
                            {([
                              { value: "upload", icon: Upload, label: "Upload a file" },
                              { value: "link", icon: Link2, label: "Paste a link" },
                            ] as const).map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                disabled={compressing}
                                onClick={() => { setVideoSource(opt.value); setStepError("") }}
                                className={cn(
                                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                                  videoSource === opt.value ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                <opt.icon className="h-3.5 w-3.5" />{opt.label}
                              </button>
                            ))}
                          </div>

                          {videoSource === "upload" ? (
                            <div className="space-y-3">
                              {videoFile && !compressing ? (
                                <div className="flex items-center gap-3 rounded-xl border bg-primary/5 border-primary/30 p-4">
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <Video className="h-5 w-5" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{videoFile.name}</p>
                                    <p className="text-xs text-muted-foreground">{(videoFile.size / 1024 / 1024).toFixed(1)} MB · uploads when you create the lesson</p>
                                  </div>
                                  <Button type="button" variant="ghost" size="icon" onClick={() => setVideoFile(null)} title="Remove">
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <label
                                  htmlFor={fileInputId}
                                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                                  onDragLeave={() => setDragOver(false)}
                                  onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!compressing) acceptVideoFile(e.dataTransfer.files?.[0]) }}
                                  className={cn(
                                    "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
                                    compressing ? "cursor-not-allowed opacity-70" : "cursor-pointer",
                                    dragOver ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                                  )}
                                >
                                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    {compressing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                                  </div>
                                  <p className="text-sm font-medium">{compressing ? "Preparing your video…" : "Drag a video here, or click to browse"}</p>
                                  <p className="text-xs text-muted-foreground">MP4, MOV, AVI, WebM · max 500 MB (auto-compressed if over 100 MB)</p>
                                </label>
                              )}
                              <input
                                id={fileInputId}
                                type="file"
                                accept="video/*"
                                className="sr-only"
                                onChange={(e) => acceptVideoFile(e.target.files?.[0], e.target)}
                                disabled={busy}
                              />
                              {compressing && (
                                <ProgressBar label="Compressing…" value={compressionProgress} tone="amber" spinner />
                              )}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <Label htmlFor="video-link">Video link</Label>
                              <Input
                                id="video-link"
                                autoFocus
                                value={videoLink}
                                onChange={(e) => { setVideoLink(e.target.value); setStepError("") }}
                                placeholder="https://www.youtube.com/watch?v=…"
                              />
                              <p className="text-xs text-muted-foreground">YouTube links play right inside the lesson.</p>
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label htmlFor="video-desc">Short description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                            <Textarea
                              id="video-desc"
                              value={content}
                              onChange={(e) => setContent(e.target.value)}
                              placeholder="What is this video about?"
                              rows={3}
                            />
                          </div>
                        </>
                      )}

                      {/* ── STEP 3: NOTES ── */}
                      {step === 2 && (
                        <>
                          <div>
                            <h3 className="font-semibold text-base">Notes for students</h3>
                            <p className="text-muted-foreground text-xs mt-0.5">Optional. Key takeaways, scripture references, reminders or homework shown alongside the lesson.</p>
                          </div>
                          <Textarea
                            autoFocus
                            value={studentNotes}
                            onChange={(e) => setStudentNotes(e.target.value)}
                            placeholder={"e.g.\n• Read Matthew 13:1–23 before the next lesson\n• Key idea: …"}
                            rows={8}
                            className="max-h-[45vh] resize-y overflow-y-auto"
                          />
                          <StepHint>Nothing to add? Just press <strong>Skip</strong>. You can add notes later from the lesson page.</StepHint>
                        </>
                      )}

                      {/* ── STEP 4: REVIEW ── */}
                      {step === 3 && (
                        <>
                          <div>
                            <h3 className="font-semibold text-base">Review and create</h3>
                            <p className="text-muted-foreground text-xs mt-0.5">Check everything looks right.</p>
                          </div>
                          <dl className="rounded-xl border divide-y text-sm">
                            <ReviewRow label="Title" onEdit={() => setStep(0)} disabled={busy}>{title}</ReviewRow>
                            <ReviewRow label="Type" onEdit={() => setStep(0)} disabled={busy}>
                              <span className="inline-flex items-center gap-1.5">
                                {lessonType === "video" ? <Video className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                                {lessonType === "video" ? "Video lesson" : "Text lesson"}
                              </span>
                            </ReviewRow>
                            {lessonType === "video" && (
                              <ReviewRow label="Video" onEdit={() => setStep(1)} disabled={busy}>
                                <span className="break-all">{videoSource === "upload" ? videoFile?.name : videoLink}</span>
                              </ReviewRow>
                            )}
                            <ReviewRow label={lessonType === "video" ? "Description" : "Content"} onEdit={() => setStep(1)} disabled={busy}>
                              {content.trim()
                                ? <span className="line-clamp-2 whitespace-pre-line">{content}</span>
                                : <span className="text-muted-foreground">None</span>}
                            </ReviewRow>
                            <ReviewRow label="Notes" onEdit={() => setStep(2)} disabled={busy}>
                              {studentNotes.trim()
                                ? <span className="line-clamp-2 whitespace-pre-line">{studentNotes}</span>
                                : <span className="text-muted-foreground">None</span>}
                            </ReviewRow>
                          </dl>
                          <VisibilityToggle checked={visible} onChange={setVisible} disabled={busy} noun="lesson" />
                          {uploading && <ProgressBar label="Uploading video…" value={uploadProgress} />}
                        </>
                      )}

                      {stepError && (
                        <p className="text-xs text-destructive animate-in fade-in-0">{stepError}</p>
                      )}
                    </div>

                    {/* Footer navigation */}
                    <div className="flex items-center gap-3 pt-2 border-t">
                      {step > 0 ? (
                        <Button type="button" variant="ghost" onClick={() => { setStepError(""); setStep((s) => s - 1) }} disabled={busy}>
                          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
                        </Button>
                      ) : (
                        <Button type="button" variant="ghost" onClick={() => { setAddOpen(false); resetWizard() }} disabled={busy}>
                          Cancel
                        </Button>
                      )}
                      <div className="ml-auto flex items-center gap-2">
                        {step === 2 && !studentNotes.trim() && (
                          <Button type="button" variant="outline" onClick={() => setStep(3)}>Skip</Button>
                        )}
                        <Button type="submit" disabled={busy} className="min-w-35">
                          {compressing ? (
                            <><Loader2 className="h-4 w-4 animate-spin mr-2" />Compressing…</>
                          ) : uploading ? (
                            <><Loader2 className="h-4 w-4 animate-spin mr-2" />Uploading {uploadProgress}%</>
                          ) : adding ? (
                            <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</>
                          ) : isLast ? (
                            <><Rocket className="mr-1.5 h-4 w-4" />Create Lesson</>
                          ) : (
                            <>Continue <ArrowRight className="ml-1.5 h-4 w-4" /></>
                          )}
                        </Button>
                      </div>
                    </div>
                  </form>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {mod.lessons.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 flex flex-col items-center text-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium">No lessons in this module yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                A lesson can be a video or written content. We&apos;ll guide you through creating it step by step.
              </p>
            </div>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />Add first lesson
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {mod.lessons.map((lesson) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              courseId={mod.courseId}
              moduleId={mod.id}
            />
          ))}
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="w-full rounded-xl border-2 border-dashed py-4 text-sm font-medium text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />Add lesson {nextLessonNumber}
          </button>
        </div>
      )}
    </div>
  )
}

function ProgressBar({
  label, value, tone = "primary", spinner,
}: {
  label: string
  value: number
  tone?: "primary" | "amber"
  spinner?: boolean
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          {spinner && <Loader2 className="h-3 w-3 animate-spin" />}
          {label}
        </span>
        <span>{value}%</span>
      </div>
      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full transition-all duration-300 rounded-full", tone === "amber" ? "bg-amber-500" : "bg-primary")}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

function ReviewRow({
  label, children, onEdit, disabled,
}: {
  label: string
  children: React.ReactNode
  onEdit: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <dt className="w-24 shrink-0 text-xs font-medium text-muted-foreground pt-0.5">{label}</dt>
      <dd className="flex-1 min-w-0 wrap-break-word">{children}</dd>
      <button type="button" onClick={onEdit} disabled={disabled} className="shrink-0 text-xs font-medium text-primary hover:underline disabled:opacity-50">
        Edit
      </button>
    </div>
  )
}

function LessonCard({
  lesson,
  courseId,
  moduleId,
}: {
  lesson: Lesson
  courseId: string
  moduleId: string
}) {
  const router = useRouter()
  const [toggling, setToggling] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const lessonHref = `/teacher/courses/${courseId}/modules/${moduleId}/lessons/${lesson.id}`

  async function handleToggle() {
    setToggling(true)
    const result = await toggleLessonPublished(lesson.id)
    if (result.error) toast.error(result.error)
    else router.refresh()
    setToggling(false)
  }

  async function handleDelete() {
    if (!confirm("Delete this lesson and its test?")) return
    setDeleting(true)
    const result = await deleteLesson(lesson.id)
    if (result.error) toast.error(result.error)
    else {
      toast.success("Lesson deleted")
      router.refresh()
    }
    setDeleting(false)
  }

  return (
    <Card className="transition-shadow hover:shadow-md">
      <div className="flex items-center gap-3 p-3 sm:p-4">
        <div className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          lesson.lessonType === "video" ? "bg-orange-100 text-orange-600 dark:bg-orange-500/15" : "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400"
        )}>
          {lesson.lessonType === "video" ? <Video className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <Link href={lessonHref} className="text-sm font-medium hover:underline line-clamp-1">
            {lesson.order}. {lesson.title}
          </Link>
          <div className="flex gap-1.5 mt-1 flex-wrap">
            <Badge variant={lesson.isPublished ? "default" : "secondary"} className="text-xs">
              {lesson.isPublished ? "Published" : "Draft"}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {lesson.lessonType === "video" ? "Video" : "Text"}
            </Badge>
            {lesson.hasTest ? (
              <Badge variant="outline" className="text-xs gap-1"><Check className="h-3 w-3" />Has Test</Badge>
            ) : (
              <Badge variant="outline" className="text-xs border-dashed text-muted-foreground">No test yet</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
            <Link href={lessonHref}>Open<ChevronRight className="ml-1 h-3.5 w-3.5" /></Link>
          </Button>
          <Button asChild variant="ghost" size="icon" className="sm:hidden">
            <Link href={lessonHref} aria-label="Open lesson"><ChevronRight className="h-4 w-4" /></Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" disabled={toggling || deleting} />}>
              {toggling || deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleToggle}>
                {lesson.isPublished ? <><EyeOff className="mr-2 h-4 w-4" />Unpublish</> : <><Eye className="mr-2 h-4 w-4" />Publish</>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  )
}
