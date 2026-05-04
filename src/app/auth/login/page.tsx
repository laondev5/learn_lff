import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { LoginForm } from "@/components/auth/LoginForm"
import { getUserLandingPath } from "@/lib/auth-redirect"

export default async function LoginPage() {
  const session = await auth()

  if (session?.user) {
    redirect(
      getUserLandingPath({
        role: session.user.role,
        mustChangePassword: session.user.mustChangePassword,
      })
    )
  }

  return <LoginForm />
}
