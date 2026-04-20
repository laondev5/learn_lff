import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { connectDB } from "@/lib/mongoose"
import User from "@/models/User.model"
import { ProfileForm } from "@/components/shared/ProfileForm"
import { GoogleCalendarConnect } from "@/components/teacher/GoogleCalendarConnect"

export default async function TeacherProfilePage() {
  const session = await auth()
  if (!session?.user || session.user.role !== "teacher") redirect("/auth/login")

  await connectDB()
  const user = await User.findById(session.user.id).lean()
  if (!user) redirect("/auth/login")

  return (
    <div className="space-y-6">
      <ProfileForm
        current={{
          name: user.name,
          email: user.email,
          role: user.role,
          church: user.church,
          district: user.district,
          country: user.country,
          state: user.state,
          city: user.city,
          ordination: user.ordination,
        }}
      />

      <div className="max-w-xl">
        <GoogleCalendarConnect isConnected={!!user.googleRefreshToken} />
      </div>
    </div>
  )
}
