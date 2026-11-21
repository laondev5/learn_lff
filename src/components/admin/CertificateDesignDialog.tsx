"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ImagePlus, Loader2, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getCourseCertificateDesign, saveCourseCertificate } from "@/actions/admin-course.actions"

type Design = {
  courseTitle: string
  title: string
  institutionName: string
  logos: { url: string; alt: string }[]
  signatures: { name: string; role: string; url: string }[]
  isEnabled: boolean
}

type Signature = { name: string; role: string; url: string }

export function CertificateDesignDialog({ courseId, courseTitle, onClose }: { courseId: string; courseTitle: string; onClose: () => void }) {
  const router = useRouter()
  const [design, setDesign] = useState<Design | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const result = await getCourseCertificateDesign(courseId)
      if (cancelled) return
      if ("error" in result) {
        toast.error(result.error)
        setDesign({ courseTitle, title: "Certificate of Completion", institutionName: "", logos: [], signatures: [], isEnabled: true })
      } else {
        setDesign({
          courseTitle: result.courseTitle,
          title: result.title,
          institutionName: result.institutionName,
          logos: result.logos,
          signatures: result.signatures.map((s) => ({ name: s.name, role: s.role, url: s.url ?? "" })),
          isEnabled: result.isEnabled,
        })
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [courseId, courseTitle])

  const signatureSlots = useMemo(() => design?.signatures ?? [], [design])

  async function uploadImage(file: File, target: "logo" | number) {
    if (!design) return
    if (!file.type.startsWith("image/")) { toast.error("Choose an image file."); return }
    if (file.size > 10 * 1024 * 1024) { toast.error("Images must be 10 MB or smaller."); return }
    setUploading(target === "logo" ? "logo" : `sig-${target}`)
    try {
      const body = new FormData()
      body.set("file", file)
      body.set("folder", "lff-lms/certificates")
      const response = await fetch("/api/upload", { method: "POST", body })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.url) { toast.error(json?.error ?? "Upload failed"); return }
      if (target === "logo") {
        setDesign({ ...design, logos: [...design.logos, { url: json.url, alt: "" }].slice(0, 4) })
      } else {
        const signatures: Signature[] = design.signatures.map((s, i) => i === target ? { ...s, url: json.url } : s)
        setDesign({ ...design, signatures })
      }
    } catch {
      toast.error("Upload failed. Please retry.")
    } finally {
      setUploading(null)
    }
  }

  async function save() {
    if (!design || saving) return
    setSaving(true)
    const body = new FormData()
    body.set("title", design.title)
    body.set("institutionName", design.institutionName)
    body.set("isEnabled", String(design.isEnabled))
    body.set("logos", JSON.stringify(design.logos.filter((l) => l.url)))
    body.set("signatures", JSON.stringify(design.signatures.filter((s) => s.name || s.role || s.url)))
    try {
      const result = await saveCourseCertificate(courseId, body)
      if ("error" in result && result.error) { toast.error(result.error); return }
      toast.success("Certificate design saved.")
      onClose()
      router.refresh()
    } catch {
      toast.error("We could not save the certificate design.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose() }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Certificate of completion</DialogTitle>
          <DialogDescription>{courseTitle} · set the institution, logos and signatures printed on every certificate.</DialogDescription>
        </DialogHeader>

        {loading || !design ? (
          <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading certificate design…</p>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cert-title">Certificate heading</Label>
                <Input id="cert-title" value={design.title} maxLength={120} onChange={(e) => setDesign({ ...design, title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cert-institution">Institution issuing the certificate</Label>
                <Input id="cert-institution" value={design.institutionName} maxLength={160} placeholder="Living Faith Foundation" onChange={(e) => setDesign({ ...design, institutionName: e.target.value })} />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={design.isEnabled} onChange={(e) => setDesign({ ...design, isEnabled: e.target.checked })} className="h-4 w-4" />
              Issue certificates for this course
            </label>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Logos ({design.logos.length}/4)</h3>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium">
                  <ImagePlus className="h-3.5 w-3.5" /> {uploading === "logo" ? "Uploading…" : "Add logo"}
                  <input type="file" accept="image/*" className="sr-only" disabled={!!uploading || design.logos.length >= 4}
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadImage(file, "logo"); e.target.value = "" }} />
                </label>
              </div>
              {design.logos.length === 0 ? <p className="text-xs text-muted-foreground">No logos yet. Add the institute logo and any partner logos.</p> : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {design.logos.map((logo, index) => (
                    <li key={`${logo.url}-${index}`} className="flex items-center gap-2 rounded-lg border p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logo.url} alt={logo.alt || "Certificate logo"} className="h-10 w-16 rounded object-contain" />
                      <Input value={logo.alt} placeholder="Label (optional)" maxLength={120}
                        onChange={(e) => setDesign({ ...design, logos: design.logos.map((l, i) => i === index ? { ...l, alt: e.target.value } : l) })} />
                      <Button type="button" variant="ghost" size="icon" onClick={() => setDesign({ ...design, logos: design.logos.filter((_, i) => i !== index) })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Signatures ({signatureSlots.length}/4)</h3>
                <Button type="button" variant="outline" size="sm" disabled={signatureSlots.length >= 4}
                  onClick={() => setDesign({ ...design, signatures: [...design.signatures, { name: "", role: "", url: "" }] })}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add signature
                </Button>
              </div>
              {signatureSlots.length === 0 ? <p className="text-xs text-muted-foreground">No signatures yet. Add the names and roles of everyone who signs.</p> : (
                <ul className="space-y-3">
                  {signatureSlots.map((signature, index) => (
                    <li key={index} className="space-y-2 rounded-lg border p-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input placeholder="Name" value={signature.name} maxLength={120}
                          onChange={(e) => setDesign({ ...design, signatures: design.signatures.map((s, i) => i === index ? { ...s, name: e.target.value } : s) })} />
                        <Input placeholder="Role (e.g. National Director)" value={signature.role} maxLength={120}
                          onChange={(e) => setDesign({ ...design, signatures: design.signatures.map((s, i) => i === index ? { ...s, role: e.target.value } : s) })} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {signature.url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={signature.url} alt="" className="h-10 w-24 rounded object-contain" />
                        )}
                        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium">
                          <ImagePlus className="h-3.5 w-3.5" /> {uploading === `sig-${index}` ? "Uploading…" : signature.url ? "Replace signature image" : "Upload signature image"}
                          <input type="file" accept="image/*" className="sr-only" disabled={!!uploading}
                            onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadImage(file, index); e.target.value = "" }} />
                        </label>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setDesign({ ...design, signatures: design.signatures.filter((_, i) => i !== index) })}>
                          <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="flex justify-end gap-3 border-t pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button type="button" onClick={() => void save()} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save certificate
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
