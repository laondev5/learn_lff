"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { getAccessAppeals, getAppealableModules, submitAccessAppeal } from "@/actions/cohort.actions"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

type Appeals = Extract<Awaited<ReturnType<typeof getAccessAppeals>>, { appeals: unknown }>["appeals"]
type Modules = Extract<Awaited<ReturnType<typeof getAppealableModules>>, { modules: unknown }>["modules"]
const localTime = (value: string) => new Date(value).toLocaleString("en-GB", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" })

export function StudentAppealsClient() {
  const [appeals, setAppeals] = useState<Appeals>([])
  const [modules, setModules] = useState<Modules>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [selectedId, setSelectedId] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [history, options] = await Promise.all([getAccessAppeals(), getAppealableModules()])
      if ("error" in history) throw new Error(history.error)
      if ("error" in options) throw new Error(options.error)
      setAppeals(history.appeals); setModules(options.modules)
    } catch { setError("Unable to load appeals. Please retry.") }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    const fields = new FormData(form)
    const selectedModule = modules.find(m => m.id === fields.get("moduleId"))
    if (!selectedModule) { setError("Select a closed module."); return }
    setBusy(true); setError(""); setSuccess("")
    try {
      const text = (name: string) => String(fields.get(name) ?? "")
      const result = await submitAccessAppeal({ moduleId: selectedModule.id, courseId: selectedModule.courseId, reason: text("reason") })
      if ("error" in result) { setError(result.error ?? "Unable to submit your appeal."); return }
      form.reset(); setSuccess("Appeal submitted. An administrator will review your request."); await load()
    } catch { setError("Unable to submit. Please retry.") }
    finally { setBusy(false) }
  }
  const eligible = modules.filter(m => !appeals.some(a => a.moduleId === m.id && a.status === "pending"))
  const chosen = eligible.find(m => m.id === selectedId)
  return <div className="space-y-6">
    <div className="flex flex-wrap justify-between gap-3"><div><h1 className="text-2xl font-bold">Access appeals</h1><p className="mt-2 text-muted-foreground">If you did not finish a module within its 24-hour window, that module is now locked, your accountability partner has been emailed, and an administrator has been notified to follow up. Select the module below and explain what happened. Approval reopens it for another 24 hours.</p></div><Button variant="outline" onClick={() => void load()} disabled={loading || busy}>Refresh</Button></div>
    {error && <p role="alert" className="text-destructive">{error}</p>}{success && <p role="status">{success}</p>}
    {loading ? <p role="status">Loading appeals…</p> : <>
      {eligible.length > 0 ? <form onSubmit={submit} className="space-y-4 rounded-xl border p-5"><h2 className="text-lg font-semibold">Request access</h2><fieldset disabled={busy} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="appeal-module">Closed module</Label><select id="appeal-module" name="moduleId" required value={selectedId} onChange={event => setSelectedId(event.target.value)} className="w-full rounded-md border bg-background p-2"><option value="" disabled>Choose a module</option>{eligible.map(m => <option key={m.id} value={m.id}>{m.courseTitle} · {m.title}</option>)}</select></div>
        <div className="space-y-2"><Label htmlFor="appeal-reason">Reason for missing the deadline</Label><textarea id="appeal-reason" name="reason" required minLength={10} maxLength={3000} rows={4} className="w-full rounded-md border bg-background p-2" /></div>
        {chosen && <div className="rounded-lg border bg-muted/40 p-4 text-sm">
          <p className="font-medium">Accountability partner on record</p>
          <p className="mt-1 text-muted-foreground">{chosen.partner.name || "Not on file"}{chosen.partner.email ? ` · ${chosen.partner.email}` : ""}{chosen.partner.phone ? ` · ${chosen.partner.phone}` : ""}</p>
          <p className="mt-2 text-muted-foreground">These details come from your cohort application, so there is nothing to re-enter. Your reason and these contact details are shared with the administrator reviewing this request.</p>
        </div>}
        <Button type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit appeal"}</Button>
      </fieldset></form> : <p>No closed modules are currently available for a new appeal. Check existing requests below.</p>}
      <section className="space-y-3"><h2 className="text-lg font-semibold">Your requests</h2>{appeals.length === 0 && <p>You haven’t submitted any appeals.</p>}{appeals.map(a => <article key={a.id} className="space-y-2 rounded-xl border p-4"><h3 className="font-semibold">{a.courseTitle} · {a.moduleTitle}</h3><p className="capitalize">{a.status}</p><p className="whitespace-pre-wrap break-words">{a.reason}</p><p className="text-sm text-muted-foreground">Submitted {localTime(a.createdAt)} WAT</p>{a.accessClosesAt && <p>Access closes {localTime(a.accessClosesAt)} WAT</p>}</article>)}</section>
    </>}
  </div>
}
