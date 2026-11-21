/** Temporary, self-cleaning check for course-specific cohorts and the 7-day registration cutoff. */
import fs from "node:fs"
import path from "node:path"
import mongoose from "mongoose"

const BASE = process.env.LMS_BASE_URL ?? "http://localhost:26814"
const PREFIX = "Cohort Rule Test "
const DAY = 24 * 60 * 60 * 1000
const creds = JSON.parse(fs.readFileSync(path.join(process.cwd(), ".bot-test-accounts.json"), "utf8"))
for (const line of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const lines = []
const say = (s) => { lines.push(s); console.log(s) }
const lagosDate = (date) => new Date(date.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10)
const has = (text, needle) => text.toLowerCase().includes(needle.toLowerCase())

let courseIds = []
try {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  const db = mongoose.connection.db
  const adminId = new mongoose.Types.ObjectId(creds.accounts.admin.id)
  const teacherId = new mongoose.Types.ObjectId(creds.accounts.teacher.id)
  const now = new Date()

  const cases = [
    { label: "A", daysAgo: 2 },
    { label: "B", daysAgo: 10 },
  ]
  for (const item of cases) {
    const course = await db.collection("courses").insertOne({
      title: `${PREFIX}${item.label}`,
      description: "Temporary verification course.",
      teacher: teacherId,
      isPublished: true,
      isPaid: false,
      price: 0,
      createdAt: now,
      updatedAt: now,
    })
    courseIds.push(course.insertedId)
    const startsAt = new Date(now.getTime() - item.daysAgo * DAY)
    const endsAt = new Date(startsAt.getTime() + 20 * DAY)
    await db.collection("cohortschedules").insertOne({
      course: course.insertedId,
      cohort: "TestCohort",
      startDate: lagosDate(startsAt),
      endDate: lagosDate(endsAt),
      startsAt,
      endsAt,
      registrationClosesAt: new Date(startsAt.getTime() + 7 * DAY),
      updatedBy: adminId,
      createdAt: now,
      updatedAt: now,
    })
    say(`created ${PREFIX}${item.label}: started ${item.daysAgo} days ago`)
  }

  const fetchText = async (url) => (await fetch(`${BASE}${url}`)).text()
  const catalogue = await fetchText("/courses")
  say(`catalogue shows A as open: ${has(catalogue, `${PREFIX}A`) && has(catalogue, "Applications open")}`)
  say(`catalogue shows B as closed: ${has(catalogue, `${PREFIX}B`) && has(catalogue, "Registration closed")}`)

  const detailA = await fetchText(`/courses/${courseIds[0]}`)
  const detailB = await fetchText(`/courses/${courseIds[1]}`)
  say(`detail A says applications open: ${has(detailA, "Applications are open")}`)
  say(`detail A shows apply-by date: ${has(detailA, "Applications stay open until")}`)
  say(`detail B says registration closed: ${has(detailB, "Registration for this cohort is closed")}`)
  say(`detail B tells student to wait: ${has(detailB, "wait for the next cohort")}`)

  const apply = await fetchText("/apply")
  say(`apply page includes A option: ${has(apply, `${PREFIX}A`)}`)
  say(`apply page excludes B option: ${!has(apply, `${PREFIX}B`)}`)
} catch (e) {
  say(`ERROR ${e.message}`)
  process.exitCode = 1
} finally {
  if (courseIds.length) {
    await mongoose.connection.db.collection("cohortschedules").deleteMany({ course: { $in: courseIds } })
    await mongoose.connection.db.collection("courses").deleteMany({ _id: { $in: courseIds } })
    say(`removed ${courseIds.length} temporary courses and their schedules`)
  }
  await mongoose.disconnect()
}
fs.writeFileSync(path.join(process.cwd(), "scripts", "verify-cohort-registration.log"), lines.join("\n") + "\n")
