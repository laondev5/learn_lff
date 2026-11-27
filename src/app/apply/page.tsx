import Link from "next/link"
import type { Metadata } from "next"
import { getOpenCohortSchedules } from "@/actions/cohort-application.actions"
import { AuthLayout } from "@/components/auth/AuthLayout"
import { ApplicationForm } from "./ApplicationForm"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Apply for a cohort | LFF Learning Portal" }

const paymentNotice: Record<string, { ok: boolean; text: string }> = {
  success: { ok: true, text: "Payment received. Your application is saved; admission still waits for your pastor to accept the accountability partner role. We will email your one-time set-password link after that." },
  pending: { ok: false, text: "We have not been able to confirm your payment yet. If you were charged, it will be confirmed automatically — do not pay twice. Contact your assembly if it is still unconfirmed after a few hours." },
  failed: { ok: false, text: "Your payment was not completed, so no place has been confirmed. You can submit the form again to retry the payment." },
  unknown: { ok: false, text: "We could not find that payment. If you were charged, contact your assembly with your payment reference before paying again." },
}

export default async function ApplyPage({ searchParams }: { searchParams: Promise<{ payment?: string; course?: string; schedule?: string }> }) {
  const { payment, schedule } = await searchParams
  const notice = payment ? paymentNotice[payment] : undefined
  let schedules: Awaited<ReturnType<typeof getOpenCohortSchedules>> = []
  let unavailable = false
  try { schedules = await getOpenCohortSchedules() } catch { unavailable = true }

  return (
    <AuthLayout wide>
      <div className="w-full max-w-2xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="text-sm font-semibold text-primary underline underline-offset-4">
            Living Faith Foundation · Learning Portal
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            Back to home
          </Link>
        </div>

        <header className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Apply for your next cohort</h1>
          <p className="max-w-2xl text-muted-foreground leading-relaxed">
            Create your student account and choose a course with open registration. Applications stay open until one week after the cohort starts. Your pastor will receive an invitation to serve as your accountability partner. Admission remains pending until they accept.
          </p>
        </header>

        {notice && (
          <div role="status" className={`rounded-xl border p-5 text-sm ${notice.ok ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5 text-destructive"}`}>
            {notice.text}
          </div>
        )}

        <p className="text-sm">
          Already have an account?{" "}
          <Link href="/student/applications" className="font-medium text-primary underline underline-offset-4">
            Sign in and apply from Applications
          </Link>.
        </p>

        {unavailable ? (
          <div role="alert" className="rounded-xl border p-6">
            We could not load upcoming cohorts. Please refresh this page in a moment.
          </div>
        ) : (
          <ApplicationForm schedules={schedules} preselectSchedule={schedule} />
        )}
      </div>
    </AuthLayout>
  )
}
