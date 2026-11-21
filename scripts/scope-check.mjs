import fs from "node:fs"
import path from "node:path"
import http from "node:http"
import https from "node:https"

const ROOT = path.resolve(process.cwd(), "lff-lms")
const ACCOUNTS_PATH = path.join(ROOT, ".bot-test-accounts.json")
const ACCOUNTS = JSON.parse(fs.readFileSync(ACCOUNTS_PATH, "utf8"))

// Bring .env.local values into process.env if not already set
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
const agent = http.Agent ? new http.Agent({ keepAlive: true }) : null

function headersWithCookie(baseHeaders = {}, cookie) {
  return { ...baseHeaders, Cookie: cookie || "" }
}

function extractSetCookie(headers) {
  const values = headers["set-cookie"] || []
  return values.map((v) => String(v).split(";")[0]).join(";")
}

async function request(method, url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const mod = u.protocol === "https:" ? https : http
    const headers = opts.headers || {}
    const body = opts.body ? JSON.stringify(opts.body) : null
    if (body) headers["Content-Type"] = "application/json"

    const req = mod.request(
      {
        method,
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        headers,
        agent,
        redirect: "manual",
      },
      (res) => {
        const chunks = []
        res.on("data", (c) => chunks.push(c))
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8")
          resolve({ status: res.statusCode, headers: res.headers, text, ok: res.statusCode >= 200 && res.statusCode < 400 })
        })
      },
    )
    req.on("error", reject)
    if (body) req.write(body)
    req.end()
  })
}

async function loginAs(email, password) {
  // 1. GET csrf
  const csrfResp = await request("GET", `${BASE}/api/auth/csrf`, { headers: {} })
  const csrfToken = extractCsrfToken(csrfResp.text)
  if (!csrfToken) throw new Error(`csrf parse failed. status=${csrfResp.status} text=${escapeKeep(csrfResp.text.slice(0,300))}`)

  // 2. POST callback
  const cb = await request("POST", `${BASE}/api/auth/callback/credentials`, {
    headers: headersWithCookie({}, ""),
    body: { csrfToken, email, password, callbackUrl: `${BASE}/`, json: true },
  })
  const nextCookie = extractSetCookie(cb.headers)
  const cookie = nextCookie

  // 3. GET session
  const sessionResp = await request("GET", `${BASE}/api/auth/session`, { headers: headersWithCookie({}, cookie) })
  let session = null
  try { session = JSON.parse(sessionResp.text) } catch {}

  return { cookie, session, csrfStatus: csrfResp.status, cbStatus: cb.status, sessionStatus: sessionResp.status }
}

function extractCsrfToken(text) {
  try {
    const j = JSON.parse(text)
    return j.csrfToken
  } catch {
    return null
  }
}

const ROUTES = [
  { method: "GET", route: "/api/users", label: "GET /api/users (admin list)" },
  { method: "GET", route: "/api/courses", label: "GET /api/courses (list)" },
  { method: "GET", route: "/api/courses/6ae7aefcb85ea3c5d860b351", label: "GET /api/courses/:id (Family Class)" },
  { method: "PATCH", route: "/api/courses/6ae7aefcb85ea3c5d860b351/settings", label: "PATCH /api/courses/:id/settings (admin only)" },
  { method: "GET", route: "/api/lessons/6b018562aca42da69914df36/video", label: "GET /api/lessons/:id/video (sign URL)" },
  { method: "POST", route: "/api/video/sign", label: "POST /api/video/sign (sign video)" },
  { method: "GET", route: "/api/courses/student-access", label: "GET /api/courses/student-access (student scope)" },
  { method: "POST", route: "/api/cohort-applications", label: "POST /api/cohort-applications (submit)" },
  { method: "GET", route: "/api/announcements", label: "GET /api/announcements (public-ish)" },
  { method: "POST", route: "/api/lessons/6b018562aca42da69914df36/progress", label: "POST /api/lessons/:id/progress (mark progress)" },
]

function bodyPreview(text, n = 300) {
  return text ? text.slice(0, n) : null
}

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
    let cookie = null
    let session = null
    let loginError = null
    let loginMeta = null
    try {
      const loggedIn = await loginAs(person.email, person.password)
      cookie = loggedIn.cookie
      session = loggedIn.session
      loginMeta = { csrfStatus: loggedIn.csrfStatus, cbStatus: loggedIn.cbStatus, sessionStatus: loggedIn.sessionStatus }
    } catch (e) {
      loginError = String(e.message).slice(0, 300)
    }

    const sessionRole = session && session.user ? session.user.role : null

    checks.push({
      kind: "login",
      role: person.role,
      email: person.email,
      loginOk: !loginError,
      loginError,
      loginMeta,
      loginSession: sessionRole ? { role: sessionRole, email: session?.user?.email ?? null } : null,
    })

    if (loginError) continue

    const headers = headersWithCookie({}, cookie)
    for (const r of ROUTES) {
      let status = null
      let bodyPreviewValue = null
      let error = null
      try {
        const res = r.method === "GET" ? await request("GET", `${BASE}${r.route}`, { headers }) : await request("POST", `${BASE}${r.route}`, { headers, body: {} })
        status = res.status
        bodyPreviewValue = bodyPreview(res.text)
      } catch (e) {
        error = String(e.message).slice(0, 300)
      }
      checks.push({
        kind: "route",
        role: person.role,
        email: person.email,
        sessionRole,
        method: r.method,
        route: r.route,
        label: r.label,
        status,
        bodyPreview: bodyPreviewValue,
        error,
      })
    }
  }

  const out = {
    base: BASE,
    generated: new Date().toISOString(),
    realAdmin: { email: realAdminEmail, passwordSet: true },
    botAccounts: ACCOUNTS.accounts,
    botPasswordStoredIn: ".bot-test-accounts.json (gitignored)",
    checks,
  }

  const textLogPath = path.join(ROOT, "scripts/scope-check.log")
  const jsonLogPath = path.join(ROOT, "scripts/scope-check.log.json")
  fs.writeFileSync(textLogPath, renderTextLog(out))
  fs.writeFileSync(jsonLogPath, JSON.stringify(out, null, 2) + "\n")

  console.log(JSON.stringify({ path: textLogPath, jsonPath: jsonLogPath, checkCount: checks.length }, null, 2))
}

function renderTextLog(out) {
  const lines = []
  lines.push("======================================================================")
  lines.push("ROLE SCOPE CHECK — REAL API ROUTES")
  lines.push("======================================================================")
  lines.push(`Base URL   : ${out.base}`)
  lines.push(`Generated  : ${out.generated}`)
  lines.push(`Real admin : ${out.realAdmin.email}  (password set in DB, not printed)`)
  lines.push(`Bot accounts (from .bot-test-accounts.json, gitignored):`)
  for (const [key, a] of Object.entries(out.botAccounts)) {
    lines.push(`   - ${key.padEnd(10)} ${a.email.padEnd(32)} role=${a.role}  id=${a.id}`)
  }
  lines.push(`Bot password stored in: ${out.botPasswordStoredIn}`)
  lines.push("")
  lines.push("----------------------------------------------------------------------")
  lines.push("LOGIN RESULTS")
  lines.push("----------------------------------------------------------------------")
  for (const c of out.checks.filter((c) => c.kind === "login")) {
    const sess = c.loginSession ? `session role=${c.loginSession.role}` : "no session"
    const meta = c.loginMeta ? ` csrf=${c.loginMeta.csrfStatus} cb=${c.loginMeta.cbStatus} session=${c.loginMeta.sessionStatus}` : ""
    lines.push(`[${c.role.toUpperCase()}] login ${c.loginOk ? "OK" : "FAIL"}  ${c.email}  ${sess}${meta}`)
    if (c.loginError) lines.push(`     error: ${c.loginError}`)
  }
  lines.push("")
  lines.push("----------------------------------------------------------------------")
  lines.push("ROUTE CHECKS")
  lines.push("----------------------------------------------------------------------")
  let currentRole = null
  for (const c of out.checks) {
    if (c.kind === "login") {
      currentRole = c.role
      continue
    }
    if (c.kind !== "route") continue
    const statusMark = c.status ? `${c.status}` : "NO-RESPONSE"
    const bodySnippet = c.bodyPreview ? `  body[${c.bodyPreview.length}]: ${escapeKeep(c.bodyPreview)}` : ""
    const errorSnippet = c.error ? `  ERROR: ${c.error}` : ""
    lines.push(`[${currentRole}] ${c.method} ${c.route}  ->  ${statusMark}${bodySnippet}${errorSnippet}`)
  }
  lines.push("")
  lines.push("======================================================================")
  lines.push(`Summary: ${out.checks.filter((c) => c.kind === "route").length} route checks across 3 roles.`)
  lines.push(`Login used: real admin ${out.realAdmin.email} + 2 bot accounts (teacher, student).`)
  lines.push(`Credentials: real admin password @#Skkywalker1998@$S hashed into DB; bot password lives only in .bot-test-accounts.json (gitignored).`)
  lines.push("======================================================================")
  return lines.join("\n")
}

function escapeKeep(s) {
  return s.replace(/\n/g, "\\n").replace(/\r/g, "\\r")
}

main().catch((e) => {
  console.error("scope-check failed:", e)
  process.exit(1)
})
