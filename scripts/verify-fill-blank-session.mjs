/** Temporary, self-restoring check that a module test serves fill_blank questions to the taker API. */
import fs from "node:fs"
import path from "node:path"
import mongoose from "mongoose"

const BASE = process.env.LMS_BASE_URL ?? "http://localhost:26814"
const TEST_ID = process.env.MODULE_TEST_ID ?? "6b01aed7aca42da69914df41"
const creds = JSON.parse(fs.readFileSync(path.join(process.cwd(), ".bot-test-accounts.json"), "utf8"))
for (const line of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const lines = []
const say = (s) => { lines.push(s); console.log(s) }
function applyCookies(res, jar) {
  for (const raw of res.headers.getSetCookie()) {
    const eq = raw.indexOf("=")
    if (eq < 0) continue
    const key = raw.slice(0, eq).trim()
    const value = raw.slice(eq + 1).split(";")[0]
    if (value) jar.set(key, value); else jar.delete(key)
  }
}
const cookieHeader = (jar) => [...jar].map(([k, v]) => `${k}=${v}`).join("; ")

let restore = null
let createdSessionId = null
try {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  const db = mongoose.connection.db
  const test = await db.collection("assessments").findOne({ _id: new mongoose.Types.ObjectId(TEST_ID) })
  if (!test) throw new Error("module test not found")
  const student = await db.collection("users").findOne({ email: creds.accounts.student.email })
  const progress = await db.collection("studentprogresses").findOne({
    student: student._id, course: test.course,
  })
  if (!progress) throw new Error("bot student progress not found")
  const videoLessons = await db.collection("lessons").find({
    module: test.module, isPublished: true, lessonType: "video",
  }).project({ _id: 1 }).toArray()

  restore = {
    studentId: progress.student,
    courseId: progress.course,
    viewedLessons: progress.viewedLessons ?? [],
    completedLessons: progress.completedLessons ?? [],
  }
  const ids = videoLessons.map((l) => l._id)
  await db.collection("studentprogresses").updateOne({ _id: progress._id }, {
    $set: {
      viewedLessons: [...new Set([...(restore.viewedLessons.map(String)), ...ids.map(String)])],
      completedLessons: [...new Set([...(restore.completedLessons.map(String)), ...ids.map(String)])],
    },
  })
  say(`temporarily marked ${ids.length} module videos viewed for bot student`)

  const jar = new Map()
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`)
  applyCookies(csrfRes, jar)
  const { csrfToken } = await csrfRes.json()
  const body = new URLSearchParams({
    csrfToken, email: creds.accounts.student.email, password: creds.password,
    callbackUrl: `${BASE}/`, json: "true", redirect: "false",
  })
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader(jar) },
    body,
    redirect: "manual",
  })
  applyCookies(loginRes, jar)

  const sessionRes = await fetch(`${BASE}/api/assessments/${TEST_ID}/session`, {
    method: "POST",
    headers: { cookie: cookieHeader(jar) },
  })
  const data = await sessionRes.json().catch(() => ({}))
  createdSessionId = data.session?._id ?? null
  const questions = data.assessment?.questions ?? []
  say(`session POST: ${sessionRes.status} ${data.error ?? "ok"}`)
  say(`questions served: ${questions.length}`)
  say(`question types: ${[...new Set(questions.map((q) => q.type))].join(", ") || "-"}`)
  say(`answer fields leaked: ${questions.some((q) => "correctAnswer" in q)}`)
  say(`sample: ${questions[0]?.text?.slice(0, 90) ?? "-"}`)
} catch (e) {
  say(`ERROR ${e.message}`)
  process.exitCode = 1
} finally {
  if (restore) {
    await mongoose.connection.db.collection("studentprogresses").updateOne(
      { student: restore.studentId, course: restore.courseId },
      { $set: { viewedLessons: restore.viewedLessons, completedLessons: restore.completedLessons } }
    )
    say("restored bot student progress")
  }
  if (createdSessionId) {
    await mongoose.connection.db.collection("proctoringsessions").deleteOne({ _id: new mongoose.Types.ObjectId(createdSessionId) })
    say("removed temporary assessment session")
  }
  await mongoose.disconnect()
}
fs.writeFileSync(path.join(process.cwd(), "scripts", "verify-fill-blank-session.log"), lines.join("\n") + "\n")
