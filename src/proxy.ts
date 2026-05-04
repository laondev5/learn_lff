import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { getAuthSecret } from "@/lib/auth-secret"

const PUBLIC_ROUTES = ["/auth/login", "/auth/forgot-password", "/auth/change-password"]

const ROLE_ROUTES: Record<string, string[]> = {
  admin: ["/admin"],
  teacher: ["/teacher"],
  student: ["/student"],
}

function getDefaultRoute(role: string): string {
  if (role === "admin") return "/admin/dashboard"
  if (role === "teacher") return "/teacher/dashboard"
  return "/student/dashboard"
}

export async function proxy(req: NextRequest) {
  const { nextUrl } = req
  const pathname = nextUrl.pathname

  const isChangePassword = pathname.startsWith("/auth/change-password")
  const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname.startsWith(r))

  // Allow unauthenticated access to public routes (except change-password needs auth)
  if (isPublicRoute && !isChangePassword) {
    return NextResponse.next()
  }

  const token = await getToken({ req, secret: getAuthSecret() })

  if (!token) {
    return NextResponse.redirect(new URL("/auth/login", nextUrl))
  }

  const role = token.role as string
  const mustChangePassword = token.mustChangePassword as boolean | undefined

  // Force password change for new users
  if (mustChangePassword && !isChangePassword) {
    return NextResponse.redirect(new URL("/auth/change-password", nextUrl))
  }

  // Already logged in and visiting change-password: allow
  if (isChangePassword) {
    return NextResponse.next()
  }

  // Redirect away from login if already authenticated
  if (isPublicRoute) {
    return NextResponse.redirect(new URL(getDefaultRoute(role), nextUrl))
  }

  // Enforce role-based route access
  for (const [routeRole, prefixes] of Object.entries(ROLE_ROUTES)) {
    if (prefixes.some((p) => pathname.startsWith(p)) && role !== routeRole) {
      return NextResponse.redirect(new URL(getDefaultRoute(role), nextUrl))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
