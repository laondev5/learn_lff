"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CalendarClock,
  Info,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  GraduationCap,
  Loader2,
  RefreshCw,
  Search,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import {
  exportCohortXlsx,
  getCohortDetail,
  getCohortExportData,
  getCohortOverview,
  type CohortDetail,
  type CohortLifecycle,
  type CohortOverview,
} from "@/actions/admin-cohort.actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const lifecycleStyles: Record<CohortLifecycle, { label: string; className: string }> = {
  upcoming: { label: "Upcoming", className: "border-sky-200 bg-sky-50 text-sky-700" },
  active: { label: "Running", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  ended: { label: "Ended", className: "border-slate-200 bg-slate-50 text-slate-600" },
}

function csvCell(value: string | number) {
  const text = String(value ?? "")
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function StatCard({
  label, value, hint, icon: Icon, tone,
}: {
  label: string
  value: number | string
  hint?: string
  icon: typeof Users
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

export function AdminCohortsClient() {
  const [data, setData] = useState<CohortOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [page, setPage] = useState(1)
  const [cohort, setCohort] = useState("all")
  const [status, setStatus] = useState<CohortLifecycle | "all">("all")
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [exporting, setExporting] = useState<string | null>(null)

  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<CohortDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

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
      const result = await getCohortOverview({ page, pageSize: 10, cohort, status, query })
      if ("error" in result) throw new Error(result.error)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load cohorts. Please retry.")
    } finally {
      setLoading(false)
    }
  }, [page, cohort, status, query])

  useEffect(() => { void load() }, [load])

  async function openDetail(id: string) {
    setDetailId(id)
    setDetail(null)
    setDetailLoading(true)
    try {
      const result = await getCohortDetail(id)
      if ("error" in result) throw new Error(result.error)
      setDetail(result)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to load this cohort.")
      setDetailId(null)
    } finally {
      setDetailLoading(false)
    }
  }

  async function exportCsv(id: string) {
    setExporting(`${id}:csv`)
    try {
      const result = await getCohortExportData(id)
      if ("error" in result) throw new Error(result.error)
      const csv = "\uFEFF" + [result.headers, ...result.rows].map((row) => row.map(csvCell).join(",")).join("\r\n")
      downloadBlob(`${result.filename}.csv`, new Blob([csv], { type: "text/csv;charset=utf-8" }))
      toast.success("CSV export downloaded.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to export this cohort.")
    } finally {
      setExporting(null)
    }
  }

  async function exportExcel(id: string) {
    setExporting(`${id}:xlsx`)
    try {
      const result = await exportCohortXlsx(id)
      if ("error" in result) throw new Error(result.error)
      const binary = atob(result.base64)
      const bytes = new Uint8Array(binary.length)
      for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
      downloadBlob(result.filename, new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }))
      toast.success("Excel export downloaded.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to export this cohort.")
    } finally {
      setExporting(null)
    }
  }

  const stats = data?.stats ?? { cohorts: 0, active: 0, upcoming: 0, ended: 0, students: 0, completed: 0, certificates: 0 }
  const rangeLabel = useMemo(() => {
    if (!data || data.total === 0) return "No cohorts"
    const start = (data.page - 1) * data.pageSize + 1
    const end = Math.min(data.page * data.pageSize, data.total)
    return `Showing ${start}–${end} of ${data.total}`
  }, [data])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <CalendarDays className="h-6 w-6" /> Cohorts
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every scheduled cohort, who completed it, and the certificate IDs to export.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Cohorts" value={stats.cohorts} hint={`${stats.active} running · ${stats.upcoming} upcoming`} icon={CalendarDays} tone="bg-primary/10 text-primary" />
        <StatCard label="Students" value={stats.students} icon={Users} tone="bg-sky-50 text-sky-600" />
        <StatCard label="Completed" value={stats.completed} hint={stats.students ? `${Math.round((stats.completed / stats.students) * 100)}% of students` : undefined} icon={GraduationCap} tone="bg-emerald-50 text-emerald-600" />
        <StatCard label="Certificates" value={stats.certificates} icon={FileSpreadsheet} tone="bg-violet-50 text-violet-600" />
        <StatCard label="Ended" value={stats.ended} icon={CalendarClock} tone="bg-slate-100 text-slate-600" />
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </p>
      )}

      <Card>
        <CardHeader className="gap-3 border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Cohort overview</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search cohort or course…"
                  className="h-9 w-56 pl-8"
                  aria-label="Search cohorts"
                />
              </div>
              <Select value={cohort} onValueChange={(value) => { setCohort(value ?? "all"); setPage(1) }}>
                <SelectTrigger className="h-9 w-44" aria-label="Filter by cohort">
                  <SelectValue>{cohort === "all" ? "All cohorts" : cohort}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cohorts</SelectItem>
                  {(data?.cohortOptions ?? []).map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(value) => { setStatus((value ?? "all") as CohortLifecycle | "all"); setPage(1) }}>
                <SelectTrigger className="h-9 w-36" aria-label="Filter by status">
                  <SelectValue>
                    {status === "all" ? "All statuses" : lifecycleStyles[status].label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="active">Running</SelectItem>
                  <SelectItem value="ended">Ended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cohort</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Students</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">Certificates</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && !data ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading cohorts…
                    </TableCell>
                  </TableRow>
                ) : !data || data.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      No cohorts match these filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.rows.map((row) => {
                    const badge = lifecycleStyles[row.status]
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <p className="font-medium">{row.cohort}</p>
                          <p className="text-xs text-muted-foreground">{row.courseTitle}</p>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          <p>{row.startDate} → {row.endDate}</p>
                          <p className="text-xs text-muted-foreground">
                            {row.status === "ended" ? "Cohort ended" : row.status === "upcoming" ? `Starts in ${row.daysRemaining} day${row.daysRemaining === 1 ? "" : "s"}` : `${row.daysRemaining} day${row.daysRemaining === 1 ? "" : "s"} left`}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">{row.students}</TableCell>
                        <TableCell className="text-right text-sm">
                          <span className="font-medium">{row.completed}</span>
                          <span className="ml-1 text-xs text-muted-foreground">({row.completionRate}%)</span>
                        </TableCell>
                        <TableCell className="text-right text-sm">{row.certificates}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Button variant="outline" size="sm" onClick={() => void openDetail(row.id)}>
                              <Users className="h-3.5 w-3.5" /> View
                            </Button>
                            <Button
                              variant="outline" size="sm"
                              disabled={exporting === `${row.id}:csv` || row.students === 0}
                              onClick={() => void exportCsv(row.id)}
                            >
                              {exporting === `${row.id}:csv` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} CSV
                            </Button>
                            <Button
                              size="sm"
                              disabled={exporting === `${row.id}:xlsx` || row.students === 0}
                              onClick={() => void exportExcel(row.id)}
                            >
                              {exporting === `${row.id}:xlsx` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />} Excel
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
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

      <Dialog open={!!detailId} onOpenChange={(open) => { if (!open) { setDetailId(null); setDetail(null) } }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{detail ? `${detail.cohort} · ${detail.courseTitle}` : "Cohort details"}</DialogTitle>
            <DialogDescription>
              {detail
                ? `${detail.startDate} → ${detail.endDate} · ${detail.row.students} admitted · ${detail.row.completed} completed · ${detail.row.certificates} certificates`
                : "Loading cohort roster…"}
            </DialogDescription>
          </DialogHeader>

          {detailLoading || !detail ? (
            <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading roster…
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="outline" className={lifecycleStyles[detail.row.status].className}>
                  {lifecycleStyles[detail.row.status].label}
                </Badge>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={exporting === `${detail.row.id}:csv`} onClick={() => void exportCsv(detail.row.id)}>
                    {exporting === `${detail.row.id}:csv` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Export CSV
                  </Button>
                  <Button size="sm" disabled={exporting === `${detail.row.id}:xlsx`} onClick={() => void exportExcel(detail.row.id)}>
                    {exporting === `${detail.row.id}:xlsx` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />} Export Excel
                  </Button>
                </div>
              </div>

              <div className="max-h-[52vh] overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Church</TableHead>
                      <TableHead>Modules</TableHead>
                      <TableHead>Exam</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Certificate ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.students.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No admitted students yet.</TableCell>
                      </TableRow>
                    ) : detail.students.map((student) => (
                      <TableRow key={`${student.id}-${student.certificateId}`}>
                        <TableCell>
                          <p className="font-medium">{student.name}</p>
                          <p className="text-xs text-muted-foreground">{student.email}</p>
                        </TableCell>
                        <TableCell className="text-sm">
                          <p>{student.branch || "—"}</p>
                          <p className="text-xs text-muted-foreground">{student.district || student.state || ""}</p>
                        </TableCell>
                        <TableCell className="text-sm">{student.completedModules}/{student.totalModules}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={student.examPassed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}>
                            {student.examPassed ? "Passed" : "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={student.completed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
                            {student.completed ? "Completed" : "In progress"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{student.certificateId || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5" /> Exports include every student, their completion state and certificate ID.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
