import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { connectDB } from "@/lib/mongoose"
import User from "@/models/User.model"
import { StudentLayoutClient } from "@/components/student/StudentLayoutClient"

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user || session.user.role !== "student") {
    redirect("/auth/login")
  }

  if (session.user.mustChangePassword) {
    redirect("/auth/change-password")
  }

  await connectDB()
  const user = await User.findById(session.user.id).lean()
  const profileComplete = !!(
    user?.country &&
    user?.state &&
    user?.city &&
    user?.ordination &&
    user?.kycStatus !== "not_started"
  )

  return (
    <StudentLayoutClient
      user={{
        name: session.user.name ?? "Student",
        email: session.user.email ?? "",
        role: session.user.role,
        imageUrl: session.user.image,
      }}
      profileComplete={profileComplete}
    >
      {children}
    </StudentLayoutClient>
  )
}
