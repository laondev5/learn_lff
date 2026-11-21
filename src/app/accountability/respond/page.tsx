import Link from "next/link"
import type { Metadata } from "next"
import { getPartnerInvitation } from "@/actions/cohort-application.actions"
import { PartnerResponseForm } from "./PartnerResponseForm"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Accountability invitation | LFF Learning Portal", robots: { index: false, follow: false }, referrer: "no-referrer" }
export default async function PartnerResponsePage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const params = await searchParams
  const token = typeof params.token === "string" ? params.token : ""
  let invitation: Awaited<ReturnType<typeof getPartnerInvitation>> = null
  let unavailable = false
  try { invitation = await getPartnerInvitation(token) } catch { unavailable = true }
  return <main className="min-h-screen bg-background px-5 py-12"><div className="mx-auto max-w-xl space-y-7">
    <Link href="/" className="text-sm font-semibold text-primary underline underline-offset-4">Living Faith Foundation · Learning Portal</Link>
    <h1 className="text-3xl font-bold tracking-tight">Accountability partner invitation</h1>
    {unavailable ? <p role="alert">We could not load the invitation. Please refresh this page to try again. No response has been recorded.</p> : invitation ? <PartnerResponseForm token={token} invitation={invitation} /> : <div className="space-y-3 rounded-lg border p-6"><h2 className="text-xl font-semibold">This invitation is unavailable</h2><p>The link may have expired, been replaced, or already been answered. Ask the student to check their application status and resend a pending invitation if needed.</p></div>}
  </div></main>
}
