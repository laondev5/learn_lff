import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { AdminAppealsClient } from "@/components/admin/AdminAppealsClient"

export const dynamic = "force-dynamic"

export default async function AdminAppealsPage() {
  const session = await auth()
  if (session?.user?.role !== "admin") redirect("/auth/login")
  return <AdminAppealsClient />
}
