import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcryptjs from "bcryptjs"
import { connectDB } from "@/lib/mongoose"
import User from "@/models/User.model"

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

        await connectDB()

        const user = await User.findOne({
          email: String(credentials.email).toLowerCase(),
          isActive: true,
        })

        if (!user) return null

        const isValid = await bcryptjs.compare(
          String(credentials.password),
          user.hashedPassword
        )

        if (!isValid) return null

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
