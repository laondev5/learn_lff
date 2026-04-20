"use client"

import React, { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2, Calendar } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createLiveClass } from "@/actions/live-class.actions"
import { getTeacherCourses } from "@/actions/course.actions"

const schema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  courseId: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface CreateLiveClassDialogProps {
  children: React.ReactElement
}

export function CreateLiveClassDialog({ children }: CreateLiveClassDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [courses, setCourses] = useState<{ _id: string; title: string }[]>([])

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (open) {
      getTeacherCourses().then(setCourses)
    }
  }, [open])

  async function onSubmit(data: FormData) {
    setIsLoading(true)
    const formData = new FormData()
    formData.set("title", data.title)
    formData.set("description", data.description)
    formData.set("startTime", data.startTime)
    formData.set("endTime", data.endTime)
    if (data.courseId) formData.set("courseId", data.courseId)

    const result = await createLiveClass(formData)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Live class scheduled! Google Meet link generated.")
      setOpen(false)
      reset()
    }
    setIsLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Live Class</DialogTitle>
          <DialogDescription>
            Create a live class with an automatic Google Meet link.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="title">Class Title</Label>
            <Input id="title" placeholder="Advanced React Patterns" disabled={isLoading} {...register("title")} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Detailed description of the live class topics."
              disabled={isLoading}
              {...register("description")}
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="datetime-local"
                disabled={isLoading}
                {...register("startTime")}
              />
              {errors.startTime && <p className="text-xs text-destructive">{errors.startTime.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="datetime-local"
                disabled={isLoading}
                {...register("endTime")}
              />
              {errors.endTime && <p className="text-xs text-destructive">{errors.endTime.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Course (Optional)</Label>
            <Select
              onValueChange={(v) =>
                setValue(
                  "courseId",
                  typeof v === "string" ? (v === "none" ? undefined : v) : undefined
                )
              }
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Calendar className="h-4 w-4 mr-2" />}
              Schedule Class
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
