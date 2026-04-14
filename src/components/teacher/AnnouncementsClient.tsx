"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ChevronRight, Loader2, Megaphone, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createAnnouncement, deleteAnnouncement } from "@/actions/announcement.actions"

interface Announcement {
  id: string
  title: string
  content: string
  isPublished: boolean
  createdAt: string
}

interface Props {
  courseId: string
  courseTitle: string
  announcements: Announcement[]
}

export function AnnouncementsClient({ courseId, courseTitle, announcements: initial }: Props) {
  const [list, setList] = useState(initial)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    const fd = new FormData()
    fd.set("title", title)
    fd.set("content", content)
    const result = await createAnnouncement(courseId, fd)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Announcement posted")
      setList([
        {
          id: Date.now().toString(),
          title,
          content,
          isPublished: true,
          createdAt: new Date().toISOString(),
        },
        ...list,
      ])
      setTitle("")
      setContent("")
      setOpen(false)
    }
    setCreating(false)
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this announcement?")) return
    setDeletingId(id)
    const result = await deleteAnnouncement(id)
    if (result.error) toast.error(result.error)
    else { toast.success("Announcement deleted"); setList((prev) => prev.filter((a) => a.id !== id)) }
    setDeletingId(null)
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <Link href="/teacher/courses" className="hover:underline">Courses</Link>
          <ChevronRight className="h-3 w-3" />
          <Link href={`/teacher/courses/${courseId}`} className="hover:underline">{courseTitle}</Link>
          <ChevronRight className="h-3 w-3" />
          <span>Announcements</span>
        </div>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6" />
            Announcements
          </h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="sm" />}>
              <Plus className="mr-2 h-4 w-4" />
              New Announcement
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>New Announcement</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Announcement title"
                    disabled={creating}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Content</Label>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write your announcement..."
                    rows={5}
                    disabled={creating}
                  />
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1" disabled={creating || !title.trim() || !content.trim()}>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post Announcement"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No announcements yet. Click &quot;New Announcement&quot; to post one to your students.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((ann) => (
            <Card key={ann.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base">{ann.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(ann.createdAt).toLocaleDateString("en-US", {
                        year: "numeric", month: "long", day: "numeric",
                      })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    disabled={deletingId === ann.id}
                    onClick={() => handleDelete(ann.id)}
                  >
                    {deletingId === ann.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ann.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
