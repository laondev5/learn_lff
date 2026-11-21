import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getAdminCourses } from "@/actions/admin-course.actions"
import { AdminCoursesClient } from "@/components/admin/AdminCoursesClient"

export const dynamic = "force-dynamic"

export default async function AdminCoursesPage() {
  const session = await auth()
  if (session?.user.role !== "admin") redirect("/login")
  const data = await getAdminCourses()
  if ("error" in data) return <p role="alert" className="rounded-xl border p-6">{data.error}</p>
  return <AdminCoursesClient courses={data.courses} teachers={data.teachers} />
}
