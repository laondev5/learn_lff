import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getAdminPayments } from "@/actions/admin-course.actions"
import { AdminPaymentsClient } from "@/components/admin/AdminPaymentsClient"

export const dynamic = "force-dynamic"

export default async function AdminPaymentsPage() {
  const session = await auth()
  if (session?.user.role !== "admin") redirect("/login")
  const data = await getAdminPayments()
  if ("error" in data) return <p role="alert" className="rounded-xl border p-6">{data.error}</p>
  return <AdminPaymentsClient summary={data.summary} payments={data.payments} />
}
