import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getUserLandingPath } from "@/lib/auth-redirect"

export default async function PostLoginPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/auth/login")
  }

  redirect(
    getUserLandingPath({
      role: session.user.role,
      mustChangePassword: session.user.mustChangePassword,
    })
  )
}
