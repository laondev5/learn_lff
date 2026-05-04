import type { UserRole } from "@/models/User.model"

export function getUserLandingPath({
  role,
  mustChangePassword,
}: {
  role: UserRole
  mustChangePassword?: boolean
}) {
  if (mustChangePassword) {
    return "/auth/change-password"
  }

  if (role === "admin") {
    return "/admin/dashboard"
  }

  if (role === "teacher") {
    return "/teacher/dashboard"
  }

  return "/student/dashboard"
}
