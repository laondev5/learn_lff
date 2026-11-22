"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ImagePlus,
  Layers,
  LayoutTemplate,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  Save,
  Signature,
  Trash2,
  Type,
} from "lucide-react"
import { toast } from "sonner"
import { getCourseCertificateTemplate, saveCourseCertificateTemplate, type CourseTemplate } from "@/actions/admin-certificate.actions"
import { CertificatePreview } from "@/components/certificate/CertificatePreview"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DEFAULT_LAYOUT,
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  newBlockId,
  removeBlock,
  updateBlock,
  type CertificateBlock,
  type CertificateLayout,
  type CertificateTextField,
  type DividerBlock,
  type LogoBlock,
  type SignatureBlock,
  type TextBlock,
} from "@/lib/certificate-layout"
import { applyTemplate, CERTIFICATE_TEMPLATES, type CertificateTemplate } from "@/lib/certificate-templates"

const MAX_LOGOS = 6
const MAX_SIGNATURES = 6

const FIELD_LABELS: Record<CertificateTextField, string> = {
  institution: "Institution",
  title: "Certificate heading",
  presentedTo: "Intro line",
  studentName: "Student name",
  completedText: "Completion line",
  courseTitle: "Course title",
  serial: "Certificate ID",
  date: "Issue date",
  custom: "Custom text",
}

function blockLabel(block: CertificateBlock): string {
  if (block.type === "text") return FIELD_LABELS[block.field]
  if (block.type === "logo") return "Logo"
  if (block.type === "signature") return block.name ? `Signature · ${block.name}` : "Signature"
  return "Divider"
}

function blockIcon(block: CertificateBlock) {
  if (block.type === "text") return Type
  if (block.type === "logo") return ImagePlus
  if (block.type === "signature") return Signature
  return Minus
}

function NumberField({
  label, value, min, max, step = 1, onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        className="h-8"
        onChange={(event) => {
          const parsed = Number(event.target.value)
          if (Number.isFinite(parsed)) onChange(Math.min(max, Math.max(min, parsed)))
        }}
      />
    </div>
  )
}

export function CertificateDesigner({ courses, initialCourseId }: { courses: { id: string; title: string; hasTemplate: boolean }[]; initialCourseId?: string }) {
  const [courseId, setCourseId] = useState(
    initialCourseId && courses.some((course) => course.id === initialCourseId) ? initialCourseId : courses[0]?.id ?? "",
  )
  const [design, setDesign] = useState<CourseTemplate | null>(null)
  const [layout, setLayout] = useState<CertificateLayout | null>(null)
  const [templateId, setTemplateId] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTargetRef = useRef<string | null>(null)

  const load = useCallback(async (id: string) => {
    if (!id) return
    setLoading(true)
    setSelectedId(null)
    try {
      const result = await getCourseCertificateTemplate(id)
      if ("error" in result) throw new Error(result.error)
      setDesign(result)
      setLayout(result.layout ?? null)
      setTemplateId(result.templateId)
      setDirty(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to load this certificate.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load(courseId) }, [courseId, load])

  const course = useMemo(() => courses.find((entry) => entry.id === courseId), [courses, courseId])
  const content = useMemo(() => ({
    institutionName: design?.institutionName || "Living Faith Foundation",
    title: design?.title || "Certificate of Completion",
    studentName: "Amara Chinedu",
    courseTitle: course?.title ?? "Course title",
    serial: "LFF-2026-8F3A21C4",
    date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
  }), [design?.institutionName, design?.title, course?.title])

  const currentLogos = useMemo(
    () => (layout?.blocks ?? []).filter((b): b is LogoBlock => b.type === "logo" && !!b.url).map((b) => ({ url: b.url })),
    [layout],
  )
  const currentSignatures = useMemo(
    () => (layout?.blocks ?? [])
      .filter((b): b is SignatureBlock => b.type === "signature" && (!!b.url || !!b.name))
      .map((b) => ({ name: b.name, role: b.role, url: b.url })),
    [layout],
  )

  const selected = layout?.blocks.find((block) => block.id === selectedId) ?? null

  function mutate(next: CertificateLayout) {
    setLayout(next)
    setDirty(true)
  }

  function patch(id: string, change: Partial<CertificateBlock>) {
    if (!layout) return
    mutate(updateBlock(layout, id, change))
  }

  function apply(template: CertificateTemplate) {
    const next = applyTemplate(template, currentLogos, currentSignatures)
    setLayout(next)
    setTemplateId(template.id)
    setDirty(true)
    setGalleryOpen(false)
    toast.success(`${template.name} applied. Drag anything to fine-tune it.`)
  }

  function addBlock(kind: "text" | "logo" | "signature" | "divider") {
    if (!layout) return
    const count = layout.blocks.length
    const base = { id: newBlockId() }

    if (kind === "logo") {
      if (currentLogos.length >= MAX_LOGOS) { toast.error(`Up to ${MAX_LOGOS} logos per certificate.`); return }
      const block: LogoBlock = { ...base, type: "logo", url: "", x: 60 + (count % 4) * 110, y: 590, width: 100, height: 50 }
      mutate({ ...layout, blocks: [...layout.blocks, block] })
      setSelectedId(block.id)
      return
    }
    if (kind === "signature") {
      const signatures = layout.blocks.filter((b) => b.type === "signature").length
      if (signatures >= MAX_SIGNATURES) { toast.error(`Up to ${MAX_SIGNATURES} signatures per certificate.`); return }
      const block: SignatureBlock = { ...base, type: "signature", url: "", name: "", role: "Authorized Signature", x: 60 + (signatures % 3) * 240, y: 540, width: 200, color: "#333333" }
      mutate({ ...layout, blocks: [...layout.blocks, block] })
      setSelectedId(block.id)
      return
    }
    if (kind === "divider") {
      const block: DividerBlock = { ...base, type: "divider", x: 340, y: 450, width: 320, thickness: 2, color: "#c9a84c" }
      mutate({ ...layout, blocks: [...layout.blocks, block] })
      setSelectedId(block.id)
      return
    }
    const block: TextBlock = {
      ...base, type: "text", field: "custom", text: "New text", x: 100, y: 440, width: 500,
      fontSize: 18, fontWeight: "normal", color: "#1f2937", align: "center", fontFamily: "sans",
    }
    mutate({ ...layout, blocks: [...layout.blocks, block] })
    setSelectedId(block.id)
  }

  function pickImage(blockId: string) {
    uploadTargetRef.current = blockId
    fileInputRef.current?.click()
  }

  async function handleFile(file: File) {
    const blockId = uploadTargetRef.current
    if (!blockId) return
    if (!file.type.startsWith("image/")) { toast.error("Choose an image file."); return }
    if (file.size > 10 * 1024 * 1024) { toast.error("Images must be 10 MB or smaller."); return }
    setUploading(true)
    try {
      const body = new FormData()
      body.set("file", file)
      body.set("folder", "lff-lms/certificates")
      const response = await fetch("/api/upload", { method: "POST", body })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.url) throw new Error(json?.error ?? "Upload failed")
      patch(blockId, { url: json.url } as Partial<CertificateBlock>)
      toast.success("Image uploaded.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed. Please retry.")
    } finally {
      setUploading(false)
      uploadTargetRef.current = null
    }
  }

  async function save() {
    if (!layout || !design || saving) return
    setSaving(true)
    try {
      const logos = layout.blocks
        .filter((b): b is LogoBlock => b.type === "logo" && !!b.url)
        .map((b) => ({ url: b.url, alt: "" }))
      const signatures = layout.blocks
        .filter((b): b is SignatureBlock => b.type === "signature")
        .map((b) => ({ name: b.name, role: b.role, url: b.url }))

      const result = await saveCourseCertificateTemplate(design.courseId, {
        title: design.title,
        institutionName: design.institutionName,
        isEnabled: design.isEnabled,
        logos,
        signatures,
        layout,
        templateId,
      })
      if ("error" in result) throw new Error(result.error)
      setDirty(false)
      toast.success("Certificate design saved.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save the certificate design.")
    } finally {
      setSaving(false)
    }
  }

  if (courses.length === 0) {
    return <p className="rounded-xl border p-6 text-sm text-muted-foreground">Create a course before designing certificates.</p>
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void handleFile(file)
          event.target.value = ""
        }}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="designer-course" className="text-xs text-muted-foreground">Course</Label>
            <Select value={courseId} onValueChange={(value) => { if (value) { setCourseId(value); } }}>
              <SelectTrigger id="designer-course" className="h-9 w-72">
                <SelectValue>{course?.title ?? "Choose a course"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {courses.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.title}{entry.hasTemplate ? " · designed" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => setGalleryOpen(true)} disabled={!layout}>
            <LayoutTemplate /> Templates
          </Button>
          <Button
            variant="outline"
            onClick={() => { if (layout) { mutate(DEFAULT_LAYOUT); setTemplateId("classic-navy-gold"); } }}
            disabled={!layout}
          >
            <RotateCcw /> Reset canvas
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Unsaved changes</Badge>}
          <Button onClick={() => void save()} disabled={!layout || saving || !dirty}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />} Save design
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 rounded-xl border p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading certificate design…
        </p>
      ) : !layout || !design ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <LayoutTemplate className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">This course has no certificate design yet</p>
              <p className="text-sm text-muted-foreground">Start from one of the ten professional templates.</p>
            </div>
            <Button onClick={() => setGalleryOpen(true)}><LayoutTemplate /> Choose a template</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-3">
            <div className="rounded-xl border bg-muted/40 p-3">
              <CertificatePreview
                layout={layout}
                content={content}
                interactive
                selectedId={selectedId}
                onSelect={setSelectedId}
                onMove={(id, x, y) => {
                  const block = layout.blocks.find((entry) => entry.id === id)
                  if (!block) return
                  patch(id, {
                    x: Math.min(DESIGN_WIDTH - 20, Math.max(0, Math.round(x))),
                    y: Math.min(DESIGN_HEIGHT - 10, Math.max(0, Math.round(y))),
                  } as Partial<CertificateBlock>)
                }}
                className="rounded-lg shadow-sm ring-1 ring-black/5"
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="designer-title" className="text-xs text-muted-foreground">Certificate heading</Label>
                <Input
                  id="designer-title"
                  value={design.title}
                  maxLength={120}
                  onChange={(event) => { setDesign({ ...design, title: event.target.value }); setDirty(true) }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="designer-institution" className="text-xs text-muted-foreground">Institution issuing the certificate</Label>
                <Input
                  id="designer-institution"
                  value={design.institutionName}
                  maxLength={160}
                  onChange={(event) => { setDesign({ ...design, institutionName: event.target.value }); setDirty(true) }}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={design.isEnabled}
                onChange={(event) => { setDesign({ ...design, isEnabled: event.target.checked }); setDirty(true) }}
              />
              Issue certificates for this course
            </label>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => addBlock("text")}><Type className="h-3.5 w-3.5" /> Add text</Button>
              <Button variant="outline" size="sm" onClick={() => addBlock("logo")}><ImagePlus className="h-3.5 w-3.5" /> Add logo</Button>
              <Button variant="outline" size="sm" onClick={() => addBlock("signature")}><Signature className="h-3.5 w-3.5" /> Add signature</Button>
              <Button variant="outline" size="sm" onClick={() => addBlock("divider")}><Minus className="h-3.5 w-3.5" /> Add line</Button>
            </div>
          </div>

          <aside className="space-y-3">
            <Card className="gap-2">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm">Inspector</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!selected ? (
                  <p className="text-sm text-muted-foreground">
                    Select any element on the certificate to move, resize or restyle it. Drag with the mouse.
                  </p>
                ) : selected.type === "text" ? (
                  <>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">{blockLabel(selected)}</Badge>
                      <Button variant="ghost" size="icon" onClick={() => { mutate(removeBlock(layout, selected.id)); setSelectedId(null) }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {selected.field === "custom" && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Text</Label>
                        <Input value={selected.text ?? ""} onChange={(event) => patch(selected.id, { text: event.target.value })} />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <NumberField label="Font size" value={selected.fontSize} min={6} max={120} onChange={(value) => patch(selected.id, { fontSize: value })} />
                      <NumberField label="Letter spacing" value={selected.letterSpacing ?? 0} min={0} max={20} onChange={(value) => patch(selected.id, { letterSpacing: value })} />
                      <NumberField label="X" value={selected.x} min={0} max={DESIGN_WIDTH - 20} onChange={(value) => patch(selected.id, { x: value })} />
                      <NumberField label="Y" value={selected.y} min={0} max={DESIGN_HEIGHT - 10} onChange={(value) => patch(selected.id, { y: value })} />
                      <NumberField label="Width" value={selected.width} min={20} max={DESIGN_WIDTH} onChange={(value) => patch(selected.id, { width: value })} />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        variant={selected.fontWeight === "bold" ? "default" : "outline"} size="sm"
                        onClick={() => patch(selected.id, { fontWeight: selected.fontWeight === "bold" ? "normal" : "bold" })}
                      >
                        <strong>B</strong>
                      </Button>
                      <Button
                        variant={selected.italic ? "default" : "outline"} size="sm"
                        onClick={() => patch(selected.id, { italic: !selected.italic })}
                      >
                        <em>I</em>
                      </Button>
                      {(["left", "center", "right"] as const).map((align) => {
                        const Icon = align === "left" ? AlignLeft : align === "center" ? AlignCenter : AlignRight
                        return (
                          <Button
                            key={align}
                            variant={selected.align === align ? "default" : "outline"}
                            size="icon" className="h-8 w-8"
                            onClick={() => patch(selected.id, { align })}
                            aria-label={`Align ${align}`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </Button>
                        )
                      })}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Colour</Label>
                        <input
                          type="color"
                          value={selected.color}
                          onChange={(event) => patch(selected.id, { color: event.target.value })}
                          className="h-8 w-full rounded-md border bg-background"
                          aria-label="Text colour"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Typeface</Label>
                        <Select value={selected.fontFamily} onValueChange={(value) => patch(selected.id, { fontFamily: value === "sans" ? "sans" : "serif" })}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="serif">Serif</SelectItem>
                            <SelectItem value="sans">Sans-serif</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </>
                ) : selected.type === "logo" ? (
                  <>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">Logo</Badge>
                      <Button variant="ghost" size="icon" onClick={() => { mutate(removeBlock(layout, selected.id)); setSelectedId(null) }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button variant="outline" size="sm" className="w-full" disabled={uploading} onClick={() => pickImage(selected.id)}>
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                      {selected.url ? "Replace image" : "Upload image"}
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <NumberField label="Width" value={selected.width} min={20} max={600} onChange={(value) => patch(selected.id, { width: value })} />
                      <NumberField label="Height" value={selected.height} min={20} max={300} onChange={(value) => patch(selected.id, { height: value })} />
                      <NumberField label="X" value={selected.x} min={0} max={DESIGN_WIDTH - 20} onChange={(value) => patch(selected.id, { x: value })} />
                      <NumberField label="Y" value={selected.y} min={0} max={DESIGN_HEIGHT - 10} onChange={(value) => patch(selected.id, { y: value })} />
                    </div>
                  </>
                ) : selected.type === "signature" ? (
                  <>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">Signature</Badge>
                      <Button variant="ghost" size="icon" onClick={() => { mutate(removeBlock(layout, selected.id)); setSelectedId(null) }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Name</Label>
                      <Input value={selected.name} maxLength={120} onChange={(event) => patch(selected.id, { name: event.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Role</Label>
                      <Input value={selected.role} maxLength={120} onChange={(event) => patch(selected.id, { role: event.target.value })} />
                    </div>
                    <Button variant="outline" size="sm" className="w-full" disabled={uploading} onClick={() => pickImage(selected.id)}>
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                      {selected.url ? "Replace signature image" : "Upload signature image"}
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <NumberField label="Width" value={selected.width} min={60} max={600} onChange={(value) => patch(selected.id, { width: value })} />
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Colour</Label>
                        <input
                          type="color"
                          value={selected.color ?? "#333333"}
                          onChange={(event) => patch(selected.id, { color: event.target.value })}
                          className="h-8 w-full rounded-md border bg-background"
                          aria-label="Signature colour"
                        />
                      </div>
                      <NumberField label="X" value={selected.x} min={0} max={DESIGN_WIDTH - 60} onChange={(value) => patch(selected.id, { x: value })} />
                      <NumberField label="Y" value={selected.y} min={0} max={DESIGN_HEIGHT - 40} onChange={(value) => patch(selected.id, { y: value })} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">Divider</Badge>
                      <Button variant="ghost" size="icon" onClick={() => { mutate(removeBlock(layout, selected.id)); setSelectedId(null) }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <NumberField label="Width" value={selected.width} min={10} max={DESIGN_WIDTH} onChange={(value) => patch(selected.id, { width: value })} />
                      <NumberField label="Thickness" value={selected.thickness} min={1} max={20} onChange={(value) => patch(selected.id, { thickness: value })} />
                      <NumberField label="X" value={selected.x} min={0} max={DESIGN_WIDTH - 10} onChange={(value) => patch(selected.id, { x: value })} />
                      <NumberField label="Y" value={selected.y} min={0} max={DESIGN_HEIGHT - 10} onChange={(value) => patch(selected.id, { y: value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Colour</Label>
                      <input
                        type="color"
                        value={selected.color}
                        onChange={(event) => patch(selected.id, { color: event.target.value })}
                        className="h-8 w-full rounded-md border bg-background"
                        aria-label="Divider colour"
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="gap-2">
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center gap-2 text-sm"><Layers className="h-4 w-4" /> Layers ({layout.blocks.length})</CardTitle>
              </CardHeader>
              <CardContent className="max-h-64 space-y-1 overflow-y-auto pr-1">
                {[...layout.blocks].reverse().map((block) => {
                  const Icon = blockIcon(block)
                  return (
                    <button
                      key={block.id}
                      type="button"
                      onClick={() => setSelectedId(block.id)}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                        selectedId === block.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{blockLabel(block)}</span>
                    </button>
                  )
                })}
              </CardContent>
            </Card>

            <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs text-muted-foreground">
              <span>{currentLogos.length}/{MAX_LOGOS} logos</span>
              <span>{layout.blocks.filter((b) => b.type === "signature").length}/{MAX_SIGNATURES} signatures</span>
            </div>
          </aside>
        </div>
      )}

      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Certificate templates</DialogTitle>
            <DialogDescription>
              Ten professional starting points. Applying one keeps your uploaded logos and signatures.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {CERTIFICATE_TEMPLATES.map((template) => {
              const previewLayout = applyTemplate(template, currentLogos, currentSignatures)
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => apply(template)}
                  className={`group overflow-hidden rounded-xl border text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
                    templateId === template.id ? "ring-2 ring-primary" : ""
                  }`}
                >
                  <div className="border-b bg-muted/40 p-2">
                    <CertificatePreview layout={previewLayout} content={content} className="rounded-md shadow-sm" />
                  </div>
                  <div className="space-y-1 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{template.name}</p>
                      <div className="flex gap-1">
                        <span className="h-3 w-3 rounded-full" style={{ background: template.swatch[0] }} />
                        <span className="h-3 w-3 rounded-full" style={{ background: template.swatch[1] }} />
                      </div>
                    </div>
                    <p className="text-xs leading-4 text-muted-foreground">{template.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <Plus className="h-3.5 w-3.5" />
        Tip: drag elements directly on the canvas. Use the inspector for exact positions and the layers list to jump
        between logos and signatures.
      </div>
    </div>
  )
}
