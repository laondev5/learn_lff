import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function HomePage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/auth/login")
  }

  const role = session.user.role
  if (role === "admin") redirect("/admin/dashboard")
  if (role === "teacher") redirect("/teacher/dashboard")
  redirect("/student/dashboard")
}
