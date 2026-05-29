"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  ChevronRight, Clock, Loader2, Plus, Trash2, Upload, Video, FileText, Link2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { saveTest, deleteTest, saveVideoCues, saveLessonVideoUrl, saveLessonStudentNotes } from "@/actions/course.actions"

type QuestionType = "mcq" | "true_false" | "short_answer"

interface Question {
  id?: string
  text: string
  type: QuestionType
  options: string[]
  correctAnswer: string
  points: number
}

interface TestData {
  id: string
  title: string
  passingScore: number
  maxAttempts: number
  isPublished: boolean
  questions: Question[]
}

interface VideoCue {
  id?: string
  timestamp: number
  title: string
  questions: Question[]
}

interface LessonData {
  id: string
  title: string
  lessonType: "video" | "text"
  content: string
  studentNotes: string
  videoUrl: string | null
  youtubeVideoId: string | null
  videoCues: VideoCue[]
  isPublished: boolean
  moduleId: string
  courseId: string
  test: TestData | null
}

const emptyQuestion = (): Question => ({
  text: "",
  type: "mcq",
  options: ["", "", "", ""],
  correctAnswer: "",
  points: 1,
})

const emptyCue = (): VideoCue => ({
  timestamp: 0,
  title: "Quick Check",
  questions: [emptyQuestion()],
})

function formatTimestamp(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function LessonDetailClient({ lesson }: { lesson: LessonData }) {
  // --- Test state ---
  const [testTitle, setTestTitle] = useState(lesson.test?.title ?? "Lesson Test")
  const [passingScore, setPassingScore] = useState(String(lesson.test?.passingScore ?? 70))
  const [maxAttempts, setMaxAttempts] = useState(String(lesson.test?.maxAttempts ?? 3))
  const [questions, setQuestions] = useState<Question[]>(lesson.test?.questions ?? [emptyQuestion()])
  const [saving, setSaving] = useState(false)
  const [deletingTest, setDeletingTest] = useState(false)

  // --- Video cues state ---
  const [videoCues, setVideoCues] = useState<VideoCue[]>(lesson.videoCues ?? [])
  const [savingCues, setSavingCues] = useState(false)

  // --- Video upload state ---
  const MAX_VIDEO_INPUT_MB = 500
  const COMPRESS_THRESHOLD_MB = 100
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [compressing, setCompressing] = useState(false)
  const [compressionProgress, setCompressionProgress] = useState(0)
  const [currentVideoUrl, setCurrentVideoUrl] = useState(lesson.videoUrl ?? "")
  const [pasteUrlInput, setPasteUrlInput] = useState("")
  const [savingUrl, setSavingUrl] = useState(false)
  const [studentNotes, setStudentNotes] = useState(lesson.studentNotes ?? "")
  const [savingNotes, setSavingNotes] = useState(false)

  // --- Test handlers ---
  function addQuestion() { setQuestions((prev) => [...prev, emptyQuestion()]) }
  function removeQuestion(idx: number) { setQuestions((prev) => prev.filter((_, i) => i !== idx)) }
  function updateQuestion(idx: number, patch: Partial<Question>) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== idx) return q
        const updated = { ...q, ...patch }
        if (patch.type === "true_false") { updated.options = ["True", "False"]; updated.correctAnswer = "" }
        else if (patch.type === "mcq" && q.type !== "mcq") { updated.options = ["", "", "", ""]; updated.correctAnswer = "" }
        else if (patch.type === "short_answer") { updated.options = [] }
        return updated
      })
    )
  }
  function updateOption(qIdx: number, optIdx: number, value: string) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q
        const opts = [...q.options]; opts[optIdx] = value
        return { ...q, options: opts }
      })
    )
  }

  async function handleSaveTest(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const result = await saveTest(lesson.id, {
      title: testTitle, passingScore: Number(passingScore), maxAttempts: Number(maxAttempts), questions,
    })
    if (result.error) toast.error(result.error)
    else toast.success("Test saved")
    setSaving(false)
  }

  async function handleDeleteTest() {
    if (!confirm("Delete this test?")) return
    setDeletingTest(true)
    const result = await deleteTest(lesson.id)
    if (result.error) toast.error(result.error)
    else { toast.success("Test deleted"); setQuestions([emptyQuestion()]); setTestTitle("Lesson Test") }
    setDeletingTest(false)
  }

  // --- Video cue handlers ---
  function addCue() { setVideoCues((prev) => [...prev, emptyCue()]) }
  function removeCue(idx: number) { setVideoCues((prev) => prev.filter((_, i) => i !== idx)) }
  function updateCue(idx: number, patch: Partial<VideoCue>) {
    setVideoCues((prev) => prev.map((c, i) => i === idx ? { ...c, ...patch } : c))
  }
  function addCueQuestion(cueIdx: number) {
    setVideoCues((prev) => prev.map((c, i) => i === cueIdx ? { ...c, questions: [...c.questions, emptyQuestion()] } : c))
  }
  function removeCueQuestion(cueIdx: number, qIdx: number) {
    setVideoCues((prev) => prev.map((c, i) => {
      if (i !== cueIdx) return c
      return { ...c, questions: c.questions.filter((_, qi) => qi !== qIdx) }
    }))
  }
  function updateCueQuestion(cueIdx: number, qIdx: number, patch: Partial<Question>) {
    setVideoCues((prev) => prev.map((c, i) => {
      if (i !== cueIdx) return c
      const qs = c.questions.map((q, qi) => {
        if (qi !== qIdx) return q
        const updated = { ...q, ...patch }
        if (patch.type === "true_false") { updated.options = ["True", "False"]; updated.correctAnswer = "" }
        else if (patch.type === "mcq" && q.type !== "mcq") { updated.options = ["", "", "", ""]; updated.correctAnswer = "" }
        else if (patch.type === "short_answer") { updated.options = [] }
        return updated
      })
      return { ...c, questions: qs }
    }))
  }
  function updateCueQuestionOption(cueIdx: number, qIdx: number, optIdx: number, val: string) {
    setVideoCues((prev) => prev.map((c, i) => {
      if (i !== cueIdx) return c
      const qs = c.questions.map((q, qi) => {
        if (qi !== qIdx) return q
        const opts = [...q.options]; opts[optIdx] = val
        return { ...q, options: opts }
      })
      return { ...c, questions: qs }
    }))
  }

  async function handleSaveVideoCues() {
    setSavingCues(true)
    const result = await saveVideoCues(lesson.id, videoCues)
    if (result.error) toast.error(result.error)
    else toast.success("Video quiz cues saved")
    setSavingCues(false)
  }

  // --- Video file selection with auto-compression ---
  async function handleVideoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    if (!f) { setUploadFile(null); return }

    if (f.size > MAX_VIDEO_INPUT_MB * 1024 * 1024) {
      toast.error(`File is ${(f.size / 1024 / 1024).toFixed(1)} MB — exceeds the ${MAX_VIDEO_INPUT_MB} MB limit.`)
      e.target.value = ""
      return
    }

    setUploadProgress(0)

    if (f.size >= COMPRESS_THRESHOLD_MB * 1024 * 1024) {
      setCompressing(true)
      setCompressionProgress(0)
      toast.info("Video is over 100 MB — compressing before upload…")
      try {
        const { compressVideoIfNeeded } = await import("@/lib/compress-video")
        const compressed = await compressVideoIfNeeded(f, setCompressionProgress)
        setUploadFile(compressed)
        setCompressionProgress(100)
        toast.success(`Compressed to ${(compressed.size / 1024 / 1024).toFixed(1)} MB — ready to upload`)
      } catch (err) {
        toast.error("Compression failed: " + (err instanceof Error ? err.message : "Unknown error"))
        e.target.value = ""
        setUploadFile(null)
      } finally {
        setCompressing(false)
      }
    } else {
      setUploadFile(f)
    }
  }

  // --- Cloudinary chunked upload ---
  async function handleUploadVideo() {
    if (!uploadFile) return

    setUploading(true)
    setUploadProgress(0)

    try {
      const signRes = await fetch("/api/video/sign")
      if (!signRes.ok) throw new Error("Failed to get upload credentials")
      const { cloudName, apiKey, timestamp, signature, folder } = await signRes.json() as {
        cloudName: string; apiKey: string; timestamp: number; signature: string; folder: string
      }

      const CHUNK_SIZE = 5 * 1024 * 1024 // 5 MB per chunk
      const totalSize = uploadFile.size
      const totalChunks = Math.ceil(totalSize / CHUNK_SIZE)
      const uniqueUploadId = `lff-${Date.now()}-${Math.random().toString(36).slice(2)}`
      let secureUrl = ""

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, totalSize)
        const chunk = uploadFile.slice(start, end)

        await new Promise<void>((resolve, reject) => {
          const fd = new FormData()
          fd.append("file", chunk, uploadFile.name)
          fd.append("api_key", apiKey)
          fd.append("timestamp", String(timestamp))
          fd.append("signature", signature)
          fd.append("folder", folder)

          const xhr = new XMLHttpRequest()
          xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`)
          xhr.setRequestHeader("X-Unique-Upload-Id", uniqueUploadId)
          xhr.setRequestHeader("Content-Range", `bytes ${start}-${end - 1}/${totalSize}`)

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const overall = ((i + e.loaded / e.total) / totalChunks) * 100
              setUploadProgress(Math.round(overall))
            }
          }

          xhr.onload = () => {
            if (xhr.status === 200) {
              const data = JSON.parse(xhr.responseText) as { secure_url?: string }
              if (data.secure_url) secureUrl = data.secure_url
              setUploadProgress(Math.round(((i + 1) / totalChunks) * 100))
              resolve()
            } else {
              reject(new Error(`Chunk ${i + 1} failed: ${xhr.statusText}`))
            }
          }
          xhr.onerror = () => reject(new Error("Network error during upload"))
          xhr.send(fd)
        })
      }

      if (!secureUrl) throw new Error("Upload completed but no URL was returned")

      const result = await saveLessonVideoUrl(lesson.id, secureUrl)
      if (result.error) {
        toast.error(result.error)
      } else {
        setCurrentVideoUrl(secureUrl)
        setUploadFile(null)
        toast.success("Video uploaded and saved!")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    }

    setUploading(false)
    setUploadProgress(0)
  }

  async function handleSavePastedUrl() {
    const url = pasteUrlInput.trim()
    if (!url) return
    setSavingUrl(true)
    const result = await saveLessonVideoUrl(lesson.id, url)
    if (result.error) {
      toast.error(result.error)
    } else {
      setCurrentVideoUrl(url)
      setPasteUrlInput("")
      toast.success("Video URL saved!")
    }
    setSavingUrl(false)
  }

  async function handleSaveStudentNotes() {
    setSavingNotes(true)
    const result = await saveLessonStudentNotes(lesson.id, studentNotes)
    if (result.error) toast.error(result.error)
    else toast.success("Student notes saved")
    setSavingNotes(false)
  }

  const isCloudinaryUrl = currentVideoUrl.includes("cloudinary.com")
  const youtubeEmbedId = !isCloudinaryUrl ? extractYouTubeId(currentVideoUrl) : ""

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Breadcrumb */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <Link href="/teacher/courses" className="hover:underline">Courses</Link>
          <ChevronRight className="h-3 w-3" />
          <Link href={`/teacher/courses/${lesson.courseId}`} className="hover:underline">Course</Link>
          <ChevronRight className="h-3 w-3" />
          <Link href={`/teacher/courses/${lesson.courseId}/modules/${lesson.moduleId}`} className="hover:underline">Module</Link>
          <ChevronRight className="h-3 w-3" />
          <span>{lesson.title}</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">{lesson.title}</h1>
          <Badge variant={lesson.isPublished ? "default" : "secondary"}>
            {lesson.isPublished ? "Published" : "Draft"}
          </Badge>
          <Badge variant="outline" className="gap-1">
            {lesson.lessonType === "video" ? <Video className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
            {lesson.lessonType === "video" ? "Video Lesson" : "Text Lesson"}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue={lesson.lessonType === "video" ? "video" : "content"}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="content" className="gap-2">
            <FileText className="h-4 w-4" />Content
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-2">
            <FileText className="h-4 w-4" />Student Notes
          </TabsTrigger>
          {lesson.lessonType === "video" && (
            <>
              <TabsTrigger value="video" className="gap-2">
                <Video className="h-4 w-4" />Video
              </TabsTrigger>
              <TabsTrigger value="cues" className="gap-2">
                <Clock className="h-4 w-4" />In-Video Quizzes
              </TabsTrigger>
            </>
          )}
          <TabsTrigger value="test" className="gap-2">
            <FileText className="h-4 w-4" />Lesson Test
          </TabsTrigger>
        </TabsList>

        {/* ── CONTENT TAB ── */}
        <TabsContent value="content" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lesson Content</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{lesson.content}</pre>
              </div>
              {!lesson.content && (
                <p className="text-sm text-muted-foreground italic">No text content. Edit the lesson from the module page to add content.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── STUDENT NOTES TAB ── */}
        <TabsContent value="notes" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes For Students</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Add additional notes, reminders, and key takeaways students should see while studying this lesson.
              </p>
              <Textarea
                value={studentNotes}
                onChange={(e) => setStudentNotes(e.target.value)}
                rows={8}
                placeholder="Write notes for students..."
              />
              <Button onClick={handleSaveStudentNotes} disabled={savingNotes}>
                {savingNotes ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Notes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── VIDEO TAB ── */}
        {lesson.lessonType === "video" && (
          <TabsContent value="video" className="mt-6 space-y-6">
            {/* Current video preview */}
            {currentVideoUrl && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Current Video</CardTitle>
                </CardHeader>
                <CardContent>
                  {isCloudinaryUrl ? (
                    <div className="aspect-video rounded-md overflow-hidden border bg-black">
                      <video src={currentVideoUrl.includes("/video/upload/") && !currentVideoUrl.includes("c_limit,") 
                        ? currentVideoUrl.replace("/video/upload/", "/video/upload/c_limit,w_1280,h_720,q_auto,vc_auto/")
                        : currentVideoUrl} controls className="w-full h-full" controlsList="nodownload" />
                    </div>
                  ) : youtubeEmbedId ? (
                    <div className="aspect-video rounded-md overflow-hidden border">
                      <iframe
                        src={`https://www.youtube.com/embed/${youtubeEmbedId}`}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <a href={currentVideoUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all">
                      {currentVideoUrl}
                    </a>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Upload new video to Cloudinary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Upload Video
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Upload a video file — it will be stored in Cloudinary and saved automatically.
                  Max size: <span className="font-medium">{MAX_VIDEO_INPUT_MB} MB</span> (auto-compressed if over 100 MB).
                </p>
                <div className="space-y-2">
                  <Label>Select Video File</Label>
                  <Input
                    type="file"
                    accept="video/mp4,video/mpeg,video/quicktime,video/x-msvideo,video/webm"
                    onChange={handleVideoFileChange}
                    disabled={uploading || compressing}
                  />
                  <p className="text-xs text-muted-foreground">Supported: MP4, MOV, AVI, WebM. Max {MAX_VIDEO_INPUT_MB} MB.</p>
                </div>

                {uploadFile && !uploading && !compressing && (
                  <p className="text-sm text-muted-foreground">
                    Selected: <span className="font-medium">{uploadFile.name}</span> ({(uploadFile.size / 1024 / 1024).toFixed(1)} MB)
                  </p>
                )}

                {compressing && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Compressing…
                      </span>
                      <span>{compressionProgress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-amber-500 transition-all duration-300 rounded-full"
                        style={{ width: `${compressionProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {uploading && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Uploading in background…</span>
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

                <Button
                  onClick={handleUploadVideo}
                  disabled={!uploadFile || uploading || compressing}
                  className="w-full sm:w-auto"
                >
                  {uploading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading… {uploadProgress}%</>
                  ) : compressing ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Compressing…</>
                  ) : (
                    <><Upload className="mr-2 h-4 w-4" />Upload Video</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Or paste a URL */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  Or Paste a Video URL
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Paste a YouTube or external video URL to use instead of uploading a file.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={pasteUrlInput}
                    onChange={(e) => setPasteUrlInput(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... or https://..."
                    disabled={savingUrl}
                  />
                  <Button onClick={handleSavePastedUrl} disabled={!pasteUrlInput.trim() || savingUrl} className="shrink-0">
                    {savingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── IN-VIDEO QUIZZES TAB ── */}
        {lesson.lessonType === "video" && (
          <TabsContent value="cues" className="mt-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">In-Video Quiz Cues</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Add quiz questions that pause the video at specific timestamps. Students must answer before continuing.
              </p>

              {videoCues.length === 0 && (
                <Card>
                  <CardContent className="py-10 text-center text-muted-foreground text-sm">
                    No quiz cues yet. Click &quot;Add Cue&quot; to create one.
                  </CardContent>
                </Card>
              )}

              <div className="space-y-4">
                {videoCues.map((cue, cueIdx) => (
                  <Card key={cueIdx} className="border-primary/30">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Timestamp (seconds)</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={0}
                                className="w-24"
                                value={cue.timestamp}
                                onChange={(e) => updateCue(cueIdx, { timestamp: Number(e.target.value) })}
                              />
                              <span className="text-xs text-muted-foreground">{formatTimestamp(cue.timestamp)}</span>
                            </div>
                          </div>
                          <div className="flex-1 min-w-40 space-y-1">
                            <Label className="text-xs text-muted-foreground">Cue Title</Label>
                            <Input
                              value={cue.title}
                              onChange={(e) => updateCue(cueIdx, { title: e.target.value })}
                              placeholder="e.g. Quick Check"
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCue(cueIdx)}
                          className="text-destructive hover:text-destructive shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {cue.questions.map((q, qIdx) => (
                        <QuestionEditor
                          key={qIdx}
                          index={qIdx}
                          question={q}
                          onUpdate={(patch) => updateCueQuestion(cueIdx, qIdx, patch)}
                          onUpdateOption={(optIdx, val) => updateCueQuestionOption(cueIdx, qIdx, optIdx, val)}
                          onRemove={() => removeCueQuestion(cueIdx, qIdx)}
                          canRemove={cue.questions.length > 1}
                        />
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addCueQuestion(cueIdx)}
                        className="w-full"
                      >
                        <Plus className="mr-2 h-4 w-4" />Add Question to Cue
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex gap-3 mt-4">
                <Button type="button" variant="outline" onClick={addCue} className="flex-1 sm:flex-none">
                  <Plus className="mr-2 h-4 w-4" />Add Cue
                </Button>
                <Button onClick={handleSaveVideoCues} disabled={savingCues} className="flex-1 sm:flex-none">
                  {savingCues ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Quiz Cues
                </Button>
              </div>
            </div>
          </TabsContent>
        )}

        {/* ── LESSON TEST TAB ── */}
        <TabsContent value="test" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-lg font-semibold">Lesson Test</h2>
              {lesson.test && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteTest}
                  disabled={deletingTest}
                  className="text-destructive hover:text-destructive"
                >
                  {deletingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="mr-2 h-4 w-4" />Delete Test</>}
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              This test appears at the end of the lesson. Students must pass it to mark the lesson complete.
            </p>

            <form onSubmit={handleSaveTest} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1 space-y-2">
                  <Label>Test Title</Label>
                  <Input value={testTitle} onChange={(e) => setTestTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Passing Score (%)</Label>
                  <Input type="number" min={1} max={100} value={passingScore} onChange={(e) => setPassingScore(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Max Attempts</Label>
                  <Input type="number" min={1} value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} />
                </div>
              </div>

              <div className="space-y-4">
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

              <Button type="button" variant="outline" onClick={addQuestion} className="w-full">
                <Plus className="mr-2 h-4 w-4" />Add Question
              </Button>
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {lesson.test ? "Update Test" : "Save Test"}
              </Button>
            </form>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Shared Question Editor ───────────────────────────────────────────────────

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
            <Textarea
              value={question.text}
              onChange={(e) => onUpdate({ text: e.target.value })}
              rows={2}
              placeholder="Enter question..."
            />
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
            <Label>Options</Label>
            {question.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={opt} onChange={(e) => onUpdateOption(i, e.target.value)} placeholder={`Option ${i + 1}`} />
                <input
                  type="radio"
                  name={`correct-${index}`}
                  checked={question.correctAnswer === opt && opt !== ""}
                  onChange={() => onUpdate({ correctAnswer: opt })}
                  title="Mark as correct"
                />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Click the radio button to mark the correct answer</p>
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
            <Input
              value={question.correctAnswer}
              onChange={(e) => onUpdate({ correctAnswer: e.target.value })}
              placeholder="Expected answer (used for auto-grading)"
            />
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

function extractYouTubeId(url: string): string {
  if (!url) return ""
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?]+)/)
  return match ? match[1] : url
}
