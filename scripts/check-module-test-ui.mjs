/** Signed-in smoke check: module tests in the course UI + role scope. Secrets are read from git-ignored files. */
import fs from "node:fs"
import path from "node:path"

const BASE = process.env.LMS_BASE_URL ?? "http://localhost:26814"
const creds = JSON.parse(fs.readFileSync(path.join(process.cwd(), ".bot-test-accounts.json"), "utf8"))
const courseId = creds.courseId
const lines = []
const say = (s) => { lines.push(s); console.log(s) }

function applyCookies(res, jar) {
  for (const raw of res.headers.getSetCookie()) {
    const eq = raw.indexOf("=")
    if (eq < 0) continue
    const key = raw.slice(0, eq).trim()
    const value = raw.slice(eq + 1).split(";")[0]
    if (value) jar.set(key, value)
    else jar.delete(key)
  }
}
const cookieHeader = (jar) => [...jar].map(([k, v]) => `${k}=${v}`).join("; ")

async function login(email, password) {
  const jar = new Map()
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`)
  applyCookies(csrfRes, jar)
  const { csrfToken } = await csrfRes.json()
  const body = new URLSearchParams({
    csrfToken, email, password,
    callbackUrl: `${BASE}/`, json: "true", redirect: "false",
  })
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader(jar) },
    body,
    redirect: "manual",
  })
  applyCookies(res, jar)
  const sessionRes = await fetch(`${BASE}/api/auth/session`, { headers: { cookie: cookieHeader(jar) } })
  const session = await sessionRes.json()
  return { jar, session }
}

async function get(pathname, jar) {
  const res = await fetch(`${BASE}${pathname}`, {
    headers: { cookie: cookieHeader(jar) },
    redirect: "manual",
  })
  const text = await res.text()
  return { status: res.status, location: res.headers.get("location"), text }
}

const has = (text, needle) => text.toLowerCase().includes(needle.toLowerCase())

try {
  const student = await login(creds.accounts.student.email, creds.password)
  say(`student login: ${student.session?.user?.role ?? "FAILED"}`)

  const course = await get(`/student/courses/${courseId}`, student.jar)
  say(`course page: ${course.status}`)
  say(`  has "Module tests" heading: ${has(course.text, "Module tests")}`)
  say(`  has module-test curriculum row: ${has(course.text, "Module test:")}`)
  say(`  has fill-in-blank question sections: ${has(course.text, "SALVATION & REPENTANCE")}`)
  say(`  mentions one-module-per-day cadence: ${has(course.text, "One module opens per day")}`)
  say(`  mentions 24-hour window: ${has(course.text, "stays open for 24 hours")}`)
  say(`  appeal link shown: ${has(course.text, "/student/appeals")}`)
  say(`  closed-window reason shown: ${has(course.text, "24-hour window has closed")}`)
  say(`  ready-to-take tests: ${(course.text.match(/Ready to take/g) ?? []).length}`)

  const match = course.text.match(/\/student\/courses\/[a-f0-9]+\/tests\/[a-f0-9]+/i)
  const fallbackTestId = "6b01aed7aca42da69914df41"
  const testPath = match?.[0] ?? `/student/courses/${courseId}/tests/${fallbackTestId}`
  const testPage = await get(testPath, student.jar)
  say(`module test page: ${testPage.status} ${testPath}`)
  // The test runner is a client component, so the raw HTML only proves the route resolved.
  say(`  route resolved (not a 404): ${testPage.status === 200 && !has(testPage.text, "This page could not be found")}`)
  say(`  no stale "previous module" gate: ${!has(testPage.text, "previous module")}`)

  const testId = testPath.split("/").pop()
  if (/^[a-f0-9]{24}$/i.test(testId)) {
    const sessionRes = await fetch(`${BASE}/api/assessments/${testId}/session`, {
      headers: { cookie: cookieHeader(student.jar) },
    })
    const data = await sessionRes.json().catch(() => ({}))
    say(`assessment session API: ${sessionRes.status} ${data.error ? `error=${data.error}` : `title=${data.assessmentInfo?.title ?? "-"}`}`)
  }

  // Clean role-scope check against real pages (redirects are the expected denial).
  for (const [role, key] of [["admin", "admin"], ["teacher", "teacher"], ["student", "student"]]) {
    const account = creds.accounts[key]
    const auth = await login(account.email, creds.password)
    const allowed = await get(`/${role}/dashboard`, auth.jar)
    const others = [["admin", "teacher"], ["teacher", "student"], ["student", "admin"]]
      .filter(([r]) => r !== role)
    const denied = []
    for (const [other] of others) {
      const res = await get(`/${other}/dashboard`, auth.jar)
      denied.push(`${other}:${res.status}${res.location ? "->" + new URL(res.location, BASE).pathname : ""}`)
    }
    say(`scope ${role}: own=${allowed.status} others=[${denied.join(", ")}]`)
  }
} catch (e) {
  say(`ERROR ${e.message}`)
  process.exitCode = 1
}

fs.writeFileSync(path.join(process.cwd(), "scripts", "check-module-test-ui.log"), lines.join("\n") + "\n")
