import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { connectDB } from "@/lib/mongoose"
import User from "@/models/User.model"
import { TeacherLayoutClient } from "@/components/teacher/TeacherLayoutClient"

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user || session.user.role !== "teacher") {
    redirect("/auth/login")
  }

  await connectDB()
  const user = await User.findById(session.user.id).lean()
  const profileComplete = !!(user?.country && user?.state && user?.city && user?.ordination)

  return (
    <TeacherLayoutClient
      user={{
        name: session.user.name ?? "Teacher",
        email: session.user.email ?? "",
        role: session.user.role,
        imageUrl: session.user.image,
      }}
      profileComplete={profileComplete}
    >
      {children}
    </TeacherLayoutClient>
  )
}
