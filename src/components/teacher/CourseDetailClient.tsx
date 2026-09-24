"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { toast } from "sonner"
import {
  AlertTriangle, ArrowRight, BookOpen, Check, ChevronRight, CircleDashed, ClipboardCheck,
  Eye, EyeOff, FileText, ImageIcon, Layers, Loader2, Megaphone, MessageCircle, MoreHorizontal, Pencil,
  Plus, Rocket, Settings, Trash2, Users,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  toggleCoursePublished, deleteCourse, updateCourse,
  createModule, toggleModulePublished, deleteModule, publishAllCourseContent, discardUnusedUpload,
} from "@/actions/course.actions"
import { CourseQAClient, Question } from "@/components/shared/CourseQAClient"
import { Stepper, VisibilityToggle, type StepItem } from "@/components/teacher/Stepper"
import { CoverImageUploader } from "@/components/teacher/CoverImageUploader"
import { cn } from "@/lib/utils"

interface Lesson {
  id: string
  title: string
  order: number
  isPublished: boolean
}

interface Module {
  id: string
  title: string
  description?: string
  order: number
  isPublished: boolean
  lessons: Lesson[]
}

interface Course {
  id: string
  title: string
  description: string
  coverImageUrl?: string | null
  isPaid: boolean
  price: number
  isPublished: boolean
  modules: Module[]
}

export function CourseDetailClient({
  course,
  questions,
  currentUserId,
  hasExam = false,
}: {
  course: Course
  questions: Question[]
  currentUserId: string
  hasExam?: boolean
}) {
  const router = useRouter()
  const [toggling, setToggling] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editTitle, setEditTitle] = useState(course.title)
  const [editDesc, setEditDesc] = useState(course.description)
  const [editIsPaid, setEditIsPaid] = useState(course.isPaid)
  const [editPrice, setEditPrice] = useState(String(course.price ?? 0))
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [coverPreview, setCoverPreview] = useState<string | null>(course.coverImageUrl ?? null)
  const [saving, setSaving] = useState(false)
  const [addModuleOpen, setAddModuleOpen] = useState(false)
  const [newModuleTitle, setNewModuleTitle] = useState("")
  const [newModuleDesc, setNewModuleDesc] = useState("")
  const [newModuleVisible, setNewModuleVisible] = useState(true)
  const [addingModule, setAddingModule] = useState(false)
  const [publishingAll, setPublishingAll] = useState(false)
  const [savedCover, setSavedCover] = useState<string | null>(course.coverImageUrl ?? null)
  const hasCover = !!savedCover
  const [activeTab, setActiveTab] = useState<"content" | "qa">("content")
  const unansweredCount = questions.filter((q) => !q.isResolved && q.answers.length === 0).length

  // Allow deep-linking to the Q&A tab (e.g. /teacher/courses/123#qa)
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (window.location.hash === "#qa") setActiveTab("qa")
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  function switchTab(tab: "content" | "qa") {
    setActiveTab(tab)
    history.replaceState(null, "", tab === "qa" ? "#qa" : window.location.pathname)
  }

  function openAddModule() {
    switchTab("content")
    setAddModuleOpen(true)
  }

  // ── Builder progress ──────────────────────────────────────────────────────
  const modules = course.modules
  const allLessons = modules.flatMap((m) => m.lessons)
  const modulesWithoutLessons = modules.filter((m) => m.lessons.length === 0)
  const draftModules = modules.filter((m) => !m.isPublished).length
  const draftLessons = allLessons.filter((l) => !l.isPublished).length

  const hasModules = modules.length > 0
  const lessonsDone = hasModules && modulesWithoutLessons.length === 0
  const builderSteps: StepItem[] = [
    { label: "Details", icon: FileText, complete: hasCover },
    { label: "Modules", icon: Layers, complete: hasModules },
    { label: "Lessons", icon: BookOpen, complete: lessonsDone },
    { label: "Final Exam", icon: ClipboardCheck, complete: hasExam, optional: true },
    { label: "Publish", icon: Rocket, complete: course.isPublished && draftModules + draftLessons === 0 },
  ]
  // First incomplete required step; the optional exam is suggested only once lessons exist
  const nextStep = !hasCover ? 0 : !hasModules ? 1 : !lessonsDone ? 2 : !hasExam ? 3 : 4
  const [focusStep, setFocusStep] = useState<number | null>(null)
  const shownStep = focusStep ?? nextStep
  const doneCount = builderSteps.filter((s) => s.complete).length

  function openCoverPicker() {
    window.scrollTo({ top: 0, behavior: "smooth" })
    document.getElementById(`cover-upload-${course.id}`)?.click()
  }

  async function handleTogglePublish() {
    if (!course.isPublished && !hasCover) {
      if (!confirm("Your course has no cover image, so it will look unfinished in the course catalogue. Publish anyway?")) return
    }
    if (!course.isPublished && allLessons.length === 0) {
      if (!confirm("This course has no lessons yet, so students will see an empty course. Publish anyway?")) return
    }
    setToggling(true)
    const result = await toggleCoursePublished(course.id)
    if (result.error) toast.error(result.error)
    else {
      toast.success(result.isPublished ? "Course published — students can now find it" : "Course unpublished")
      router.refresh()
    }
    setToggling(false)
  }

  const totalDrafts = draftModules + draftLessons
  const needsPublish = !course.isPublished || totalDrafts > 0

  /** One click: course + every draft module + every draft lesson. */
  async function handlePublishEverything() {
    const warnings: string[] = []
    if (!hasCover) warnings.push("• It has no cover image yet.")
    if (allLessons.length === 0) warnings.push("• It has no lessons yet, so students will see an empty course.")
    const summary = [
      !course.isPublished && "the course",
      draftModules > 0 && `${draftModules} module${draftModules !== 1 ? "s" : ""}`,
      draftLessons > 0 && `${draftLessons} lesson${draftLessons !== 1 ? "s" : ""}`,
    ].filter(Boolean).join(", ")
    const message = `This will publish ${summary} so students can see everything.` +
      (warnings.length ? `\n\nBefore you go live:\n${warnings.join("\n")}` : "") +
      "\n\nPublish everything now?"
    if (!confirm(message)) return

    setPublishingAll(true)
    const result = await publishAllCourseContent(course.id, { includeCourse: true })
    if (result.error) toast.error(result.error)
    else {
      toast.success("Everything is live!", {
        description: `${result.coursePublished ? "Course published" : "Course already live"} · ${result.modules} module(s) · ${result.lessons} lesson(s)`,
      })
      router.refresh()
    }
    setPublishingAll(false)
  }

  async function handlePublishAll() {
    setPublishingAll(true)
    const result = await publishAllCourseContent(course.id)
    if (result.error) toast.error(result.error)
    else {
      toast.success(`Published ${result.modules} module(s) and ${result.lessons} lesson(s)`)
      router.refresh()
    }
    setPublishingAll(false)
  }

  async function handleDelete() {
    if (!confirm("Delete this course and all its content? This cannot be undone.")) return
    setDeleting(true)
    const result = await deleteCourse(course.id)
    if (result.error) toast.error(result.error)
    else {
      toast.success("Course deleted")
      router.push("/teacher/courses")
    }
    setDeleting(false)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    let newCoverUrl: string | null = null

    // Upload cover image if one was selected
    if (coverFile) {
      setUploadingCover(true)
      const uploadFd = new FormData()
      uploadFd.set("file", coverFile)
      uploadFd.set("folder", "lff-lms/covers")
      try {
        const res = await fetch("/api/upload", { method: "POST", body: uploadFd })
        const data = await res.json()
        if (res.ok) { newCoverUrl = data.url; setCoverPreview(data.url); setSavedCover(data.url) }
        else toast.error("Cover upload failed: " + (data.error ?? "Unknown error"))
      } catch { toast.error("Cover upload failed") }
      setUploadingCover(false)
    }

    const fd = new FormData()
    fd.set("title", editTitle)
    fd.set("description", editDesc)
    fd.set("isPaid", String(editIsPaid))
    fd.set("price", editIsPaid ? editPrice : "0")
    if (newCoverUrl) fd.set("coverImageUrl", newCoverUrl)
    const result = await updateCourse(course.id, fd)
    if (result.error) {
      toast.error(result.error)
      if (newCoverUrl) discardUnusedUpload(newCoverUrl)
    } else { toast.success("Course updated"); setEditOpen(false); setCoverFile(null); router.refresh() }
    setSaving(false)
  }

  async function handleAddModule(e: React.FormEvent) {
    e.preventDefault()
    setAddingModule(true)
    const fd = new FormData()
    fd.set("title", newModuleTitle)
    fd.set("description", newModuleDesc)
    const result = await createModule(course.id, fd)
    if (result.error) toast.error(result.error)
    else {
      if (newModuleVisible && result.moduleId) await toggleModulePublished(result.moduleId)
      const moduleId = result.moduleId
      toast.success("Module added", {
        description: "Now add lessons to it.",
        action: moduleId
          ? { label: "Add lessons", onClick: () => router.push(`/teacher/courses/${course.id}/modules/${moduleId}`) }
          : undefined,
      })
      setAddModuleOpen(false)
      setNewModuleTitle("")
      setNewModuleDesc("")
      setNewModuleVisible(true)
      setFocusStep(null)
      router.refresh()
    }
    setAddingModule(false)
  }

  return (
    <div className="space-y-6">
      {/* Cover banner: impossible to miss when empty */}
      <CoverImageUploader
        key={savedCover ?? "no-cover"}
        courseId={course.id}
        coverImageUrl={savedCover}
        onUploaded={(url) => { setSavedCover(url); setCoverPreview(url) }}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/teacher/courses" className="hover:underline">Courses</Link>
            <ChevronRight className="h-3 w-3" />
            <span>{course.title}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{course.title}</h1>
            <Badge variant={course.isPublished ? "default" : "secondary"}>
              {course.isPublished ? "Published" : "Draft"}
            </Badge>
            <Badge variant={course.isPaid ? "default" : "outline"}>
              {course.isPaid ? `Paid - NGN ${course.price.toLocaleString()}` : "Free"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{course.description}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {needsPublish && (
            <Button
              size="sm"
              onClick={handlePublishEverything}
              disabled={publishingAll}
              title="Publish the course and all its modules and lessons at once"
            >
              {publishingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
              {course.isPublished ? `Publish ${totalDrafts} draft${totalDrafts !== 1 ? "s" : ""}` : "Publish everything"}
            </Button>
          )}
          {course.isPublished && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleTogglePublish}
              disabled={toggling}
            >
              {toggling ? <Loader2 className="h-4 w-4 animate-spin" /> : <><EyeOff className="mr-2 h-4 w-4" />Unpublish</>}
            </Button>
          )}

          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger render={<Button variant="outline" size="sm" title="Edit course details"><Pencil className="h-4 w-4" /></Button>} />
            <DialogContent>
              <DialogHeader><DialogTitle>Edit Course</DialogTitle></DialogHeader>
              <form onSubmit={handleEdit} className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} disabled={saving} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} disabled={saving} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Pricing</Label>
                    <Select value={editIsPaid ? "paid" : "free"} onValueChange={(v) => setEditIsPaid(v === "paid")} disabled={saving}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Price (NGN)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="100"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      disabled={saving || !editIsPaid}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Cover Image (optional)
                  </Label>
                  {coverPreview && (
                    <div className="w-full h-24 rounded-md overflow-hidden border">
                      <Image src={coverPreview} alt="Cover preview" width={400} height={96} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    disabled={saving || uploadingCover}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setCoverFile(file)
                        setCoverPreview(URL.createObjectURL(file))
                      }
                    }}
                  />
                  {uploadingCover && <p className="text-xs text-muted-foreground">Uploading cover...</p>}
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1" disabled={saving || uploadingCover}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="text-destructive hover:text-destructive"
            title="Delete course"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* ── STICKY TOOLBAR: tabs + quick "Add module", visible while scrolling ── */}
      {/* Negative top cancels <main>'s padding so the bar sits flush under the navbar */}
      <div className="sticky -top-4 md:-top-6 lg:-top-8 z-30 -mx-4 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        <div className="flex items-center gap-2">
          <div role="tablist" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {([
              { key: "content", label: "Course content", icon: Layers, badge: modules.length, highlight: false },
              { key: "qa", label: "Q&A", icon: MessageCircle, badge: unansweredCount > 0 ? unansweredCount : questions.length, highlight: unansweredCount > 0 },
            ] as const).map((tab) => {
              const selected = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => switchTab(tab.key)}
                  className={cn(
                    "relative flex shrink-0 items-center gap-2 px-3 py-3.5 text-sm font-semibold transition-colors",
                    selected ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[11px] leading-none",
                      tab.highlight ? "bg-amber-500 text-white" : selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}
                    title={tab.highlight ? `${unansweredCount} unanswered question${unansweredCount !== 1 ? "s" : ""}` : undefined}
                  >
                    {tab.highlight ? `${tab.badge} new` : tab.badge}
                  </span>
                  <span className={cn("absolute inset-x-2 bottom-0 h-0.5 rounded-full", selected ? "bg-foreground" : "bg-transparent")} />
                </button>
              )
            })}
          </div>
          {needsPublish && (
            <Button size="sm" variant="outline" onClick={handlePublishEverything} disabled={publishingAll} className="shrink-0" title="Publish the course and all modules & lessons">
              {publishingAll ? <Loader2 className="h-4 w-4 animate-spin sm:mr-1.5" /> : <Rocket className="h-4 w-4 sm:mr-1.5" />}
              <span className="hidden sm:inline">Publish all</span>
            </Button>
          )}
          <Button size="sm" onClick={openAddModule} className="shrink-0">
            <Plus className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Add Module</span>
          </Button>
        </div>
      </div>

      {activeTab === "content" && (
        <div className="space-y-6 animate-in fade-in-0 duration-200">
      {/* ── COURSE BUILDER ── */}
      <Card className="overflow-hidden border-primary/20">
        <div className="flex items-center justify-between gap-3 px-5 pt-5">
          <div>
            <h2 className="text-base font-semibold">Course Builder</h2>
            <p className="text-xs text-muted-foreground">
              {doneCount} of {builderSteps.length} steps complete · click any step to see what to do
            </p>
          </div>
          {focusStep !== null && focusStep !== nextStep && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setFocusStep(null)}>
              Back to next step
            </Button>
          )}
        </div>
        <CardContent className="pt-5 space-y-5">
          <Stepper steps={builderSteps} current={shownStep} onStepClick={setFocusStep} />

          <div key={shownStep} className="rounded-xl bg-muted/50 p-4 sm:p-5 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
            {shownStep === nextStep && (
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary mb-1">Your next step</p>
            )}

            {shownStep === 0 && (
              <GuideBlock
                title={hasCover ? "Course details" : "Add a cover image"}
                text={
                  hasCover
                    ? "Your title, description, pricing and cover image are set. You can update them any time."
                    : "Your course doesn't have a cover image yet. It's the first thing students see when browsing courses, so courses without one look unfinished."
                }
              >
                {!hasCover && (
                  <Button size="sm" onClick={openCoverPicker}>
                    <ImageIcon className="mr-2 h-4 w-4" />Upload cover image
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil className="mr-2 h-4 w-4" />Edit details
                </Button>
              </GuideBlock>
            )}

            {shownStep === 1 && (
              <GuideBlock
                title={hasModules ? `You have ${modules.length} module${modules.length !== 1 ? "s" : ""}` : "Add your first module"}
                text="Modules are the sections or chapters of your course (e.g. “Week 1: Introduction”). Each module holds one or more lessons."
              >
                <Button size="sm" onClick={() => setAddModuleOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />{hasModules ? "Add another module" : "Add first module"}
                </Button>
              </GuideBlock>
            )}

            {shownStep === 2 && (
              <GuideBlock
                title={
                  !hasModules
                    ? "Add a module first"
                    : lessonsDone
                      ? `${allLessons.length} lesson${allLessons.length !== 1 ? "s" : ""} across ${modules.length} module${modules.length !== 1 ? "s" : ""}`
                      : "Add lessons to your modules"
                }
                text="Lessons are where the teaching happens: a video or a written lesson, with optional notes, in-video quizzes and a lesson test."
              >
                {!hasModules ? (
                  <Button size="sm" onClick={() => setAddModuleOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />Add first module
                  </Button>
                ) : modulesWithoutLessons.length > 0 ? (
                  <div className="w-full space-y-2">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {modulesWithoutLessons.length} module{modulesWithoutLessons.length !== 1 ? "s have" : " has"} no lessons yet
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {modulesWithoutLessons.map((m) => (
                        <Button key={m.id} asChild size="sm" variant="outline">
                          <Link href={`/teacher/courses/${course.id}/modules/${m.id}`}>
                            <Plus className="mr-1.5 h-3.5 w-3.5" />Add lessons to “{m.title}”
                          </Link>
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Open any module below to add more lessons.</p>
                )}
              </GuideBlock>
            )}

            {shownStep === 3 && (
              <GuideBlock
                title={hasExam ? "Final exam is set up" : "Set up a final exam (optional)"}
                text="Students take the final exam after completing all modules. It's optional; skip it if your course doesn't need one."
              >
                <Button asChild size="sm" variant={hasExam ? "outline" : "default"}>
                  <Link href={`/teacher/courses/${course.id}/exam`}>
                    <ClipboardCheck className="mr-2 h-4 w-4" />{hasExam ? "Edit final exam" : "Create final exam"}
                  </Link>
                </Button>
                {!hasExam && (
                  <Button size="sm" variant="ghost" onClick={() => setFocusStep(4)}>
                    Skip, go to Publish <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                )}
              </GuideBlock>
            )}

            {shownStep === 4 && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold">{course.isPublished ? "Your course is live" : "Publish your course"}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Students only see content that is published: the course itself, <em>and</em> each module and lesson.
                  </p>
                </div>
                <ul className="space-y-2 text-sm">
                  <ChecklistItem done={hasCover}>
                    Cover image
                    {!hasCover && (
                      <button type="button" onClick={openCoverPicker} className="ml-2 text-xs font-medium text-primary hover:underline">
                        Upload now
                      </button>
                    )}
                  </ChecklistItem>
                  <ChecklistItem done={hasModules}>At least one module</ChecklistItem>
                  <ChecklistItem done={lessonsDone}>Every module has a lesson</ChecklistItem>
                  <ChecklistItem done={hasExam} optional>Final exam</ChecklistItem>
                  <ChecklistItem done={hasModules && draftModules + draftLessons === 0}>
                    All modules &amp; lessons visible to students
                    {draftModules + draftLessons > 0 && (
                      <span className="text-muted-foreground"> ({draftModules} module{draftModules !== 1 ? "s" : ""}, {draftLessons} lesson{draftLessons !== 1 ? "s" : ""} still in draft)</span>
                    )}
                  </ChecklistItem>
                  <ChecklistItem done={course.isPublished}>Course published</ChecklistItem>
                </ul>
                <div className="flex flex-wrap items-center gap-2">
                  {needsPublish && (
                    <Button onClick={handlePublishEverything} disabled={publishingAll}>
                      {publishingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                      Publish everything
                    </Button>
                  )}
                  {totalDrafts > 0 && !course.isPublished && (
                    <Button size="sm" variant="ghost" onClick={handlePublishAll} disabled={publishingAll}>
                      <Eye className="mr-2 h-4 w-4" />Only modules &amp; lessons
                    </Button>
                  )}
                  {!course.isPublished && (
                    <Button size="sm" variant="ghost" onClick={handleTogglePublish} disabled={toggling}>
                      {toggling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                      Only the course
                    </Button>
                  )}
                  {course.isPublished && (
                    <Button size="sm" variant="outline" onClick={handleTogglePublish} disabled={toggling}>
                      {toggling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <EyeOff className="mr-2 h-4 w-4" />}
                      Unpublish course
                    </Button>
                  )}
                </div>
                {needsPublish && (
                  <p className="text-xs text-muted-foreground">
                    <strong>Publish everything</strong> makes the course and all of its modules and lessons visible in one click.
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tools + Add module */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Modules</h2>
          <p className="text-xs text-muted-foreground">The sections of your course, in the order students will take them.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => { switchTab("qa"); window.scrollTo({ top: 0 }) }}>
            <MessageCircle className="mr-2 h-4 w-4" />
            Q&amp;A
            {unansweredCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold leading-4 text-white">{unansweredCount}</span>
            )}
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/teacher/courses/${course.id}/announcements`}>
              <Megaphone className="mr-2 h-4 w-4" />
              Announcements
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/teacher/courses/${course.id}/monitoring`}>
              <Users className="mr-2 h-4 w-4" />
              Monitoring & Grades
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/teacher/courses/${course.id}/exam`}>
              <BookOpen className="mr-2 h-4 w-4" />
              Final Exam
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/teacher/courses/${course.id}/settings`}>
              <Settings className="mr-2 h-4 w-4" />
              Course Settings
            </Link>
          </Button>
          <Dialog open={addModuleOpen} onOpenChange={setAddModuleOpen}>
            <DialogTrigger render={<Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Module</Button>} />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Module {modules.length + 1}</DialogTitle>
                <DialogDescription>A module is a section of your course. You&apos;ll add lessons to it next.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddModule} className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label htmlFor="module-title">Module title</Label>
                  <Input
                    id="module-title"
                    autoFocus
                    placeholder={`e.g. Module ${modules.length + 1}: Introduction`}
                    value={newModuleTitle}
                    onChange={(e) => setNewModuleTitle(e.target.value)}
                    disabled={addingModule}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="module-desc">Short description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Textarea
                    id="module-desc"
                    placeholder="What does this module cover?"
                    value={newModuleDesc}
                    onChange={(e) => setNewModuleDesc(e.target.value)}
                    rows={2}
                    disabled={addingModule}
                  />
                </div>
                <VisibilityToggle checked={newModuleVisible} onChange={setNewModuleVisible} disabled={addingModule} noun="module" />
                <div className="flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setAddModuleOpen(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1" disabled={addingModule || newModuleTitle.trim().length < 2}>
                    {addingModule ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Module"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Modules list */}
      {modules.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 flex flex-col items-center text-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium">No modules yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Start by adding a module. Think of it as a chapter; you&apos;ll put lessons inside it.
              </p>
            </div>
            <Button onClick={() => setAddModuleOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />Add first module
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {modules.map((mod, i) => (
            <ModuleCard key={mod.id} mod={mod} index={i} courseId={course.id} />
          ))}
          <button
            type="button"
            onClick={() => setAddModuleOpen(true)}
            className="w-full rounded-xl border-2 border-dashed py-4 text-sm font-medium text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />Add module {modules.length + 1}
          </button>
        </div>
      )}
        </div>
      )}

      {activeTab === "qa" && (
        <div className="animate-in fade-in-0 duration-200">
          <CourseQAClient
            courseId={course.id}
            initialQuestions={questions}
            currentUserId={currentUserId}
            userRole="teacher"
            isTeacherOfCourse={true}
          />
        </div>
      )}
    </div>
  )
}

function GuideBlock({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{text}</p>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

function ChecklistItem({ done, optional, children }: { done: boolean; optional?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      {done ? (
        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-3 w-3" />
        </span>
      ) : (
        <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <span className={cn(!done && "text-muted-foreground")}>
        {children}
        {optional && <span className="ml-1 text-xs text-muted-foreground">(optional)</span>}
      </span>
    </li>
  )
}

function ModuleCard({ mod, index, courseId }: { mod: Module; index: number; courseId: string }) {
  const router = useRouter()
  const [toggling, setToggling] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const moduleHref = `/teacher/courses/${courseId}/modules/${mod.id}`

  async function handleToggle() {
    setToggling(true)
    const result = await toggleModulePublished(mod.id)
    if (result.error) toast.error(result.error)
    else router.refresh()
    setToggling(false)
  }

  async function handleDelete() {
    if (!confirm("Delete this module and all its lessons?")) return
    setDeleting(true)
    const result = await deleteModule(mod.id)
    if (result.error) toast.error(result.error)
    else {
      toast.success("Module deleted")
      router.refresh()
    }
    setDeleting(false)
  }

  return (
    <Card className="transition-shadow hover:shadow-md">
      <div className="flex items-start gap-4 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={moduleHref} className="font-semibold hover:underline truncate">{mod.title}</Link>
            <Badge variant={mod.isPublished ? "default" : "secondary"} className="text-xs">
              {mod.isPublished ? "Published" : "Draft"}
            </Badge>
          </div>
          {mod.description && <p className="text-xs text-muted-foreground line-clamp-1">{mod.description}</p>}

          {mod.lessons.length === 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />No lessons yet
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {mod.lessons.slice(0, 6).map((l) => (
                <li key={l.id}>
                  <Link
                    href={`${moduleHref}/lessons/${l.id}`}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs hover:bg-muted transition-colors max-w-50",
                      !l.isPublished && "border-dashed text-muted-foreground"
                    )}
                    title={l.isPublished ? l.title : `${l.title} (draft)`}
                  >
                    <span className="truncate">{l.order}. {l.title}</span>
                  </Link>
                </li>
              ))}
              {mod.lessons.length > 6 && (
                <li className="text-xs text-muted-foreground self-center">+{mod.lessons.length - 6} more</li>
              )}
            </ul>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button asChild variant={mod.lessons.length === 0 ? "default" : "outline"} size="sm" className="hidden sm:inline-flex">
            <Link href={moduleHref}>
              {mod.lessons.length === 0 ? <><Plus className="mr-1.5 h-3.5 w-3.5" />Add lessons</> : <>Manage<ChevronRight className="ml-1 h-3.5 w-3.5" /></>}
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" className="sm:hidden">
            <Link href={moduleHref} aria-label="Open module"><ChevronRight className="h-4 w-4" /></Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" disabled={toggling || deleting} />}>
              {toggling || deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleToggle}>
                {mod.isPublished ? <><EyeOff className="mr-2 h-4 w-4" />Unpublish</> : <><Eye className="mr-2 h-4 w-4" />Publish</>}
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
