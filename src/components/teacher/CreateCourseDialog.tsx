"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createCourse } from "@/actions/course.actions"

const schema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  isPaid: z.enum(["free", "paid"]),
  price: z.number().min(0),
})

type CourseFormData = z.infer<typeof schema>

export function CreateCourseDialog({ children }: { children: React.ReactElement }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<CourseFormData>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", description: "", isPaid: "free", price: 0 },
  })
  const pricingMode = watch("isPaid")

  async function onSubmit(data: CourseFormData) {
    setLoading(true)
    const fd = new FormData()
    fd.set("title", data.title)
    fd.set("description", data.description)
    fd.set("isPaid", String(data.isPaid === "paid"))
    fd.set("price", data.isPaid === "paid" ? String(data.price) : "0")
    const result = await createCourse(fd)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Course created")
      setOpen(false)
      reset()
      router.push(`/teacher/courses/${result.courseId}`)
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Course</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="title">Course Title</Label>
            <Input id="title" placeholder="e.g. Introduction to Photography" disabled={loading} {...register("title")} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" placeholder="What will students learn?" rows={3} disabled={loading} {...register("description")} />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Pricing</Label>
              <Select
                defaultValue="free"
                onValueChange={(v) => setValue("isPaid", v as "free" | "paid")}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select pricing mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price (NGN)</Label>
              <Input
                id="price"
                type="number"
                min={0}
                step="100"
                placeholder="0"
                disabled={loading || pricingMode !== "paid"}
                {...register("price", { valueAsNumber: true })}
              />
              {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
