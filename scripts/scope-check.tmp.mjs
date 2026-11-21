import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(process.cwd(), "lff-lms")
const ACCOUNTS_PATH = path.join(ROOT, ".bot-test-accounts.json")
const ACCOUNTS = JSON.parse(fs.readFileSync(ACCOUNTS_PATH, "utf8"))

for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) { const k = m[1].trim(); if (!process.env[k]) process.env[k] = m[2].trim() }
}

const BASE = process.env.SCOPE_BASE_URL || "http://localhost:26814"

async function loginAs(email, password) {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { redirect: "follow" })
  const csrfText = await csrfRes.text()
  const csrfToken = (() => { try { return JSON.parse(csrfText).csrfToken } catch { return null } })()
  if (!csrfToken) throw new Error(`csrf parse failed: ${csrfText.slice(0,200)}`)

  const cb = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: "" },
    body: JSON.stringify({ csrfToken, email, password, callbackUrl: `${BASE}/`, json: true }),
    redirect: "manual",
  })
  const cookies = []
  for (const v of cb.headers.raw()["set-cookie"] || []) cookies.push(v.split(";")[0])
  const cookie = cookies.join(";")
  const sessionRes = await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: cookie } })
  let session = null
  try { session = await sessionRes.json() } catch {}
  return { cookie, session }
}

const ROUTES = [
  { method: "GET", route: "/api/users", label: "GET /api/users (admin list)" },
  { method: "GET", route: "/api/courses", label: "GET /api/courses (list)" },
  { method: "GET", route: "/api/courses/6ae7aefcb85ea3c5d860b351", label: "GET /api/courses/:id (Family Class)" },
  { method: "PATCH", route: "/api/courses/6ae7aefcb85ea3c5d860b351/settings", label: "PATCH /api/courses/:id/settings" },
  { method: "GET", route: "/api/lessons/6b018562aca42da69914df36/video", label: "GET /api/lessons/:id/video (sign URL)" },
  { method: "POST", route: "/api/video/sign", label: "POST /api/video/sign" },
  { method: "GET", route: "/api/courses/student-access", label: "GET /api/courses/student-access (student scope)" },
  { method: "POST", route: "/api/cohort-applications", label: "POST /api/cohort-applications (submit)" },
  { method: "GET", route: "/api/announcements", label: "GET /api/announcements" },
  { method: "POST", route: "/api/lessons/6b018562aca42da69914df36/progress", label: "POST /api/lessons/:id/progress" },
]

async function main() {
  const realAdminEmail = "admin@learn.livingfaithfoundation.org"
  const realAdminPassword = "@#Skkywalker1998@$S"
  const folks = [
    { role: "admin", email: realAdminEmail, password: realAdminPassword },
    { role: "teacher", email: ACCOUNTS.accounts.teacher.email, password: ACCOUNTS.password },
    { role: "student", email: ACCOUNTS.accounts.student.email, password: ACCOUNTS.password },
  ]
  const checks = []
  for (const person of folks) {
    let cookie; let session; let loginError = null
    try { ({ cookie, session } = await loginAs(person.email, person.password)) }
    catch (e) { loginError = String(e.message).slice(0, 300) }
    checks.push({ role: person.role, loginError, loginSession: session ? { role: session.user?.role, email: session.user?.email } : null })
    if (loginError) continue
    const headers = { Cookie: cookie }
    for (const r of ROUTES) {
      let status = null, bodyPreview = null, error = null
      try {
        const res = r.method === "GET" ? await fetch(`${BASE}${r.route}`, { headers, redirect: "manual" }) : await fetch(`${BASE}${r.route}`, { method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({}), redirect: "manual" })
        status = res.status
        try { bodyPreview = (await res.text()).slice(0, 300) } catch {}
      } catch (e) { error = String(e.message).slice(0, 300) }
      checks.push({ role: person.role, method: r.method, route: r.route, label: r.label, status, bodyPreview, error })
    }
  }
  const out = { base: BASE, generated: new Date().toISOString(), realAdmin: { email: realAdminEmail, passwordSet: true }, botAccounts: ACCOUNTS.accounts, botPasswordStoredIn: ".bot-test-accounts.json (gitignored)", checks }
  fs.writeFileSync(path.join(ROOT, "scripts/scope-check.log"), JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ path: path.join(ROOT, "scripts/scope-check.log"), checks: out.checks.length }, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })
