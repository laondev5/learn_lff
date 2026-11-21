"use client"

import { useRef, useState, useEffect } from "react"
import Link from "next/link"
import { registerAndApply, type getOpenCohortSchedules } from "@/actions/cohort-application.actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Schedules = Awaited<ReturnType<typeof getOpenCohortSchedules>>
const money = (value: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(value)
const lagosDate = (value: string) => new Date(value).toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric" })

export function ApplicationForm({ schedules, preselectSchedule }: { schedules: Schedules; preselectSchedule?: string }) {
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [error, setError] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [paymentIssue, setPaymentIssue] = useState("")
  const [scheduleId, setScheduleId] = useState(preselectSchedule ?? "")
  useEffect(() => { if (preselectSchedule && schedules.some(s => s.id === preselectSchedule)) setScheduleId(preselectSchedule) }, [preselectSchedule, schedules])
  const selected = schedules.find(s => s.id === scheduleId)
  const payable = !!selected && selected.isPaid && selected.price > 0

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current) return
    const form = event.currentTarget
    const data = new FormData(form)
    const field = (name: string) => String(data.get(name) ?? "")
    if (data.get("partnerInformed") !== "on") { setError("Please confirm you have informed your pastor."); return }
    pending.current = true
    setBusy(true)
    setError("")
    try {
      const result = await registerAndApply({ name: field("name"), email: field("email"), state: field("state"), district: field("district"), church: field("church"), scheduleId: field("scheduleId"), partnerName: field("partnerName"), partnerEmail: field("partnerEmail"), partnerPhone: field("partnerPhone"), partnerInformed: true })
      if ("error" in result) setError(result.error ?? "Unable to save your response. Please retry.")
      else {
        form.reset()
        setScheduleId("")
        setSubmitted(true)
        setPaymentIssue(result.paymentError ? "Your application is saved, but we could not open the course payment. Contact your assembly to complete the fee." : "")
        // Paid courses continue straight to Paystack, before the applicant can sign in.
        if (result.paymentUrl) window.location.assign(result.paymentUrl)
      }
    } catch { setError("We could not confirm your application. Check Applications after signing in before submitting again.") }
    finally { pending.current = false; setBusy(false) }
  }

  if (submitted) return <section role="status" className="space-y-4 rounded-lg border border-primary/30 p-6">
    <h2 className="text-xl font-semibold">Application sent — admission pending</h2>
    {paymentIssue && <p role="alert" className="rounded-md border border-destructive/30 p-4 text-sm text-destructive">{paymentIssue}</p>}
    <p>Your pastor has been emailed an invitation. You will be admitted only after they accept the accountability role. Course schedules and any payment requirements still apply.</p>
    <p className="text-sm text-muted-foreground">You do not need a password yet. Once your pastor accepts, we will email a one-time link where you can set your password and sign in.</p>
    <Button asChild variant="outline"><Link href="/">Back to the portal</Link></Button>
  </section>

  if (!schedules.length) return <section className="space-y-3 rounded-lg border p-6">
    <h2 className="text-xl font-semibold">Applications are currently closed</h2>
    <p className="text-muted-foreground">Registration stays open until one week after a cohort starts. That window has now closed for every available course. Please wait for the next cohort — applications reopen as soon as a new intake is scheduled. You can <Link href="/courses" className="text-primary underline">browse the courses</Link> in the meantime, or contact your assembly.</p>
  </section>

  return <form onSubmit={submit} className="space-y-7" aria-busy={busy}>
    <fieldset disabled={busy} className="space-y-5 disabled:opacity-70">
      <legend className="mb-4 text-lg font-semibold">Your account</legend>
      <div className="space-y-2"><Label htmlFor="name">Full name</Label><Input id="name" name="name" autoComplete="name" required minLength={2} maxLength={150} /></div>
      <div className="space-y-2"><Label htmlFor="email">Email address</Label><Input id="email" name="email" type="email" autoComplete="email" required maxLength={254} /><p className="text-xs text-muted-foreground">Your admission link and course notices are sent to this address.</p></div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="state">State</Label><Input id="state" name="state" required minLength={2} maxLength={100} autoComplete="address-level1" /></div>
        <div className="space-y-2"><Label htmlFor="district">Church district</Label><Input id="district" name="district" required minLength={2} maxLength={150} placeholder="e.g. Lagos District" /></div>
        <div className="space-y-2 sm:col-span-2"><Label htmlFor="church">Church branch</Label><Input id="church" name="church" required minLength={2} maxLength={150} placeholder="The name your branch is known by" /></div>
      </div>
      <div className="space-y-2"><Label htmlFor="scheduleId">Course and cohort</Label><select id="scheduleId" name="scheduleId" required value={scheduleId} onChange={event => setScheduleId(event.target.value)} className="w-full rounded-md border bg-background px-3 py-3 text-sm focus-visible:outline-2 focus-visible:outline-primary"><option value="" disabled>Select a course and cohort</option>{schedules.map(s => <option key={s.id} value={s.id}>{s.courseTitle} · {s.cohort} · starts {s.startDate} · apply by {lagosDate(s.registrationClosesAt)}</option>)}</select><p className="text-xs text-muted-foreground">Applications close one week after the cohort starts. All dates follow Lagos time.</p></div>
      {selected && <div className="rounded-md border bg-muted/40 p-4 text-sm">
        {payable
          ? <><p className="font-semibold">Course fee: {money(selected.price)}</p><p className="mt-1 text-muted-foreground">After you submit this form you will be taken to a secure Paystack checkout to pay for {selected.courseTitle}. Your place is confirmed when the payment succeeds.</p></>
          : <p className="text-muted-foreground">This cohort course is free — no payment is needed.</p>}
      </div>}
    </fieldset>
    <fieldset disabled={busy} className="space-y-5 border-t pt-6 disabled:opacity-70">
      <legend className="text-lg font-semibold">Your pastor and accountability partner</legend>
      <p className="text-sm leading-relaxed text-muted-foreground">We will email your pastor to ask them to accept this role. If they accept, they will receive notifications when you miss a module deadline. If they decline, your application will be rejected.</p>
      <div className="space-y-2"><Label htmlFor="partnerName">Pastor’s full name</Label><Input id="partnerName" name="partnerName" required minLength={2} maxLength={150} /></div>
      <div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="partnerEmail">Pastor’s email address</Label><Input id="partnerEmail" name="partnerEmail" type="email" required maxLength={254} /></div><div className="space-y-2"><Label htmlFor="partnerPhone">Pastor’s phone number</Label><Input id="partnerPhone" name="partnerPhone" type="tel" required minLength={7} maxLength={40} placeholder="Include country code" /></div></div>
      <label className="flex items-start gap-3 text-sm leading-relaxed"><input type="checkbox" name="partnerInformed" required className="mt-1 h-4 w-4 shrink-0" /><span>I have informed my pastor and have his permission to share his information and use him as my accountability partner. I understand he will be notified, and my admission remains pending until he accepts.</span></label>
    </fieldset>
    {error && <div role="alert" className="space-y-2 rounded-md border border-destructive/30 p-4 text-sm"><p className="text-destructive">{error}</p><Link href="/student/applications" className="underline">Sign in to check Applications</Link></div>}
    <p className="text-sm text-muted-foreground">You are not asked for a password now. If your pastor accepts, we will email you a one-time link to set one.</p>
    <Button type="submit" disabled={busy} size="lg" className="w-full sm:w-auto">{busy ? (payable ? "Submitting and opening payment…" : "Submitting application…") : payable ? `Submit application and pay ${money(selected.price)}` : "Submit application"}</Button>
  </form>
}
