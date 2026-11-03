import { auth } from "@/auth"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import LandingPage from "./landing/page"

export const metadata: Metadata = {
  title: "Living Faith Foundation | Learning Portal",
  description:
    "Video lessons in the foundations of the faith, church life and ministry, with lesson notes, questions inside the video, exams and certificates.",
}

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
