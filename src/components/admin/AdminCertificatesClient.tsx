"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  Award,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
} from "lucide-react"
import { toast } from "sonner"
import { pdf } from "@react-pdf/renderer"
import {
  getCertificateAdminOverview,
  getCertificateDownloadData,
  updateCertificateRecord,
  type CertificateAdminOverview,
} from "@/actions/admin-certificate.actions"
import { CertificateDesigner } from "@/components/admin/CertificateDesigner"
import { CertificatePDF } from "@/components/student/CertificatePDF"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function StatCard({
  label, value, hint, icon: Icon, tone,
}: {
  label: string
  value: number | string
  hint?: string
  icon: typeof Award
  tone: string
}) {
  return (
    <Card className="gap-2 py-4">
      <CardContent className="flex items-center gap-3 px-4">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold leading-tight">{value}</p>
          {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

export function AdminCertificatesClient() {
  const searchParams = useSearchParams()
  const presetCourse = searchParams.get("course") ?? ""
  const [data, setData] = useState<CertificateAdminOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [page, setPage] = useState(1)
  const [courseId, setCourseId] = useState("all")
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [downloading, setDownloading] = useState<string | null>(null)

  const [editing, setEditing] = useState<{ id: string; serial: string; issuedAt: string; student: string } | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const result = await getCertificateAdminOverview({ page, pageSize: 10, courseId, query })
      if ("error" in result) throw new Error(result.error)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load certificates. Please retry.")
    } finally {
      setLoading(false)
    }
  }, [page, courseId, query])

  useEffect(() => { void load() }, [load])

  async function download(certificateId: string) {
    setDownloading(certificateId)
    try {
      const result = await getCertificateDownloadData(certificateId)
      if ("error" in result) throw new Error(result.error)
      const absolute = (url: string) => (/^https?:/i.test(url) ? url : new URL(url, window.location.origin).toString())
      const blob = await pdf(
        <CertificatePDF
          studentName={result.studentName}
          courseTitle={result.courseTitle}
          title={result.title}
          institutionName={result.institutionName}
          issuedAt={result.issuedAt}
          serial={result.serial}
          logos={result.logos.map(absolute)}
          signatures={result.signatures.map((signature) => ({
            ...signature,
            url: signature.url ? absolute(signature.url) : null,
          }))}
          layout={
            result.layout
              ? {
                  ...result.layout,
                  blocks: result.layout.blocks.map((block) => {
                    if (block.type === "logo") return { ...block, url: block.url ? absolute(block.url) : "" }
                    if (block.type === "signature") return { ...block, url: block.url ? absolute(block.url) : "" }
                    return block
                  }),
                }
              : null
          }
        />,
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${result.studentName}-${result.courseTitle}-certificate.pdf`.replace(/\s+/g, "-")
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to generate this certificate.")
    } finally {
      setDownloading(null)
    }
  }

  async function saveEdit() {
    if (!editing || savingEdit) return
    setSavingEdit(true)
    try {
      const result = await updateCertificateRecord(editing.id, {
        serial: editing.serial,
        issuedAt: editing.issuedAt ? new Date(editing.issuedAt).toISOString() : undefined,
      })
      if ("error" in result) throw new Error(result.error)
      toast.success("Certificate updated.")
      setEditing(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to update this certificate.")
    } finally {
      setSavingEdit(false)
    }
  }

  const stats = data?.stats ?? { issued: 0, thisMonth: 0, courses: 0, templates: 0 }
  const rangeLabel = useMemo(() => {
    if (!data || data.total === 0) return "No certificates"
    const start = (data.page - 1) * data.pageSize + 1
    const end = Math.min(data.page * data.pageSize, data.total)
    return `Showing ${start}–${end} of ${data.total}`
  }, [data])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Award className="h-6 w-6" /> Certificates
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Issue-ready certificates, their IDs, and the drag-and-drop designer that renders them.
        </p>
      </div>

      <Tabs defaultValue={presetCourse ? "designer" : "certificates"}>
        <TabsList className="w-full max-w-sm">
          <TabsTrigger value="certificates">Issued certificates</TabsTrigger>
          <TabsTrigger value="designer">Designer</TabsTrigger>
        </TabsList>

        <TabsContent value="certificates" className="space-y-5 pt-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Issued" value={stats.issued} icon={Award} tone="bg-primary/10 text-primary" />
            <StatCard label="This month" value={stats.thisMonth} icon={FileSpreadsheet} tone="bg-emerald-50 text-emerald-600" />
            <StatCard label="Courses" value={stats.courses} icon={FileSpreadsheet} tone="bg-sky-50 text-sky-600" />
            <StatCard label="Designs saved" value={stats.templates} hint="courses with a template" icon={Pencil} tone="bg-violet-50 text-violet-600" />
          </div>

          {error && (
            <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </p>
          )}

          <Card>
            <CardHeader className="gap-3 border-b">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base">Certificate register</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search student, course, ID…"
                      className="h-9 w-56 pl-8"
                      aria-label="Search certificates"
                    />
                  </div>
                  <Select value={courseId} onValueChange={(value) => { setCourseId(value ?? "all"); setPage(1) }}>
                    <SelectTrigger className="h-9 w-56" aria-label="Filter by course">
                      <SelectValue>{courseId === "all" ? "All courses" : data?.courses.find((c) => c.id === courseId)?.title ?? "Course"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All courses</SelectItem>
                      {(data?.courses ?? []).map((course) => (
                        <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                    <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Certificate ID</TableHead>
                      <TableHead>Issued</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && !data ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading certificates…
                        </TableCell>
                      </TableRow>
                    ) : !data || data.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                          No certificates match these filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <p className="font-medium">{row.studentName}</p>
                            <p className="text-xs text-muted-foreground">{row.studentEmail || "—"}</p>
                          </TableCell>
                          <TableCell className="text-sm">{row.courseTitle}</TableCell>
                          <TableCell>
                            {row.serial ? (
                              <span className="font-mono text-xs">{row.serial}</span>
                            ) : (
                              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">No ID</Badge>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {new Date(row.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap justify-end gap-1.5">
                              <Button
                                variant="outline" size="sm"
                                onClick={() => setEditing({
                                  id: row.id,
                                  serial: row.serial,
                                  issuedAt: new Date(row.issuedAt).toISOString().slice(0, 10),
                                  student: row.studentName,
                                })}
                              >
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </Button>
                              <Button size="sm" disabled={downloading === row.id} onClick={() => void download(row.id)}>
                                {downloading === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} PDF
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
                <p className="text-muted-foreground">{rangeLabel}</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={!data || data.page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </Button>
                  <span className="px-1 text-muted-foreground">Page {data?.page ?? 1} of {data?.pages ?? 1}</span>
                  <Button variant="outline" size="sm" disabled={!data || data.page >= data.pages || loading} onClick={() => setPage((p) => p + 1)}>
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="designer" className="pt-4">
          {data ? (
            <CertificateDesigner courses={data.courses} initialCourseId={presetCourse} />
          ) : (
            <p className="flex items-center gap-2 rounded-xl border p-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading courses…
            </p>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit certificate</DialogTitle>
            <DialogDescription>{editing?.student}</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="cert-serial">Certificate ID</Label>
                <Input
                  id="cert-serial"
                  value={editing.serial}
                  maxLength={40}
                  placeholder="LFF-2026-8F3A21C4"
                  onChange={(event) => setEditing({ ...editing, serial: event.target.value.toUpperCase() })}
                />
                <p className="text-xs text-muted-foreground">Letters, numbers and dashes. Must be unique.</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="cert-issued">Issue date</Label>
                <Input
                  id="cert-issued"
                  type="date"
                  value={editing.issuedAt}
                  onChange={(event) => setEditing({ ...editing, issuedAt: event.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2 border-t pt-4">
                <Button variant="outline" onClick={() => setEditing(null)} disabled={savingEdit}>Cancel</Button>
                <Button onClick={() => void saveEdit()} disabled={savingEdit}>
                  {savingEdit ? <Loader2 className="animate-spin" /> : null} Save changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
