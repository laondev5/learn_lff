import NextAuth from "next-auth"
import type { JWT } from "next-auth/jwt"
import Credentials from "next-auth/providers/credentials"
import { validateUserCredentials } from "@/lib/auth-credentials"
import { writeSecurityAuditLog } from "@/lib/security-audit"
import { getAuthSecret } from "@/lib/auth-secret"
import { checkRateLimit, clearRateLimit } from "@/lib/rate-limit"
import { connectDB } from "@/lib/mongoose"
import User from "@/models/User.model"
import type { UserRole } from "@/models/User.model"

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8
/** How often an existing JWT re-reads the account, so deactivations take effect quickly. */
const REVALIDATE_SECONDS = 60

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return forwarded || request.headers.get("x-real-ip") || "unknown"
}

/** Strip the identity claims so the session behaves as signed out. */
function invalidateToken(token: JWT) {
  const mutable = token as Partial<{
    id: string
    role: UserRole
    cohort: string
    mustChangePassword: boolean
    lastCheckedAt: number
  }>
  delete mutable.id
  delete mutable.role
  delete mutable.cohort
  delete mutable.mustChangePassword
  delete mutable.lastCheckedAt
  return token
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: getAuthSecret(),
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
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
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null

        const email = String(credentials.email).trim().toLowerCase()

        // Brute-force guard: per account and per source IP.
        const [byEmail, byIp] = await Promise.all([
          checkRateLimit("login-email", email, 10, 900),
          checkRateLimit("login-ip", clientIp(request), 40, 900),
        ])
        if (!byEmail.allowed || !byIp.allowed) {
          await writeSecurityAuditLog({
            event: "login_rate_limited",
            email,
            status: "blocked",
            ipAddress: clientIp(request),
          })
          return null
        }

        const validation = await validateUserCredentials(
          email,
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
        await clearRateLimit("login-email", email)

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
        token.role = (user as { role: UserRole }).role
        token.cohort = (user as { cohort?: string }).cohort
        token.mustChangePassword = (user as { mustChangePassword?: boolean }).mustChangePassword ?? false
        token.lastCheckedAt = Date.now()
        return token
      }

      if (!token.id) return token

      const needsCheck =
        !token.lastCheckedAt ||
        Date.now() - (token.lastCheckedAt as number) > REVALIDATE_SECONDS * 1000

      if (!needsCheck) return token

      await connectDB()
      const account = await User.findById(token.id)
        .select("role cohort isActive mustChangePassword passwordChangedAt")
        .lean()

      // Deactivated, or the password was changed after this token was issued:
      // the old token no longer grants anything.
      if (!account || !account.isActive) return invalidateToken(token)
      const issuedAt = token.iat ? token.iat * 1000 : 0
      if (
        issuedAt &&
        account.passwordChangedAt &&
        account.passwordChangedAt.getTime() > issuedAt
      ) {
        return invalidateToken(token)
      }

      token.role = account.role
      token.cohort = account.cohort
      token.mustChangePassword = account.mustChangePassword
      token.lastCheckedAt = Date.now()
      return token
    },
    async session({ session, token }) {
      // Claims were stripped by the jwt callback (deactivated account, deleted
      // account, or a password changed after this token was issued). Hand back no
      // user at all so every `session?.user` check treats this as signed out.
      if (!token.id) return { ...session, user: undefined } as unknown as typeof session

      session.user.id = token.id as string
      session.user.role = token.role as UserRole
      session.user.cohort = token.cohort as string | undefined
      session.user.mustChangePassword = token.mustChangePassword as boolean | undefined
      return session
    },
  },
})
