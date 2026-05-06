import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getUserLandingPath } from "@/lib/auth-redirect"

const PUBLIC_ROUTES = ["/auth/login", "/auth/forgot-password", "/auth/change-password"]

const ROLE_ROUTES: Record<string, string[]> = {
  admin: ["/admin"],
  teacher: ["/teacher"],
  student: ["/student"],
}

export const proxy = auth((req) => {
  const { nextUrl } = req
  const pathname = nextUrl.pathname

  const isChangePassword = pathname.startsWith("/auth/change-password")
  const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname.startsWith(r))

  // Allow unauthenticated access to public routes (except change-password needs auth)
  if (isPublicRoute && !isChangePassword) {
    return NextResponse.next()
  }

  const user = req.auth?.user

  if (!user) {
    return NextResponse.redirect(new URL("/auth/login", nextUrl))
  }

  const role = user.role
  const mustChangePassword = user.mustChangePassword
  const landingPath = getUserLandingPath({ role, mustChangePassword })

  // Force password change for new users
  if (mustChangePassword && !isChangePassword) {
    return NextResponse.redirect(new URL("/auth/change-password", nextUrl))
  }

  // Allow the mandatory password change page for first-login users only.
  if (isChangePassword) {
    if (!mustChangePassword) {
      return NextResponse.redirect(new URL(landingPath, nextUrl))
    }
    return NextResponse.next()
  }

  // Redirect away from login if already authenticated
  if (isPublicRoute) {
    return NextResponse.redirect(new URL(landingPath, nextUrl))
  }

  // Enforce role-based route access
  for (const [routeRole, prefixes] of Object.entries(ROLE_ROUTES)) {
    if (prefixes.some((p) => pathname.startsWith(p)) && role !== routeRole) {
      return NextResponse.redirect(new URL(landingPath, nextUrl))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
