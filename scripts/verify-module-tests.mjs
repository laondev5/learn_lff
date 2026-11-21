import fs from "node:fs"
import path from "node:path"
import mongoose from "mongoose"

const envPath = path.join(process.cwd(), ".env.local")
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const COURSE_ID = "6ae7aefcb85ea3c5d860b351"
const out = []
const say = (s) => { out.push(s); console.log(s) }

try {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  const db = mongoose.connection.db
  const courseId = new mongoose.Types.ObjectId(COURSE_ID)

  const [modules, assessments, lessonTests, submissions, assessmentsAll] = await Promise.all([
    db.collection("modules").find({ course: courseId }).project({ title: 1, order: 1 }).toArray(),
    db.collection("assessments").find({ course: courseId, type: "test", isPublished: true }).toArray(),
    db.collection("tests").countDocuments({ course: courseId }),
    db.collection("submissions").countDocuments({}),
    db.collection("assessments").countDocuments({ course: courseId }),
  ])
  const moduleById = new Map(modules.map((m) => [m._id.toString(), m]))

  say(`course modules: ${modules.length}`)
  say(`published module tests: ${assessments.length}`)
  say(`all assessments in course: ${assessmentsAll}`)
  say(`lesson-level tests in course: ${lessonTests}`)
  say(`assessment submissions: ${submissions}`)

  let totalQuestions = 0
  let fillBlank = 0
  let badModule = 0
  let answered = 0
  for (const a of assessments.sort((x, y) => (moduleById.get(String(x.module))?.order ?? 0) - (moduleById.get(String(y.module))?.order ?? 0))) {
    const mod = moduleById.get(String(a.module))
    if (!mod) badModule++
    const qs = Array.isArray(a.questions) ? a.questions : []
    totalQuestions += qs.length
    fillBlank += qs.filter((q) => q.type === "fill_blank").length
    answered += qs.filter((q) => String(q.correctAnswer ?? "").trim() && String(q.correctAnswer).trim() !== "<none>").length
    say(`MOD ${String(mod?.order ?? "-").padStart(2)} | ${mod?.title ?? "UNKNOWN"} | ${a._id} | q=${qs.length} | fill_blank=${qs.filter((q) => q.type === "fill_blank").length} | pass=${a.passingMarks} | attempts=${a.maxAttempts} | ${a.title}`)
  }
  say(`totals: questions=${totalQuestions} fill_blank=${fillBlank} answered=${answered} orphanedModules=${badModule}`)

  const students = await db.collection("users").find({ role: "student" }).project({ email: 1, isActive: 1 }).toArray()
  const teacher = await db.collection("users").find({ role: "teacher" }).project({ email: 1, isActive: 1 }).toArray()
  const admin = await db.collection("users").find({ role: "admin" }).project({ email: 1, isActive: 1, hashedPassword: 1 }).toArray()
  say(`users: admin=${admin.length} teacher=${teacher.length} student=${students.length}`)
  for (const a of admin) say(`ADMIN ${a.email} | active=${a.isActive} | hasHash=${!!a.hashedPassword}`)
  for (const t of teacher) say(`TEACHER ${t.email} | active=${t.isActive}`)
  for (const s of students) say(`STUDENT ${s.email} | active=${s.isActive}`)
} catch (e) {
  say("ERROR " + e.message)
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}

fs.writeFileSync(path.join(process.cwd(), "scripts", "verify-module-tests.log"), out.join("\n") + "\n")
