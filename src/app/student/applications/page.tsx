import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { StudentApplicationsClient } from "@/components/student/StudentApplicationsClient"

export default async function StudentApplicationsPage() {
  const session = await auth()
  if (session?.user.role !== "student") redirect("/login")
  return <StudentApplicationsClient />
}
