import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { AdminLayoutClient } from "@/components/admin/AdminLayoutClient"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user || session.user.role !== "admin") {
    redirect("/auth/login")
  }

  if (session.user.mustChangePassword) {
    redirect("/auth/change-password")
  }

  return (
    <AdminLayoutClient
      user={{
        name: session.user.name ?? "Admin",
        email: session.user.email ?? "",
        role: session.user.role,
        imageUrl: session.user.image,
      }}
    >
      {children}
    </AdminLayoutClient>
  )
}
