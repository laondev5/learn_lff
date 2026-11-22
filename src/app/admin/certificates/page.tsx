import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { AdminCertificatesClient } from "@/components/admin/AdminCertificatesClient"

export const dynamic = "force-dynamic"

export default async function AdminCertificatesPage() {
  const session = await auth()
  if (session?.user?.role !== "admin") redirect("/auth/login")
  return <AdminCertificatesClient />
}
