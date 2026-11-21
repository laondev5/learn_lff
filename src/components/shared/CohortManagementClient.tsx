"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { CalendarDays, Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { decideAccessAppeal, getAccessAppeals, getCohortSchedules, saveCohortSchedule } from "@/actions/cohort.actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Schedules = Extract<Awaited<ReturnType<typeof getCohortSchedules>>, { schedules: unknown }>
type Appeals = Extract<Awaited<ReturnType<typeof getAccessAppeals>>, { appeals: unknown }>["appeals"]

function lagosTime(value: string | null) {
  return value ? new Date(value).toLocaleString("en-GB", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" }) : "—"
}

export function CohortManagementClient({ role }: { role: "admin" | "teacher" }) {
  const [data, setData] = useState<Schedules | null>(null)
  const [appeals, setAppeals] = useState<Appeals>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [courseId, setCourseId] = useState("")
  const [cohort, setCohort] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [schedules, requests] = await Promise.all([getCohortSchedules(), role === "admin" ? getAccessAppeals() : Promise.resolve(null)])
      if ("error" in schedules) throw new Error(schedules.error)
      if (requests && "error" in requests) throw new Error(requests.error)
      setData(schedules)
      setAppeals(requests?.appeals ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load cohort schedules. Please retry.")
    } finally {
      setLoading(false)
    }
  }, [role])

  useEffect(() => { void load() }, [load])

  function selectSchedule(nextCourse: string, nextCohort: string) {
    setCourseId(nextCourse)
    setCohort(nextCohort)
    const schedule = data?.schedules.find((item) => item.courseId === nextCourse && item.cohort === nextCohort)
    setStartDate(schedule?.startDate ?? "")
    setEndDate(schedule?.endDate ?? "")
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setError("")
    setSuccess("")
    if (!courseId || !cohort.trim() || !startDate || !endDate || endDate < startDate) {
      setError("Choose a course and cohort, then enter an end date on or after the start date.")
      return
    }
    setBusy("schedule")
    try {
      const result = await saveCohortSchedule({ courseId, cohort: cohort.trim(), startDate, endDate })
      if ("error" in result) throw new Error(result.error)
      setSuccess("Cohort schedule saved.")
      toast.success("Cohort schedule saved")
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save the schedule. Please retry.")
    } finally { setBusy(null) }
  }

  async function decide(id: string, decision: "approved" | "rejected") {
    if (busy) return
    setBusy(id)
    setError("")
    setSuccess("")
    try {
      const result = await decideAccessAppeal(id, decision)
      if ("error" in result) throw new Error(result.error)
      const message = decision === "approved" ? "Appeal approved. The student has 24 hours of access; course access is extended if needed." : "Appeal rejected."
      setSuccess(message)
      toast.success(message)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to review this appeal. Please retry.")
    } finally { setBusy(null) }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><CalendarDays className="h-6 w-6" />Cohort schedules</h1>
          <p className="mt-1 text-sm text-muted-foreground">{role === "admin" ? "Manage course dates and review access appeals." : "Manage cohort dates for your courses. Access appeals are reviewed by an administrator."}</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading || !!busy}><RefreshCw className={loading ? "animate-spin" : ""} />Refresh</Button>
      </div>
      {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
      {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}
      {loading && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading schedules…</p>}
      {data && <>
        <Card>
          <CardHeader><CardTitle>Set course and cohort dates</CardTitle></CardHeader>
          <CardContent>
            <p id="schedule-help" className="mb-4 text-sm text-muted-foreground">Each course can have its own cohorts, even while another course's cohort is running. All dates use Africa/Lagos (WAT). Applications close seven days after the start date. Each module is open for 24 hours, one module per day. If a student misses a module, they must appeal and their accountability partner and an administrator are notified.</p>
            {data.courses.length === 0 ? <p className="text-sm text-muted-foreground">No courses are available to schedule.</p> : (
              <form onSubmit={save} aria-describedby="schedule-help" className="space-y-4">
                <fieldset disabled={!!busy || loading} className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="schedule-course">Course</Label>
                    <Select value={courseId} onValueChange={(value) => selectSchedule(value ?? "", cohort)}>
                      <SelectTrigger id="schedule-course" className="w-full"><SelectValue placeholder="Choose a course">{data.courses.find((item) => item.id === courseId)?.title}</SelectValue></SelectTrigger>
                      <SelectContent>{data.courses.map((course) => <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label htmlFor="schedule-cohort">Cohort</Label><Input id="schedule-cohort" list="known-cohorts" value={cohort} onChange={(event) => selectSchedule(courseId, event.target.value)} required maxLength={120} placeholder="Enter or choose a cohort" /><datalist id="known-cohorts">{data.cohorts.map((name) => <option key={name} value={name} />)}</datalist></div>
                  <div className="space-y-2"><Label htmlFor="schedule-start">Start date (Lagos)</Label><Input id="schedule-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></div>
                  <div className="space-y-2"><Label htmlFor="schedule-end">End date (inclusive, Lagos)</Label><Input id="schedule-end" type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} required /></div>
                </fieldset>
                <Button type="submit" disabled={!!busy || loading}>{busy === "schedule" && <Loader2 className="animate-spin" />}Save schedule</Button>
              </form>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Saved schedules ({data.schedules.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.schedules.length === 0 && <p className="text-muted-foreground">No cohort schedules yet. Set dates above to get started.</p>}
            {data.schedules.map((schedule) => <div key={schedule.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
              <div>
                <p className="font-medium">{schedule.courseTitle}</p>
                <p className="text-sm text-muted-foreground">{schedule.cohort} · {schedule.startDate} – {schedule.endDate} (inclusive, WAT)</p>
                <p className="text-xs text-muted-foreground">Applications close {lagosTime(schedule.registrationClosesAt)}</p>
              </div>
              <Button variant="outline" disabled={!!busy || loading} onClick={() => { selectSchedule(schedule.courseId, schedule.cohort); document.getElementById("schedule-start")?.focus() }}>Edit dates<span className="sr-only"> for {schedule.courseTitle}, {schedule.cohort}</span></Button>
            </div>)}
          </CardContent>
        </Card>
        {role === "admin" && <Card>
          <CardHeader><CardTitle>Access appeals ({appeals.filter((appeal) => appeal.status === "pending").length} pending)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Approval grants 24 hours from approval and extends course access if needed. All times below are Lagos time.</p>
            {appeals.length === 0 && <p className="text-muted-foreground">No access appeals have been submitted.</p>}
            {[...appeals].sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending")).map((appeal) => <article key={appeal.id} className="space-y-3 rounded-xl border p-4">
              <div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-semibold">{appeal.studentName} · {appeal.courseTitle}</h3><p className="text-sm text-muted-foreground">{appeal.moduleTitle} · {appeal.cohort}</p></div><Badge variant={appeal.status === "rejected" ? "destructive" : "secondary"}>{appeal.status}</Badge></div>
              <p className="whitespace-pre-wrap break-words text-sm">{appeal.reason}</p>
              <dl className="grid gap-2 rounded-lg bg-muted/50 p-3 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">Accountability partner</dt><dd>{appeal.superiorName}{appeal.superiorRole && appeal.superiorRole !== "Accountability partner" ? ` · ${appeal.superiorRole}` : ""}</dd></div>
                <div><dt className="text-muted-foreground">Contact</dt><dd className="break-all">{appeal.superiorEmail}<br />{appeal.superiorPhone}</dd></div>
              </dl>
              <p className="text-xs text-muted-foreground">Submitted {lagosTime(appeal.createdAt)}{appeal.decidedAt ? ` · Reviewed ${lagosTime(appeal.decidedAt)}` : ""}{appeal.accessClosesAt ? ` · Access closes ${lagosTime(appeal.accessClosesAt)}` : ""}</p>
              {appeal.status === "pending" && <div className="flex flex-wrap gap-2"><Button disabled={!!busy || loading} onClick={() => void decide(appeal.id, "approved")}>{busy === appeal.id && <Loader2 className="animate-spin" />}Approve · 24 hours</Button><Button variant="destructive" disabled={!!busy || loading} onClick={() => void decide(appeal.id, "rejected")}>Reject</Button></div>}
            </article>)}
          </CardContent>
        </Card>}
      </>}
    </div>
  )
}
