"use client"

import React, { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  ArrowLeft, ArrowRight, BadgeDollarSign, Check, Gift, ImageIcon, Loader2,
  Pencil, Rocket, Type, Upload, X,
} from "lucide-react"
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
import { createCourse, discardUnusedUpload } from "@/actions/course.actions"
import { Stepper, StepHint, type StepItem } from "@/components/teacher/Stepper"
import { cn } from "@/lib/utils"

const schema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  isPaid: z.enum(["free", "paid"]),
  price: z.number().min(0),
})

type CourseFormData = z.infer<typeof schema>

const STEPS: StepItem[] = [
  { label: "Basics", icon: Type },
  { label: "Cover", icon: ImageIcon },
  { label: "Pricing", icon: BadgeDollarSign },
  { label: "Review", icon: Rocket },
]

const MAX_COVER_MB = 5

export function CreateCourseDialog({ children }: { children: React.ReactElement }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingLabel, setLoadingLabel] = useState("")
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [coverWarning, setCoverWarning] = useState(false)
  const [skipCover, setSkipCover] = useState(false)
  const router = useRouter()

  const {
    register, handleSubmit, reset, watch, setValue, trigger, setError, clearErrors,
    formState: { errors },
  } = useForm<CourseFormData>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", description: "", isPaid: "free", price: 0 },
  })
  const values = watch()
  const isLast = step === STEPS.length - 1

  function resetAll() {
    reset()
    setStep(0)
    setCoverFile(null)
    if (coverPreview) URL.revokeObjectURL(coverPreview)
    setCoverPreview(null)
    setCoverWarning(false)
    setSkipCover(false)
  }

  function pickCover(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file (JPG, PNG or WebP).")
      return
    }
    if (file.size > MAX_COVER_MB * 1024 * 1024) {
      toast.error(`Image is larger than ${MAX_COVER_MB} MB. Please pick a smaller one.`)
      return
    }
    if (coverPreview) URL.revokeObjectURL(coverPreview)
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
    setCoverWarning(false)
  }

  function removeCover() {
    if (coverPreview) URL.revokeObjectURL(coverPreview)
    setCoverFile(null)
    setCoverPreview(null)
  }

  async function validateStep(index: number) {
    if (index === 0) return trigger(["title", "description"])
    if (index === 1 && !coverFile && !skipCover) {
      setCoverWarning(true)
      return false
    }
    if (index === 2) {
      if (values.isPaid === "paid" && !(values.price > 0)) {
        setError("price", { message: "Enter a price greater than 0 for a paid course" })
        return false
      }
      clearErrors("price")
      return true
    }
    return true
  }

  async function goNext() {
    if (await validateStep(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  async function goTo(index: number) {
    if (index <= step) return setStep(index)
    // Only allow jumping forward if every step before the target is valid
    for (let i = step; i < index; i++) {
      if (!(await validateStep(i))) return setStep(i)
    }
    setStep(index)
  }

  async function onSubmit(data: CourseFormData) {
    if (!isLast) return goNext()

    setLoading(true)
    let coverImageUrl = ""

    if (coverFile) {
      setLoadingLabel("Uploading cover…")
      const uploadFd = new FormData()
      uploadFd.set("file", coverFile)
      uploadFd.set("folder", "lff-lms/covers")
      try {
        const res = await fetch("/api/upload", { method: "POST", body: uploadFd })
        const json = await res.json()
        if (res.ok) coverImageUrl = json.url
        else toast.error("Cover upload failed: " + (json.error ?? "Unknown error") + ". You can add it later.")
      } catch {
        toast.error("Cover upload failed. You can add it later from the course page.")
      }
    }

    setLoadingLabel("Creating course…")
    const fd = new FormData()
    fd.set("title", data.title)
    fd.set("description", data.description)
    fd.set("isPaid", String(data.isPaid === "paid"))
    fd.set("price", data.isPaid === "paid" ? String(data.price) : "0")
    if (coverImageUrl) fd.set("coverImageUrl", coverImageUrl)
    const result = await createCourse(fd)
    if (result.error) {
      toast.error(result.error)
      if (coverImageUrl) discardUnusedUpload(coverImageUrl)
    } else {
      toast.success("Course created! Next, add your first module.")
      setOpen(false)
      resetAll()
      router.push(`/teacher/courses/${result.courseId}`)
    }
    setLoading(false)
    setLoadingLabel("")
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (loading) return
        setOpen(o)
        if (!o) resetAll()
      }}
    >
      <DialogTrigger render={children} />
      <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create a New Course</DialogTitle>
          <DialogDescription>
            We&apos;ll walk you through it in {STEPS.length} quick steps. You can change anything later.
          </DialogDescription>
        </DialogHeader>

        <Stepper steps={STEPS} current={step} onStepClick={loading ? undefined : goTo} className="mt-2 mb-2" />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div key={step} className="animate-in fade-in-0 slide-in-from-right-4 duration-300 space-y-4 min-h-55">
            {/* ── STEP 1: BASICS ── */}
            {step === 0 && (
              <>
                <div>
                  <h3 className="font-semibold text-base">What&apos;s your course about?</h3>
                  <p className="text-muted-foreground text-xs mt-0.5">Give it a clear name and a short summary students will see.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Course title</Label>
                  <Input
                    id="title"
                    autoFocus
                    placeholder="e.g. Foundations of Faith"
                    disabled={loading}
                    aria-invalid={!!errors.title}
                    {...register("title")}
                  />
                  {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="description">Description</Label>
                    <span className={cn("text-[11px]", values.description.length < 10 ? "text-muted-foreground" : "text-primary")}>
                      {values.description.length} characters{values.description.length < 10 && " (min 10)"}
                    </span>
                  </div>
                  <Textarea
                    id="description"
                    placeholder="What will students learn? Who is this course for?"
                    rows={4}
                    disabled={loading}
                    aria-invalid={!!errors.description}
                    {...register("description")}
                  />
                  {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
                </div>
                <StepHint>Tip: a good description answers &ldquo;what will I be able to do after this course?&rdquo;</StepHint>
              </>
            )}

            {/* ── STEP 2: COVER ── */}
            {step === 1 && (
              <>
                <div>
                  <h3 className="font-semibold text-base">Add a cover image</h3>
                  <p className="text-muted-foreground text-xs mt-0.5">This is the first thing students see when browsing courses. Courses with a cover get noticed.</p>
                </div>
                {coverPreview ? (
                  <div className="relative rounded-xl overflow-hidden border aspect-[16/7] bg-muted">
                    <Image src={coverPreview} alt="Cover preview" fill className="object-cover" unoptimized />
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-3">
                      <span className="text-xs text-white truncate">{coverFile?.name}</span>
                      <div className="flex gap-2 shrink-0">
                        <label htmlFor="cover-input" className="inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-gray-900 cursor-pointer hover:bg-white">
                          <Pencil className="h-3 w-3" /> Change
                        </label>
                        <button type="button" onClick={removeCover} className="inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-red-600 hover:bg-white">
                          <X className="h-3 w-3" /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <label
                    htmlFor="cover-input"
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); pickCover(e.dataTransfer.files?.[0]) }}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors aspect-[16/7]",
                      dragOver ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    )}
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Upload className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-medium">Drag an image here, or click to browse</p>
                    <p className="text-xs text-muted-foreground">JPG, PNG or WebP · up to {MAX_COVER_MB} MB · landscape works best</p>
                  </label>
                )}
                <input
                  id="cover-input"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => { pickCover(e.target.files?.[0]); e.target.value = "" }}
                />
                {coverWarning && !coverFile && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/40 dark:bg-amber-500/10 animate-in fade-in-0 slide-in-from-top-1">
                    <p className="font-medium text-amber-800 dark:text-amber-300">You haven&apos;t added a cover image</p>
                    <p className="mt-0.5 text-xs text-amber-700/90 dark:text-amber-300/80">
                      Without one, your course shows a plain placeholder to students. You can still add it later from the course page, and we&apos;ll remind you.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <label htmlFor="cover-input" className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
                        <Upload className="h-3.5 w-3.5" />Choose an image
                      </label>
                      <button
                        type="button"
                        onClick={() => { setSkipCover(true); setCoverWarning(false); setStep(2) }}
                        className="rounded-md px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-500/20"
                      >
                        Continue without cover
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── STEP 3: PRICING ── */}
            {step === 2 && (
              <>
                <div>
                  <h3 className="font-semibold text-base">How will students access it?</h3>
                  <p className="text-muted-foreground text-xs mt-0.5">Choose whether the course is free or requires payment.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([
                    { value: "free", icon: Gift, title: "Free", desc: "Anyone enrolled can start right away." },
                    { value: "paid", icon: BadgeDollarSign, title: "Paid", desc: "Students pay once before they can start." },
                  ] as const).map((opt) => {
                    const selected = values.isPaid === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={loading}
                        onClick={() => {
                          setValue("isPaid", opt.value)
                          if (opt.value === "free") { setValue("price", 0); clearErrors("price") }
                        }}
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
                {values.isPaid === "paid" && (
                  <div className="space-y-2 animate-in fade-in-0 slide-in-from-top-2 duration-200">
                    <Label htmlFor="price">Price (NGN)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₦</span>
                      <Input
                        id="price"
                        type="number"
                        min={0}
                        step="100"
                        placeholder="5000"
                        className="pl-7"
                        autoFocus
                        disabled={loading}
                        aria-invalid={!!errors.price}
                        {...register("price", { valueAsNumber: true })}
                      />
                    </div>
                    {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
                  </div>
                )}
              </>
            )}

            {/* ── STEP 4: REVIEW ── */}
            {step === 3 && (
              <>
                <div>
                  <h3 className="font-semibold text-base">Ready to create?</h3>
                  <p className="text-muted-foreground text-xs mt-0.5">Check the details below. Your course starts as a <strong>draft</strong>; students won&apos;t see it until you publish.</p>
                </div>
                <div className="rounded-xl border overflow-hidden">
                  {coverPreview && (
                    <div className="relative aspect-[16/6] bg-muted">
                      <Image src={coverPreview} alt="Cover" fill className="object-cover" unoptimized />
                    </div>
                  )}
                  <dl className="divide-y text-sm">
                    <ReviewRow label="Title" onEdit={() => setStep(0)}>{values.title}</ReviewRow>
                    <ReviewRow label="Description" onEdit={() => setStep(0)}>
                      <span className="line-clamp-3 whitespace-pre-line">{values.description}</span>
                    </ReviewRow>
                    <ReviewRow label="Cover" onEdit={() => setStep(1)}>
                      {coverFile ? coverFile.name : <span className="text-amber-700 dark:text-amber-400">Missing, add it before publishing</span>}
                    </ReviewRow>
                    <ReviewRow label="Pricing" onEdit={() => setStep(2)}>
                      {values.isPaid === "paid" ? `Paid · ₦${Number(values.price || 0).toLocaleString()}` : "Free"}
                    </ReviewRow>
                  </dl>
                </div>
                <StepHint>
                  <strong>What happens next:</strong> you&apos;ll add modules (sections), then lessons inside each module, then an optional final exam, and finally publish.
                </StepHint>
              </>
            )}
          </div>

          {/* Footer navigation */}
          <div className="flex items-center gap-3 pt-2 border-t">
            {step > 0 ? (
              <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={loading}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
              </Button>
            ) : (
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
                Cancel
              </Button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button type="submit" disabled={loading} className="min-w-32">
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{loadingLabel}</>
                ) : isLast ? (
                  <><Rocket className="mr-1.5 h-4 w-4" />Create Course</>
                ) : (
                  <>Continue <ArrowRight className="ml-1.5 h-4 w-4" /></>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ReviewRow({ label, children, onEdit }: { label: string; children: React.ReactNode; onEdit: () => void }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <dt className="w-24 shrink-0 text-xs font-medium text-muted-foreground pt-0.5">{label}</dt>
      <dd className="flex-1 min-w-0 wrap-break-word">{children}</dd>
      <button type="button" onClick={onEdit} className="shrink-0 text-xs font-medium text-primary hover:underline">
        Edit
      </button>
    </div>
  )
}
