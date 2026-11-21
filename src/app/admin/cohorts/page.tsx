import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { CohortManagementClient } from "@/components/shared/CohortManagementClient"
import { getCohortApplicants, getCohortRoster } from "@/actions/cohort.actions"
import { CohortRosterClient } from "@/components/admin/CohortRosterClient"

export default async function AdminCohortsPage() {
  const session = await auth()
  if (session?.user.role !== "admin") redirect("/login")
  const [data, roster] = await Promise.all([getCohortApplicants(), getCohortRoster()])
  const statuses = { pending: "Pending pastor response · not admitted", accepted: "Pastor accepted · admitted", rejected: "Pastor rejected · application declined" }
  return <div className="space-y-8"><CohortManagementClient role="admin" />
    <section className="space-y-4">{"error" in roster ? <p role="alert">{roster.error}</p> : <CohortRosterClient cohorts={roster.cohorts} />}</section>
    <section className="space-y-4 rounded-xl border p-5"><h2 className="text-xl font-semibold">Cohort applicants</h2><p className="text-sm text-muted-foreground">Read-only application and partner response status. Reload this page to see new responses. Admission decisions are made through the pastor’s invitation.</p>
      {"error" in data ? <p role="alert">{data.error}</p> : data.applicants.length === 0 ? <p>No cohort applications yet.</p> : data.applicants.map(a => <article key={a.id} className="space-y-2 rounded-lg border p-4"><h3 className="font-semibold">{a.studentName} · {a.courseTitle}</h3><p>{a.cohort} · {statuses[a.status]}</p><p className="text-sm">{a.state || "State not given"} · {a.district || "District not given"} · {a.church || "Branch not given"}</p><p className="break-words text-sm">Pastor {a.partnerName} · {a.partnerEmail}</p><p className="text-sm text-muted-foreground">Invitation delivery: {a.emailStatus}{a.passwordSetupEmailStatus ? ` · Set-password email: ${a.passwordSetupEmailStatus}` : ""}</p></article>)}
    </section>
  </div>
}
