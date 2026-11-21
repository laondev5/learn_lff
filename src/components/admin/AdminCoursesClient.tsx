"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Award, BookOpen, Loader2, Pencil, Plus } from "lucide-react"
import { createAdminCourse, setAdminCoursePublished, updateAdminCourse, type getAdminCourses } from "@/actions/admin-course.actions"
import { CertificateDesignDialog } from "@/components/admin/CertificateDesignDialog"

type Data = Extract<Awaited<ReturnType<typeof getAdminCourses>>, { courses: unknown }>
type Teacher = Data["teachers"][number]
type AdminCourse = Data["courses"][number]

type Draft = { title: string; description: string; teacherId: string; isPaid: boolean; price: string }

const emptyDraft: Draft = { title: "", description: "", teacherId: "", isPaid: false, price: "0" }

export function AdminCoursesClient({ courses, teachers }: { courses: AdminCourse[]; teachers: Teacher[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<AdminCourse | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [busy, setBusy] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [certificateCourse, setCertificateCourse] = useState<AdminCourse | null>(null)

  function startCreate() {
    setEditing(null)
    setDraft({ ...emptyDraft, teacherId: teachers[0]?.id ?? "" })
    setOpen(true)
  }

  function startEdit(course: AdminCourse) {
    setEditing(course)
    setDraft({
      title: course.title,
      description: course.description,
      teacherId: course.teacherId || teachers[0]?.id || "",
      isPaid: course.isPaid,
      price: String(course.price),
    })
    setOpen(true)
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    const formData = new FormData()
    formData.set("title", draft.title)
    formData.set("description", draft.description)
    formData.set("teacherId", draft.teacherId)
    formData.set("isPaid", String(draft.isPaid))
    formData.set("price", draft.isPaid ? draft.price : "0")
    try {
      const result = editing ? await updateAdminCourse(editing.id, formData) : await createAdminCourse(formData)
      if ("error" in result && result.error) { toast.error(result.error); return }
      toast.success(editing ? "Course updated." : "Course created as a draft.")
      setOpen(false)
      router.refresh()
    } catch {
      toast.error("We could not save the course. Please retry.")
    } finally {
      setBusy(false)
    }
  }

  async function togglePublished(course: AdminCourse) {
    if (toggling) return
    setToggling(course.id)
    try {
      const result = await setAdminCoursePublished(course.id, !course.isPublished)
      if ("error" in result && result.error) toast.error(result.error)
      else { toast.success(course.isPublished ? "Course unpublished." : "Course published."); router.refresh() }
    } catch {
      toast.error("We could not change the publishing state.")
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Courses</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create courses, assign the teacher who owns the content, and control publishing and pricing.</p>
        </div>
        <Button onClick={startCreate} disabled={teachers.length === 0}>
          <Plus className="mr-2 h-4 w-4" /> New course
        </Button>
      </div>

      {teachers.length === 0 && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Add an active teacher under Users before creating a course.
        </p>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All courses ({courses.length})</CardTitle>
          <CardDescription>Modules and lessons are edited by the assigned teacher in their course workspace.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Pricing</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No courses yet.</TableCell></TableRow>
                ) : courses.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell className="max-w-64">
                      <p className="font-medium line-clamp-1">{course.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{course.description}</p>
                    </TableCell>
                    <TableCell className="text-sm">{course.teacherName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{course.modules} modules · {course.lessons} lessons</TableCell>
                    <TableCell className="text-sm">{course.students}</TableCell>
                    <TableCell>
                      <Badge variant={course.isPaid ? "outline" : "secondary"} className="text-xs">
                        {course.isPaid ? `Paid · ₦${course.price.toLocaleString()}` : "Free"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={course.isPublished ? "default" : "secondary"} className="text-xs">
                        {course.isPublished ? "Published" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => startEdit(course)}>
                          <Pencil className="mr-1 h-3 w-3" /> Edit
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setCertificateCourse(course)}>
                          <Award className="mr-1 h-3 w-3" /> Certificate
                        </Button>
                        <Button
                          variant={course.isPublished ? "secondary" : "default"}
                          size="sm"
                          className="h-7 text-xs"
                          disabled={toggling === course.id}
                          onClick={() => void togglePublished(course)}
                        >
                          {toggling === course.id ? <Loader2 className="h-3 w-3 animate-spin" /> : course.isPublished ? "Unpublish" : "Publish"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value) }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit course" : "Create a course"}</DialogTitle>
            <DialogDescription>New courses start as drafts. The assigned teacher adds modules and lessons.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-course-title">Title</Label>
              <Input id="admin-course-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} minLength={3} maxLength={160} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-course-description">Description</Label>
              <Textarea id="admin-course-description" rows={4} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} minLength={10} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-course-teacher">Teacher</Label>
              <select
                id="admin-course-teacher"
                value={draft.teacherId}
                onChange={(e) => setDraft({ ...draft, teacherId: e.target.value })}
                required
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="" disabled>Choose a teacher</option>
                {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name} · {teacher.email}</option>)}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="admin-course-access">Access</Label>
                <select
                  id="admin-course-access"
                  value={draft.isPaid ? "paid" : "free"}
                  onChange={(e) => setDraft({ ...draft, isPaid: e.target.value === "paid" })}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              {draft.isPaid && (
                <div className="space-y-2">
                  <Label htmlFor="admin-course-price">Price (NGN)</Label>
                  <Input id="admin-course-price" type="number" min={1} step={100} value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} required />
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Save changes" : "Create course"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {certificateCourse && (
        <CertificateDesignDialog
          courseId={certificateCourse.id}
          courseTitle={certificateCourse.title}
          onClose={() => setCertificateCourse(null)}
        />
      )}

      {courses.length === 0 && <p className="flex items-center gap-2 text-sm text-muted-foreground"><BookOpen className="h-4 w-4" /> Courses you create appear here and in the assigned teacher&apos;s workspace.</p>}
    </div>
  )
}
