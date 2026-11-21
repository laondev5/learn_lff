"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { applyForCohort, getCohortApplications, resendPartnerInvitation } from "@/actions/cohort-application.actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type ApplicationData = Extract<Awaited<ReturnType<typeof getCohortApplications>>, { schedules: unknown }>
const statusText = {
  pending: "Pending — not admitted. Your pastor must accept the invitation before you can join.",
  accepted: "Admitted. Course access follows the cohort schedule and payment requirements.",
  rejected: "Application rejected. This decision applies to this cohort application; your account remains available.",
}
const emailText = { pending: "Invitation awaiting delivery", sent: "Invitation sent", failed: "Invitation delivery failed — please resend" }

export function StudentApplicationsClient() {
  const [data, setData] = useState<ApplicationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [scheduleId, setScheduleId] = useState("")
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getCohortApplications()
      if ("error" in result) { setError(result.error ?? "Unable to load applications."); return }
      setData(result)
    } catch { setError("Unable to load applications. Please retry.") }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    const fields = new FormData(form)
    if (fields.get("partnerInformed") !== "on" || !scheduleId) { setError("Choose a cohort and confirm that you have informed your pastor."); return }
    setBusy("apply"); setError(""); setSuccess("")
    try {
      const result = await applyForCohort({ scheduleId, partnerName: String(fields.get("partnerName") ?? "").trim(), partnerEmail: String(fields.get("partnerEmail") ?? "").trim(), partnerPhone: String(fields.get("partnerPhone") ?? "").trim(), partnerInformed: true })
      if ("error" in result) setError(result.error ?? "Unable to apply.")
      else {
        setSuccess(result.paymentError ? `Application submitted, but the course payment could not be opened: ${result.paymentError}` : "Application submitted. Your admission is pending your pastor’s acceptance.")
        form.reset(); setScheduleId("")
        // Paid courses go straight to the secure checkout after the form is complete.
        if (result.paymentUrl) { window.location.assign(result.paymentUrl); return }
      }
      // Email failure can still leave a saved application. Refresh history in both cases.
      await load()
    } catch { setError("Unable to confirm submission. Refresh your applications before trying again.") }
    finally { setBusy(null) }
  }
  async function resend(applicationId: string) {
    if (busy) return
    setBusy(applicationId); setError(""); setSuccess("")
    try {
      const result = await resendPartnerInvitation(applicationId)
      if ("error" in result) setError(result.error ?? "Unable to resend.")
      else setSuccess("A new invitation has been sent. Ask your pastor to use the latest email.")
      await load()
    } catch { setError("Unable to resend the invitation. Please retry.") }
    finally { setBusy(null) }
  }
  const selected = data?.schedules.find(s => s.id === scheduleId)
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">Cohort applications</h1><p className="mt-2 text-muted-foreground">Apply before your cohort starts. Admission requires your pastor’s acceptance as your accountability partner.</p></div><Button variant="outline" disabled={loading || !!busy} onClick={() => { setError(""); void load() }}>Refresh</Button></div>
    {error && <p role="alert" className="rounded-xl border border-destructive/30 p-4 text-destructive">{error}</p>}
    {success && <p role="status" className="rounded-xl border p-4">{success}</p>}
    {loading && <p role="status">Loading applications…</p>}
    {data && <>
      <section className="space-y-4 rounded-xl border p-5"><h2 className="text-lg font-semibold">Apply for an upcoming cohort</h2>
        {data.schedules.length === 0 ? <p>No upcoming cohorts are accepting applications. Please check again after dates are published.</p> : <form onSubmit={submit} className="space-y-4">
          <fieldset disabled={!!busy || loading} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="application-schedule">Course and cohort</Label><select id="application-schedule" name="scheduleId" required value={scheduleId} onChange={event => setScheduleId(event.target.value)} className="w-full rounded-md border bg-background p-2"><option value="" disabled>Choose a cohort</option>{data.schedules.map(s => <option key={s.id} value={s.id}>{s.courseTitle} · {s.cohort} · {s.startDate} – {s.endDate}</option>)}</select></div>
            {selected && <p className="text-sm text-muted-foreground">{selected.courseTitle} runs {selected.startDate} – {selected.endDate}, inclusive (Africa/Lagos). Applications close one week after the cohort starts.{selected.isPaid && selected.price > 0 ? ` Course fee: ${new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(selected.price)} — you will be taken to secure payment after submitting.` : " This course is free."}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="partner-name">Pastor / accountability partner’s name</Label><Input id="partner-name" name="partnerName" required minLength={2} maxLength={150} autoComplete="off" /></div>
              <div className="space-y-2"><Label htmlFor="partner-phone">Pastor’s phone</Label><Input id="partner-phone" name="partnerPhone" type="tel" required minLength={7} maxLength={40} autoComplete="off" placeholder="Include country code" /></div>
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="partner-email">Pastor’s email</Label><Input id="partner-email" name="partnerEmail" type="email" required maxLength={254} autoComplete="off" /></div>
            </div>
            <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-3"><p id="partner-notice">Please inform your pastor before applying. We will email them your name and cohort details and ask them to accept or reject the accountability partner role. If they accept, they may receive notices when you miss module deadlines. You are not admitted while their response is pending.</p><label className="flex items-start gap-3" htmlFor="partner-informed"><input id="partner-informed" name="partnerInformed" type="checkbox" required aria-describedby="partner-notice" className="mt-1 h-4 w-4" /><span>I have informed my pastor and have his permission to share his information and use him as my accountability partner.</span></label></div>
            <Button type="submit" disabled={!!busy || loading}>{busy === "apply" ? "Submitting…" : selected?.isPaid && selected.price > 0 ? "Apply, send invitation and pay" : "Apply and send invitation"}</Button>
          </fieldset>
        </form>}
      </section>
      <section className="space-y-3"><h2 className="text-lg font-semibold">Your applications</h2>{data.applications.length === 0 && <p>You haven’t applied for a cohort yet.</p>}{data.applications.map(a => <article key={a.id} className="space-y-3 rounded-xl border p-5"><h3 className="font-semibold">{a.courseTitle} · {a.cohort}</h3><p>{statusText[a.status]}</p><p className="break-words text-sm text-muted-foreground">Pastor {a.partnerName} · {a.partnerEmail}</p>{a.status === "pending" && <><p className="text-sm">{emailText[a.emailStatus]}</p><Button variant="outline" disabled={!!busy || loading} onClick={() => void resend(a.id)}>{busy === a.id ? "Sending…" : "Resend invitation"}</Button></>}</article>)}</section>
    </>}
  </div>
}
