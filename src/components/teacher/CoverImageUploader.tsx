"use client"

import { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ImagePlus, Loader2, Pencil, Upload } from "lucide-react"
import { updateCourseCover } from "@/actions/course.actions"
import { cn } from "@/lib/utils"

const MAX_COVER_MB = 5

/**
 * Course cover banner. With no cover it renders a large, hard-to-miss upload
 * prompt; with a cover it shows the image with a "Change cover" control.
 */
export function CoverImageUploader({
  courseId,
  coverImageUrl,
  onUploaded,
}: {
  courseId: string
  coverImageUrl: string | null
  onUploaded?: (url: string) => void
}) {
  const router = useRouter()
  const [preview, setPreview] = useState<string | null>(coverImageUrl)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputId = `cover-upload-${courseId}`

  async function handleFile(file: File | undefined) {
    if (!file || uploading) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file (JPG, PNG or WebP).")
      return
    }
    if (file.size > MAX_COVER_MB * 1024 * 1024) {
      toast.error(`Image is larger than ${MAX_COVER_MB} MB. Please pick a smaller one.`)
      return
    }

    const previous = preview
    const localUrl = URL.createObjectURL(file)
    setPreview(localUrl)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.set("file", file)
      fd.set("folder", "lff-lms/covers")
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Upload failed")

      const result = await updateCourseCover(courseId, data.url)
      if (result.error) throw new Error(result.error)

      setPreview(data.url)
      onUploaded?.(data.url)
      toast.success("Cover image saved")
      router.refresh()
    } catch (err) {
      setPreview(previous)
      toast.error(err instanceof Error ? err.message : "Cover upload failed")
    } finally {
      URL.revokeObjectURL(localUrl)
      setUploading(false)
    }
  }

  const input = (
    <input
      id={inputId}
      type="file"
      accept="image/*"
      className="sr-only"
      disabled={uploading}
      onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = "" }}
    />
  )

  if (!preview) {
    return (
      <label
        htmlFor={inputId}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]) }}
        className={cn(
          "relative flex w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-all",
          dragOver
            ? "border-primary bg-primary/10 scale-[1.01]"
            : "border-amber-400/70 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 hover:border-primary/60 dark:from-amber-500/10 dark:via-orange-500/5 dark:to-rose-500/10"
        )}
      >
        <span className="absolute top-3 left-3 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          Missing
        </span>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm text-primary dark:bg-background">
          {uploading ? <Loader2 className="h-7 w-7 animate-spin" /> : <ImagePlus className="h-7 w-7" />}
        </div>
        <div>
          <p className="text-base font-semibold">{uploading ? "Uploading cover…" : "Add a cover image for your course"}</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            This is the first thing students see in the catalogue. Courses without one look unfinished.
          </p>
        </div>
        {!uploading && (
          <span className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm">
            <Upload className="h-4 w-4" />Choose image
          </span>
        )}
        <p className="text-xs text-muted-foreground">or drag &amp; drop · JPG, PNG, WebP · up to {MAX_COVER_MB} MB · 16:9 landscape works best</p>
        {input}
      </label>
    )
  }

  return (
    <div
      className="group relative w-full overflow-hidden rounded-2xl border bg-muted aspect-[16/5] max-h-64"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]) }}
    >
      <Image
        src={preview}
        alt="Course cover"
        fill
        sizes="(max-width: 1024px) 100vw, 1024px"
        className={cn("object-cover transition-opacity", uploading && "opacity-50")}
        unoptimized={preview.startsWith("blob:")}
        priority
      />
      {(uploading || dragOver) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-sm font-medium">
          {uploading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Uploading…</> : "Drop to replace cover"}
        </div>
      )}
      <label
        htmlFor={inputId}
        className="absolute bottom-3 right-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-900 shadow-sm backdrop-blur transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100"
      >
        <Pencil className="h-3.5 w-3.5" />Change cover
        {input}
      </label>
    </div>
  )
}
