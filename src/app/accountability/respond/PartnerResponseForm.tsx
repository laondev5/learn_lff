"use client"

import { useRef, useState } from "react"
import { respondToPartnerInvitation } from "@/actions/cohort-application.actions"
import { Button } from "@/components/ui/button"

export function PartnerResponseForm({ token, invitation }: { token: string; invitation: { studentName: string; partnerName: string; cohort: string } }) {
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [error, setError] = useState("")
  const [decision, setDecision] = useState<"accepted" | "rejected" | null>(null)
  async function respond(value: "accepted" | "rejected") {
    if (pending.current || decision) return
    pending.current = true
    setBusy(true)
    setError("")
    try {
      const result = await respondToPartnerInvitation(token, value)
      if ("error" in result) setError(result.error ?? "Unable to save your response. Please retry.")
      else setDecision(value)
    } catch { setError("Your response could not be confirmed. Please retry or refresh to check whether this invitation is still pending.") }
    finally { pending.current = false; setBusy(false) }
  }
  if (decision) return <section role="status" className="space-y-3 rounded-lg border p-6"><h2 className="text-xl font-semibold">{decision === "accepted" ? "Invitation accepted" : "Invitation declined"}</h2><p>{decision === "accepted" ? `You are now ${invitation.studentName}’s accountability partner. Their application has been accepted. You will receive notices if they miss a module deadline.` : `Your response has been saved. ${invitation.studentName}’s application has been rejected.`}</p><p className="text-sm text-muted-foreground">You may close this page.</p></section>
  return <section className="space-y-6" aria-busy={busy}>
    <div className="space-y-3"><p>Dear Pastor {invitation.partnerName},</p><p><strong>{invitation.studentName}</strong> has applied to <strong>{invitation.cohort}</strong> and named you as their pastor and accountability partner.</p><p>By accepting, you agree to receive notifications if they miss a module deadline. Their admission remains pending until you accept. Declining rejects their application.</p><p className="text-sm text-muted-foreground">Opening this page does not record a decision. Choose a response below to confirm it.</p></div>
    {error && <p role="alert" className="rounded-md border border-destructive/30 p-4 text-sm text-destructive">{error}</p>}
    <div className="flex flex-col gap-3 sm:flex-row"><Button type="button" disabled={busy} onClick={() => void respond("accepted")}>Accept accountability role</Button><Button type="button" variant="outline" disabled={busy} onClick={() => void respond("rejected")}>Decline and reject application</Button></div>
    {busy && <p role="status" className="text-sm text-muted-foreground">Saving your response…</p>}
  </section>
}
