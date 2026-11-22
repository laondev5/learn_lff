"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Loader2,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { decideAccessAppeal } from "@/actions/cohort.actions"
import {
  getAppealDetail,
  getAppealsPage,
  type AppealDetail,
  type AppealStatusFilter,
  type AppealsPage,
} from "@/actions/admin-appeal.actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const statusStyles: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "border-amber-200 bg-amber-50 text-amber-700" },
  approved: { label: "Approved", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  rejected: { label: "Rejected", className: "border-red-200 bg-red-50 text-red-700" },
  unknown: { label: "No status", className: "border-slate-200 bg-slate-50 text-slate-500" },
}

function lagos(value: string | null | undefined) {
  if (!value) return "—"
  return new Date(value).toLocaleString("en-GB", {
    timeZone: "Africa/Lagos",
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function StatCard({
  label, value, icon: Icon, tone,
}: {
  label: string
  value: number
  icon: typeof Scale
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
        </div>
      </CardContent>
    </Card>
  )
}

export function AdminAppealsClient() {
  const [data, setData] = useState<AppealsPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<AppealStatusFilter>("all")
  const [cohort, setCohort] = useState("all")
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")

  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<AppealDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [grantDays, setGrantDays] = useState("1")

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
      const result = await getAppealsPage({ page, pageSize: 10, status, cohort, query })
      if ("error" in result) throw new Error(result.error)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load appeals. Please retry.")
    } finally {
      setLoading(false)
    }
  }, [page, status, cohort, query])

  useEffect(() => { void load() }, [load])

  async function openDetail(id: string) {
    setDetailId(id)
    setDetail(null)
    setDetailLoading(true)
    try {
      const result = await getAppealDetail(id)
      if ("error" in result) throw new Error(result.error)
      setDetail(result)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to load this appeal.")
      setDetailId(null)
    } finally {
      setDetailLoading(false)
    }
  }

  async function decide(id: string, decision: "approved" | "rejected") {
    if (busy) return
    setBusy(id)
    try {
      const result = await decideAccessAppeal(id, decision, Number(grantDays) || 1)
      if ("error" in result) throw new Error(result.error)
      toast.success(
        decision === "approved"
          ? `Appeal approved. Access granted for ${grantDays} day${grantDays === "1" ? "" : "s"}.`
          : "Appeal rejected.",
      )
      setDetailId(null)
      setDetail(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to review this appeal.")
    } finally {
      setBusy(null)
    }
  }

  const stats = data?.stats ?? { total: 0, pending: 0, approved: 0, rejected: 0 }
  const rangeLabel = useMemo(() => {
    if (!data || data.total === 0) return "No appeals"
    const start = (data.page - 1) * data.pageSize + 1
    const end = Math.min(data.page * data.pageSize, data.total)
    return `Showing ${start}–${end} of ${data.total}`
  }, [data])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Scale className="h-6 w-6" /> Access appeals
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review missed-module appeals, open the full case file, then approve or reject.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total" value={stats.total} icon={Scale} tone="bg-primary/10 text-primary" />
        <StatCard label="Pending" value={stats.pending} icon={Clock3} tone="bg-amber-50 text-amber-600" />
        <StatCard label="Approved" value={stats.approved} icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" />
        <StatCard label="Rejected" value={stats.rejected} icon={XCircle} tone="bg-red-50 text-red-600" />
      </div>

      {stats.total > stats.pending + stats.approved + stats.rejected && (
        <p className="text-xs text-muted-foreground">
          {stats.total - (stats.pending + stats.approved + stats.rejected)} legacy appeal
          {stats.total - (stats.pending + stats.approved + stats.rejected) === 1 ? "" : "s"} predate status tracking
          and cannot be reviewed.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </p>
      )}

      <Card>
        <CardHeader className="gap-3 border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Appeal queue</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search student, course, reason…"
                  className="h-9 w-60 pl-8"
                  aria-label="Search appeals"
                />
              </div>
              <Select value={status} onValueChange={(value) => { setStatus((value ?? "all") as AppealStatusFilter); setPage(1) }}>
                <SelectTrigger className="h-9 w-36" aria-label="Filter by status">
                  <SelectValue>
                    {status === "all" ? "All statuses" : statusStyles[status].label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={cohort} onValueChange={(value) => { setCohort(value ?? "all"); setPage(1) }}>
                <SelectTrigger className="h-9 w-40" aria-label="Filter by cohort">
                  <SelectValue>{cohort === "all" ? "All cohorts" : cohort}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cohorts</SelectItem>
                  {(data?.cohorts ?? []).map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
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
                  <TableHead>Student</TableHead>
                  <TableHead>Course · module</TableHead>
                  <TableHead>Cohort</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && !data ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading appeals…
                    </TableCell>
                  </TableRow>
                ) : !data || data.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                      No appeals match these filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.rows.map((appeal) => {
                    const badge = statusStyles[appeal.status]
                    return (
                      <TableRow key={appeal.id}>
                        <TableCell>
                          <p className="font-medium">{appeal.studentName}</p>
                          <p className="text-xs text-muted-foreground">{appeal.studentEmail || "—"}</p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{appeal.courseTitle}</p>
                          <p className="text-xs text-muted-foreground">{appeal.moduleTitle}</p>
                        </TableCell>
                        <TableCell className="text-sm">{appeal.cohort || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{lagos(appeal.createdAt)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Button variant="outline" size="sm" onClick={() => void openDetail(appeal.id)}>
                              <Eye className="h-3.5 w-3.5" /> View
                            </Button>
                            {appeal.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  disabled={busy === appeal.id}
                                  onClick={() => void decide(appeal.id, "approved")}
                                >
                                  {busy === appeal.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={busy === appeal.id}
                                  onClick={() => void decide(appeal.id, "rejected")}
                                >
                                  <XCircle className="h-3.5 w-3.5" /> Reject
                                </Button>
                              </>
                            )}
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
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Appeal details
            </DialogTitle>
            <DialogDescription>
              Everything the student submitted, plus their progress and cohort window.
            </DialogDescription>
          </DialogHeader>

          {detailLoading || !detail ? (
            <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading case file…
            </p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{detail.studentName}</h3>
                  <p className="text-sm text-muted-foreground">{detail.studentEmail}</p>
                  <p className="mt-1 text-sm">{detail.courseTitle} · {detail.moduleTitle}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline" className={statusStyles[detail.status].className}>
                    {statusStyles[detail.status].label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{detail.cohort}</span>
                </div>
              </div>

              <section className="space-y-2">
                <h4 className="text-sm font-semibold">Student’s reason</h4>
                <p className="whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-3 text-sm">
                  {detail.reason.trim() || "No reason was recorded for this appeal."}
                </p>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Progress</p>
                  <p className="mt-1 text-sm">{detail.completedModules} of {detail.totalModules} modules completed</p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${detail.totalModules ? Math.round((detail.completedModules / detail.totalModules) * 100) : 0}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Account {detail.studentActive ? "active" : "inactive"} · cohort {detail.scheduleStart ?? "—"} to {detail.scheduleEnd ?? "—"}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Accountability partner</p>
                  <p className="mt-1 text-sm">{detail.superiorName || "Not provided"}</p>
                  <p className="text-xs text-muted-foreground">{detail.superiorRole}</p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">{detail.superiorEmail || "—"}</p>
                  <p className="text-xs text-muted-foreground">{detail.superiorPhone || "—"}</p>
                </div>
              </section>

              <section className="rounded-lg border p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Timeline (Lagos)</p>
                <dl className="mt-2 space-y-1.5">
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Submitted</dt><dd>{lagos(detail.createdAt)}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Reviewed</dt><dd>{lagos(detail.decidedAt)}</dd></div>
                  {detail.decidedByName && (
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Reviewed by</dt><dd>{detail.decidedByName}</dd></div>
                  )}
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Access opens</dt><dd>{lagos(detail.accessOpensAt)}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Access closes</dt><dd>{lagos(detail.accessClosesAt)}</dd></div>
                </dl>
              </section>

              {detail.status === "pending" ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                  <label className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Grant access for</span>
                    <Select value={grantDays} onValueChange={(value) => setGrantDays(value ?? "1")}>
                      <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">24 hours</SelectItem>
                        <SelectItem value="2">2 days</SelectItem>
                        <SelectItem value="3">3 days</SelectItem>
                        <SelectItem value="7">7 days</SelectItem>
                        <SelectItem value="14">14 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                  <div className="flex gap-2">
                    <Button variant="destructive" disabled={!!busy} onClick={() => void decide(detail.id, "rejected")}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Reject
                    </Button>
                    <Button disabled={!!busy} onClick={() => void decide(detail.id, "approved")}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Approve
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="border-t pt-4 text-sm text-muted-foreground">
                  {detail.decidedAt
                    ? `This appeal was ${detail.status} on ${lagos(detail.decidedAt)}${detail.decidedByName ? ` by ${detail.decidedByName}` : ""}.`
                    : `This appeal is ${detail.status}.`}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
