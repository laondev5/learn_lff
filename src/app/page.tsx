import { auth } from "@/auth"
import { redirect } from "next/navigation"

import LandingPage from "./landing/page"

export default async function HomePage() {
  const session = await auth()

  // Unauthenticated visitors see the landing page
  if (!session?.user) {
    return <LandingPage />
  }

  if (session.user.mustChangePassword) {
    redirect("/auth/change-password")
  }

  const role = session.user.role
  if (role === "admin") redirect("/admin/dashboard")
  if (role === "teacher") redirect("/teacher/dashboard")
  redirect("/student/dashboard")
}
