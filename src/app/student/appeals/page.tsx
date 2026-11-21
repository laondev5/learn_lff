import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { StudentAppealsClient } from "@/components/student/StudentAppealsClient"

export default async function StudentAppealsPage() {
  const session = await auth()
  if (session?.user.role !== "student") redirect("/login")
  return <StudentAppealsClient />
}
