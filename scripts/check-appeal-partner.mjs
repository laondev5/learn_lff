/** Temporary check: the appeals form must reuse the accountability partner on file, not re-ask. */
import fs from "node:fs"
import path from "node:path"

const BASE = process.env.LMS_BASE_URL ?? "http://localhost:26814"
const creds = JSON.parse(fs.readFileSync(path.join(process.cwd(), ".bot-test-accounts.json"), "utf8"))

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
  const body = new URLSearchParams({ csrfToken, email, password, callbackUrl: `${BASE}/`, json: "true", redirect: "false" })
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader(jar) },
    body, redirect: "manual",
  })
  applyCookies(res, jar)
  const session = await (await fetch(`${BASE}/api/auth/session`, { headers: { cookie: cookieHeader(jar) } })).json()
  return { jar, session }
}

const student = { email: creds.accounts.student.email, password: creds.password }
const { jar, session } = await login(student.email, student.password)
console.log("login:", session?.user?.email, "role:", session?.user?.role)

const res = await fetch(`${BASE}/student/appeals`, { headers: { cookie: cookieHeader(jar) }, redirect: "manual" })
const text = await res.text()
const has = (needle) => text.toLowerCase().includes(needle.toLowerCase())
console.log("status:", res.status)
console.log("has 'Access appeals' heading:", has("Access appeals"))
// These two are the point of the check: the form must not re-ask for the partner.
console.log("still asks Superior’s name:", has("Superior’s name"))
console.log("still asks Superior’s email:", has("Superior’s email"))
// The form itself mounts client-side, so the partner card only appears after hydration.
console.log("(informational) SSR shows loading state:", has("Loading appeals"))
