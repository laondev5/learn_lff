import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { validateUserCredentials } from "@/lib/auth-credentials"
import { writeSecurityAuditLog } from "@/lib/security-audit"

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const validation = await validateUserCredentials(
          String(credentials.email),
          String(credentials.password)
        )

        if (validation.status === "invalid") return null

        if (validation.status === "temporary_password_expired") {
          await writeSecurityAuditLog({
            event: "temporary_password_login_blocked",
            targetUserId: validation.user._id.toString(),
            email: validation.user.email,
            role: validation.user.role,
            status: "blocked",
            metadata: {
              temporaryPasswordExpiresAt:
                validation.user.temporaryPasswordExpiresAt?.toISOString(),
            },
          })
          return null
        }

        const { user } = validation

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          cohort: user.cohort,
          mustChangePassword: user.mustChangePassword,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!
        token.role = (user as { role: import("@/models/User.model").UserRole }).role
        token.cohort = (user as { cohort?: string }).cohort
        token.mustChangePassword = (user as { mustChangePassword?: boolean }).mustChangePassword ?? false
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as import("@/models/User.model").UserRole
      session.user.cohort = token.cohort as string | undefined
      session.user.mustChangePassword = token.mustChangePassword as boolean | undefined
      return session
    },
  },
})
