import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import https from "node:https"

const ROOT = path.resolve(process.cwd(), "lff-lms")
const ACCOUNTS_PATH = path.join(ROOT, ".bot-test-accounts.json")
const ACCOUNTS = JSON.parse(fs.readFileSync(ACCOUNTS_PATH, "utf8"))

// Load .env.local into process.env if not already set (so NEXTAUTH_SECRET etc. are available)
{
  const envPath = path.join(ROOT, ".env.local")
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) {
      const key = m[1].trim()
      if (!process.env[key]) process.env[key] = m[2].trim()
    }
  }
}

const BASE = process.env.SCOPE_BASE_URL || "http://localhost:26814"

function post(url, body, opts = {}) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    ...opts,
  })
}

function get(url, opts = {}) {
  return fetch(url, { ...opts })
}

function parseCsrfToken(text) {
  try {
    const j = JSON.parse(text)
    return j.csrfToken
  } catch {
    return null
  }
}

async function loginAs(email, password, cookieJar) {
  // 1. GET csrf
  const csrfRes = await get(`${BASE}/api/auth/csrf`, { redirect: "follow" })
  const csrfText = await csrfRes.text()
  const csrfToken = parseCsrfToken(csrfText)
  if (!csrfToken) throw new Error(`csrf parse failed for ${email}: ${csrfText.slice(0,200)}`)

  // 2. POST callback
  const cb = await post(
    `${BASE}/api/auth/callback/credentials`,
    {
      csrfToken,
      email,
      password,
      callbackUrl: `${BASE}/`,
      json: true,
    },
    { redirect: "manual", headers: { Cookie: cookieJar ? cookieJar.read() : "" } },
  )
  // collect set-cookie
  const newCookies = []
  for (const v of cb.headers.raw()["set-cookie"] || []) {
    newCookies.push(v.split(";")[0])
  }
  const combined = cookieJar ? cookieJar.read() : ""
  const jar = new CookieJar((combined ? combined + ";" : "") + newCookies.join(";"))
  // 3. GET session to confirm
  const sessionRes = await get(`${BASE}/api/auth/session`, { headers: { Cookie: jar.read() } })
  const sessionText = await sessionRes.text()
  let session = null
  try { session = JSON.parse(sessionText) } catch {}
  return { jar, session }
}

class CookieJar {
  constructor(initial = "") {
    this.cookie = initial || ""
  }
  read() {
    return this.cookie
  }
}

const ROUTES = [
  // Admin-only-ish / shared
  { method: "GET", route: "/api/users", admin: true, teacher: false, student: false, label: "GET /api/users (admin list)" },
  { method: "GET", route: "/api/courses", admin: true, teacher: true, student: true, label: "GET /api/courses (list)" },
  { method: "GET", route: "/api/courses/6ae7aefcb85ea3c5d860b351", admin: true, teacher: true, student: true, label: "GET /api/courses/:id (Family Class)" },
  { method: "PATCH", route: "/api/courses/6ae7aefcb85ea3c5d860b351/settings", admin: true, teacher: false, student: false, label: "PATCH /api/courses/:id/settings (admin only)" },
  { method: "GET", route: "/api/lessons/6b018562aca42da69914df36/video", admin: true, teacher: true, student: true, label: "GET /api/lessons/:id/video (sign URL)" },
  { method: "POST", route: "/api/video/sign", admin: true, teacher: true, student: false, label: "POST /api/video/sign (sign video)" },
  { method: "GET", route: "/api/courses/student-access", admin: true, teacher: false, student: true, label: "GET /api/courses/student-access (student scope)" },
  { method: "POST", route: "/api/cohort-applications", admin: true, teacher: true, student: false, label: "POST /api/cohort-applications (submit)" },
  { method: "GET", route: "/api/announcements", admin: true, teacher: true, student: true, label: "GET /api/announcements (public-ish)" },
  { method: "POST", route: "/api/lessons/6b018562aca42da69914df36/progress", admin: true, teacher: true, student: true, label: "POST /api/lessons/:id/progress (mark progress)" },
]

async function main() {
  const results = []
  const realAdminEmail = process.env.SCOPE_CHECK_ADMIN_EMAIL ?? "admin@learn.livingfaithfoundation.org"
  const realAdminPassword = process.env.SCOPE_CHECK_ADMIN_PASSWORD
  if (!realAdminPassword) {
    console.error("Set SCOPE_CHECK_ADMIN_PASSWORD in the shell before running this check.")
    process.exit(1)
  }

  const folks = [
    { role: "admin", email: realAdminEmail, password: realAdminPassword },
    { role: "teacher", email: ACCOUNTS.accounts.teacher.email, password: ACCOUNTS.password },
    { role: "student", email: ACCOUNTS.accounts.student.email, password: ACCOUNTS.password },
  ]

  for (const person of folks) {
    console.error(`logging in as ${person.role} ${person.email}`)
    let jar
    try {
      ({ jar } = await loginAs(person.email, person.password, null))
    } catch (e) {
      results.push({ role: person.role, loginError: String(e.message).slice(0, 300) })
      continue
    }
    const headers = { Cookie: jar.read() }
    for (const r of ROUTES) {
      const allowed = r.admin && person.role === "admin" || r.teacher && person.role === "teacher" || r.student && person.role === "student" || (r.admin === undefined && r.teacher === undefined && r.student === undefined)
      const skipExpected = person.role !== "admin" && r.admin === true
      let status = null
      let bodyPreview = null
      let error = null
      try {
        const req = r.method === "GET" ? get(`${BASE}${r.route}`, { headers, redirect: "manual" }) : post(`${BASE}${r.route}`, {}, { headers, redirect: "manual" })
        const res = await req
        status = res.status
        try {
          const text = await res.text()
          bodyPreview = text.slice(0, 300)
        } catch {}
      } catch (e) {
        error = String(e.message).slice(0, 300)
      }
      results.push({
        role: person.role,
        route: r.route,
        method: r.method,
        label: r.label,
        status,
        bodyPreview,
        error,
        expected: allowed ? "allowed" : "denied-or-unavailable",
      })
    }
  }

  const out = {
    base: BASE,
    generated: new Date().toISOString(),
    realAdmin: { email: realAdminEmail, passwordSet: true },
    botAccounts: ACCOUNTS.accounts,
    botPasswordStoredIn: ".bot-test-accounts.json (gitignored)",
    checks: results,
  }

  const outPath = path.join(ROOT, "scripts/scope-check.log.json")
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2))
  fs.writeFileSync(path.join(ROOT, "scripts/scope-check.log"), JSON.stringify(out, null, 2, 10))
  console.log(JSON.stringify({ path: outPath, summary: summarize(out) }, null, 2))
}

function summarize(out) {
  const byRole = {}
  for (const c of out.checks) {
    const r = c.role
    if (!byRole[r]) byRole[r] = []
    byRole[r].push(c)
  }
  const lines = []
  for (const role of ["admin", "teacher", "student"]) {
    const checks = byRole[role] || []
    const ok = checks.filter((c) => c.error ? false : true)
    const failed = ok.filter((c) => {
      if (c.expected === "denied-or-unavailable") return false
      return c.status && c.status >= 400
    })
    lines.push(`${role}: ${checks.length} routes checked, ${failed.length} returned 4xx/5xx where allowed`)
    for (const c of failed.slice(0, 5)) {
      lines.push(`  - ${c.method} ${c.route} -> ${c.status} ${c.bodyPreview ? c.bodyPreview.slice(0, 140) : ""}`)
    }
    if (c => c.loginError) {
      for (const c of checks) {
        if (c.loginError) lines.push(`  login error: ${c.loginError}`)
      }
    }
  }
  return lines.join("\n")
}

main().catch((e) => {
  console.error("scope-check failed:", e)
  process.exit(1)
})
