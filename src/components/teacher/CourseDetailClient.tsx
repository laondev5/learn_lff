"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { toast } from "sonner"
import {
  BookOpen, ChevronRight, Eye, EyeOff, ImageIcon, Loader2,
  MoreHorizontal, Megaphone, Plus, Trash2, Pencil, Users, Settings
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  toggleCoursePublished, deleteCourse, updateCourse,
  createModule, toggleModulePublished, deleteModule,
} from "@/actions/course.actions"
import { Separator } from "@/components/ui/separator"
import { CourseQAClient, Question } from "@/components/shared/CourseQAClient"

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
   currentUserId 
 }: { 
   course: Course; 
   questions: Question[]; 
   currentUserId: string 
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
  const [addingModule, setAddingModule] = useState(false)

  async function handleTogglePublish() {
    setToggling(true)
    const result = await toggleCoursePublished(course.id)
    if (result.error) toast.error(result.error)
    else toast.success(result.isPublished ? "Course published" : "Course unpublished")
    setToggling(false)
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
        if (res.ok) { newCoverUrl = data.url; setCoverPreview(data.url) }
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
    if (result.error) toast.error(result.error)
    else { toast.success("Course updated"); setEditOpen(false); setCoverFile(null) }
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
      toast.success("Module added")
      setAddModuleOpen(false)
      setNewModuleTitle("")
      setNewModuleDesc("")
      router.refresh()
    }
    setAddingModule(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/teacher/courses" className="hover:underline">Courses</Link>
            <ChevronRight className="h-3 w-3" />
            <span>{course.title}</span>
          </div>
          {coverPreview && (
            <div className="w-full max-w-xs h-32 rounded-md overflow-hidden border bg-muted">
              <Image src={coverPreview} alt="Course cover" width={400} height={128} className="w-full h-full object-cover" />
            </div>
          )}
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleTogglePublish}
            disabled={toggling}
          >
            {toggling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : course.isPublished ? (
              <><EyeOff className="mr-2 h-4 w-4" />Unpublish</>
            ) : (
              <><Eye className="mr-2 h-4 w-4" />Publish</>
            )}
          </Button>

          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger render={<Button variant="outline" size="sm"><Pencil className="h-4 w-4" /></Button>} />
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
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <Separator />

      {/* Exam + Announcements link */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold">Modules</h2>
        <div className="flex gap-2 flex-wrap">
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
            <DialogContent>
              <DialogHeader><DialogTitle>Add Module</DialogTitle></DialogHeader>
              <form onSubmit={handleAddModule} className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    placeholder="e.g. Module 1: Introduction"
                    value={newModuleTitle}
                    onChange={(e) => setNewModuleTitle(e.target.value)}
                    disabled={addingModule}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Textarea
                    placeholder="Brief module overview..."
                    value={newModuleDesc}
                    onChange={(e) => setNewModuleDesc(e.target.value)}
                    rows={2}
                    disabled={addingModule}
                  />
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setAddModuleOpen(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1" disabled={addingModule || !newModuleTitle.trim()}>
                    {addingModule ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Module"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Modules list */}
      {course.modules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No modules yet. Add the first module to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {course.modules.map((mod) => (
            <ModuleCard key={mod.id} mod={mod} courseId={course.id} />
          ))}
        </div>
      )}

      <Separator className="my-10" />

      <CourseQAClient 
        courseId={course.id}
        initialQuestions={questions}
        currentUserId={currentUserId}
        userRole="teacher"
        isTeacherOfCourse={true}
      />
    </div>
  )
}

function ModuleCard({ mod, courseId }: { mod: Module; courseId: string }) {
  const router = useRouter()
  const [toggling, setToggling] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs font-medium text-muted-foreground shrink-0">
              Module {mod.order}
            </span>
            <CardTitle className="text-base truncate">{mod.title}</CardTitle>
            <Badge variant={mod.isPublished ? "default" : "secondary"} className="shrink-0 text-xs">
              {mod.isPublished ? "Published" : "Draft"}
            </Badge>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button asChild variant="ghost" size="sm">
              <Link href={`/teacher/courses/${courseId}/modules/${mod.id}`}>
                <ChevronRight className="h-4 w-4" />
              </Link>
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
      </CardHeader>
      {mod.lessons.length > 0 && (
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">
            {mod.lessons.length} lesson{mod.lessons.length !== 1 ? "s" : ""}
          </p>
        </CardContent>
      )}
    </Card>
  )
}
