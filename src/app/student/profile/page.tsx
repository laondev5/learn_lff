import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { connectDB } from "@/lib/mongoose"
import User from "@/models/User.model"
import { ProfileForm } from "@/components/shared/ProfileForm"

export default async function StudentProfilePage() {
  const session = await auth()
  if (!session?.user || session.user.role !== "student") redirect("/auth/login")

  await connectDB()
  const user = await User.findById(session.user.id).lean()
  if (!user) redirect("/auth/login")

  return (
    <ProfileForm
      current={{
        name: user.name,
        email: user.email,
        role: user.role,
        church: user.church,
        district: user.district,
        cohort: user.cohort,
        country: user.country,
        state: user.state,
        city: user.city,
        ordination: user.ordination,
      }}
    />
  )
}
