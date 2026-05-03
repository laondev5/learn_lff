import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function HomePage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/auth/login")
  }

  if (session.user.mustChangePassword) {
    redirect("/auth/change-password")
  }

  const role = session.user.role
  if (role === "admin") redirect("/admin/dashboard")
  if (role === "teacher") redirect("/teacher/dashboard")
  redirect("/student/dashboard")
}
