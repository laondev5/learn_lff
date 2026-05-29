"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  ChevronRight, Eye, EyeOff, FileText, Loader2, MoreHorizontal, Plus, Trash2, Upload, Video, ClipboardCheck
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
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

const MAX_VIDEO_SIZE = 300 * 1024 * 1024 // 300 MB
const CHUNK_SIZE = 5 * 1024 * 1024 // 5 MB

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
          reject(new Error(`Upload failed: ${xhr.statusText}`))
        }
      }
      xhr.onerror = () => reject(new Error("Network error during upload"))
      xhr.send(fd)
    })
  }

  return secureUrl
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

export function ModuleDetailClient({ mod }: { mod: ModuleData }) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [lessonType, setLessonType] = useState<"text" | "video">("text")
  const [content, setContent] = useState("")
  const [studentNotes, setStudentNotes] = useState("")
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [adding, setAdding] = useState(false)
  const fileInputId = "add-lesson-video-file"

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_VIDEO_SIZE) {
      toast.error("Video exceeds 300 MB limit. Please compress or trim it first.")
      e.target.value = ""
      return
    }
    setVideoFile(file)
    setUploadProgress(0)
  }

  async function handleAddLesson(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    let uploadedUrl = ""

    if (lessonType === "video") {
      if (!videoFile) {
        toast.error("Please select a video file to upload.")
        return
      }
      setUploading(true)
      try {
        uploadedUrl = await uploadToCloudinary(videoFile, setUploadProgress)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed")
        setUploading(false)
        return
      }
      setUploading(false)
    }

    setAdding(true)
    const fd = new FormData()
    fd.set("title", title)
    fd.set("lessonType", lessonType)
    fd.set("content", content)
    fd.set("studentNotes", studentNotes)
    if (uploadedUrl) fd.set("videoUrl", uploadedUrl)
    const result = await createLesson(mod.id, fd)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Lesson added")
      setAddOpen(false)
      setTitle("")
      setLessonType("text")
      setContent("")
      setStudentNotes("")
      setVideoFile(null)
      setUploadProgress(0)
      const el = document.getElementById(fileInputId) as HTMLInputElement | null
      if (el) el.value = ""
      router.refresh()
    }
    setAdding(false)
  }

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
        <h1 className="text-2xl font-bold">{mod.title}</h1>
        {mod.description && <p className="text-sm text-muted-foreground">{mod.description}</p>}
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Lessons</h2>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/teacher/courses/${mod.courseId}/modules/${mod.id}/test`}>
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Module Test
            </Link>
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger render={<Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Lesson</Button>} />
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add Lesson</DialogTitle></DialogHeader>
            <form onSubmit={handleAddLesson} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lesson title" disabled={adding} />
              </div>
              <div className="space-y-2">
                <Label>Lesson Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLessonType("text")}
                    disabled={adding}
                    className={`flex items-center justify-center gap-2 rounded-md border p-3 text-sm font-medium transition-colors ${
                      lessonType === "text"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background hover:bg-muted"
                    }`}
                  >
                    <FileText className="h-4 w-4" />Text Lesson
                  </button>
                  <button
                    type="button"
                    onClick={() => setLessonType("video")}
                    disabled={adding}
                    className={`flex items-center justify-center gap-2 rounded-md border p-3 text-sm font-medium transition-colors ${
                      lessonType === "video"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background hover:bg-muted"
                    }`}
                  >
                    <Video className="h-4 w-4" />Video Lesson
                  </button>
                </div>
              </div>
              {lessonType === "text" && (
                <div className="space-y-2">
                  <Label>Content</Label>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Lesson content..."
                    rows={5}
                    className="max-h-64 resize-y overflow-y-auto"
                    disabled={adding}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Notes For Students (Optional)</Label>
                <Textarea
                  value={studentNotes}
                  onChange={(e) => setStudentNotes(e.target.value)}
                  placeholder="Add notes students should see in this lesson..."
                  rows={3}
                  className="max-h-64 resize-y overflow-y-auto"
                  disabled={adding}
                />
              </div>
              {lessonType === "video" && (
                <div className="space-y-3">
                  <Label>Video File</Label>
                  <label
                    htmlFor={fileInputId}
                    className={`flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border p-6 text-center transition-colors ${uploading || adding ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted/50"}`}
                  >
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    {videoFile ? (
                      <p className="text-sm font-medium truncate max-w-[240px]">{videoFile.name}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Click to select a video file</p>
                    )}
                    <p className="text-xs text-muted-foreground">MP4, MOV, AVI — max 100 MB</p>
                  </label>
                  <input
                    id={fileInputId}
                    type="file"
                    accept="video/*"
                    className="sr-only"
                    onChange={handleFileChange}
                    disabled={uploading || adding}
                  />
                  {uploading && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Uploading…</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300 rounded-full"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setAddOpen(false)}
                  disabled={uploading || adding}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={uploading || adding || !title.trim()}
                >
                  {uploading ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Uploading…</>
                  ) : adding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Add Lesson"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {mod.lessons.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No lessons yet. Add the first lesson above.
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
        </div>
      )}
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
    <Card>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs font-medium text-muted-foreground shrink-0">#{lesson.order}</span>
            <CardTitle className="text-sm truncate">{lesson.title}</CardTitle>
            <div className="flex gap-1.5 shrink-0 flex-wrap">
              <Badge variant={lesson.isPublished ? "default" : "secondary"} className="text-xs">
                {lesson.isPublished ? "Published" : "Draft"}
              </Badge>
              <Badge variant="outline" className="text-xs gap-1">
                {lesson.lessonType === "video"
                  ? <><Video className="h-3 w-3" />Video</>
                  : <><FileText className="h-3 w-3" />Text</>}
              </Badge>
              {lesson.hasTest && (
                <Badge variant="outline" className="text-xs">Has Test</Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button asChild variant="ghost" size="sm">
              <Link href={`/teacher/courses/${courseId}/modules/${moduleId}/lessons/${lesson.id}`}>
                <ChevronRight className="h-4 w-4" />
              </Link>
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
      </CardHeader>
    </Card>
  )
}
