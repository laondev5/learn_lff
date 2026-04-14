import { UserRole } from "@/models/User.model"
import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: UserRole
      cohort?: string
      mustChangePassword?: boolean
    } & DefaultSession["user"]
  }

  interface User {
    role: UserRole
    cohort?: string
    mustChangePassword?: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: UserRole
    cohort?: string
    mustChangePassword?: boolean
  }
}
