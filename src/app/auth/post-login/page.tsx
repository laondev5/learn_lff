import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function PostLoginPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/auth/login")
  }

  if (session.user.mustChangePassword) {
    redirect("/auth/change-password")
  }

  if (session.user.role === "admin") {
    redirect("/admin/dashboard")
  }

  if (session.user.role === "teacher") {
    redirect("/teacher/dashboard")
  }

  redirect("/student/dashboard")
}
