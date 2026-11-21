import { CohortManagementClient } from "@/components/shared/CohortManagementClient"
import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function TeacherCohortsPage() {
  const session = await auth()
  if (session?.user.role !== "teacher") redirect("/login")
  return <CohortManagementClient role="teacher" />
}
