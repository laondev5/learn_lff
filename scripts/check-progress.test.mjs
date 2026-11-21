import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import ts from "typescript"

// Load only the dependency-free job engine: no database or mail modules are imported.
const source = readFileSync(new URL("../src/lib/cron-job.ts", import.meta.url), "utf8")
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { runProgressJob, retryAt, escapeNotificationHtml } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`)
const now = new Date("2026-11-19T23:00:00Z")
const record = { id: "attendance", studentId: "student", courseId: "course", moduleId: "module", scheduleId: "schedule", closesAt: now }
function fixture(overrides = {}) {
  const state = { evaluated: [], sent: [], retries: [], claimed: false, completionCalls: 0 }
  const deps = {
    snapshot: async () => {}, due: async () => [record],
    completion: async () => { state.completionCalls++; return { complete: false, missingLessons: ["lesson"], missingTests: ["test"] } },
    evaluate: async (...args) => state.evaluated.push(args),
    claim: async () => { if (state.claimed) return null; state.claimed = true; return { ...record, attempts: 1, lease: "unique" } },
    deliver: async () => true,
    acknowledge: async (...args) => state.sent.push(args), retry: async (...args) => state.retries.push(args),
    ...overrides,
  }
  return { state, deps }
}
test("exact Lagos midnight deadline evaluates missing lessons AND tests", async () => {
  const { state, deps } = fixture()
  assert.deepEqual(await runProgressJob(deps, now), { evaluated: 1, sent: 1, failed: 0 })
  assert.deepEqual(state.evaluated[0][1], { complete: false, missingLessons: ["lesson"], missingTests: ["test"] })
})
test("future modules are never evaluated", async () => {
  const { state, deps } = fixture({ due: async () => [{ ...record, closesAt: new Date(+now + 1) }], claim: async () => null })
  await runProgressJob(deps, now)
  assert.equal(state.evaluated.length, 0)
})
test("historical on-time completion survives delayed execution", async () => {
  const { state, deps } = fixture({ due: async () => [{ ...record, completedAt: new Date(+now - 1) }] })
  await runProgressJob(deps, now)
  assert.equal(state.completionCalls, 0)
  assert.equal(state.evaluated[0][1].complete, true)
})
test("completion at or after deadline must not erase absence", async () => {
  for (const offset of [0, 1, 86_400_000]) {
    const { state, deps } = fixture({ due: async () => [{ ...record, completedAt: new Date(+now + offset) }] })
    await runProgressJob(deps, now)
    assert.equal(state.completionCalls, 1)
    assert.equal(state.evaluated[0][1].complete, false)
  }
})
test("delivery failure queues backoff without marking sent", async () => {
  const { state, deps } = fixture({ deliver: async () => { throw new Error("mail unavailable") } })
  assert.equal((await runProgressJob(deps, now)).failed, 1)
  assert.equal(state.sent.length, 0)
  assert.equal(+state.retries[0][1], +now + 300_000)
})
test("acknowledgement failure remains recoverable", async () => {
  const { state, deps } = fixture({ acknowledge: async () => { throw new Error("database unavailable") } })
  await runProgressJob(deps, now)
  assert.equal(state.retries.length, 1)
})
test("missing partner is acknowledged without claiming delivery", async () => {
  const { state, deps } = fixture({ deliver: async () => false })
  assert.equal((await runProgressJob(deps, now)).sent, 0)
  assert.equal(state.sent[0][1], false)
})
test("outbox work is bounded", async () => {
  let deliveries = 0
  const { deps } = fixture({ claim: async () => ({ ...record, attempts: 1, lease: "unique" }), deliver: async () => { deliveries++; return true } })
  await runProgressJob(deps, now, 3)
  assert.equal(deliveries, 3)
})
test("retries cap at one day and notification content is escaped", () => {
  assert.equal(+retryAt(now, 50) - +now, 86_400_000)
  assert.equal(escapeNotificationHtml(`<script>"A&B"</script>`), "&lt;script&gt;&quot;A&amp;B&quot;&lt;/script&gt;")
})

// Exercise production adapters with strict in-memory model doubles.
async function adapters(models = {}) {
  const { runInNewContext } = await import("node:vm")
  const cronSource = readFileSync(new URL("../src/lib/cron.ts", import.meta.url), "utf8")
  const cronJs = ts.transpileModule(cronSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  let captured
  const exports = {}
  const require = name => {
    if (name === "node:crypto") return { randomUUID: () => "lease-token" }
    if (name === "./mongoose") return { connectDB: async () => {} }
    if (name === "./cron-job") return { escapeNotificationHtml, runProgressJob: async deps => { captured = deps } }
    if (name === "./cohort-access") return {
      getModuleCompletionAtDeadline: (...args) => models.completion?.(...args),
      getStudentModuleAccess: async () => ({ allowed: true, reason: "allowed", opensAt: new Date(+now - 86400000), closesAt: now }),
    }
    if (name === "./cohort-time") return { moduleWindow: (start, index) => ({ opensAt: new Date(+start + index * 86400000), closesAt: new Date(+start + (index + 1) * 86400000) }) }
    if (name === "./email") return { sendEmail: async args => models.send?.(args) }
    if (name === "./app-url") return { getAppUrl: () => "https://example.test" }
    const model = name.split("/").pop().replace(".model", "")
    if (!(model in models)) throw new Error(`Unexpected model import ${model}`)
    return { default: models[model] }
  }
  runInNewContext(cronJs, { exports, require, Date, console })
  await exports.checkStudentProgress(now)
  return captured
}
const query = value => ({ lean: async () => value, select() { return this }, sort() { return this } })
const emptyModels = () => Object.fromEntries(["User", "StudentProgress", "Course", "Module", "CohortSchedule", "CohortApplication", "ModuleAttendance", "PaymentTransaction"].map(name => [name, name === "User" ? { find: () => query([]) } : {}]))
test("snapshot queries accepted applications and creates schedule-specific attendance", async () => {
  const models = emptyModels(); const writes = []
  models.CohortSchedule.find = () => query([{ _id: "schedule", course: "course", cohort: "cohort", startsAt: new Date(+now - 86400000), endsAt: now }])
  models.Course.exists = async () => true
  models.Course.findById = () => query({ isPaid: false })
  models.Module.find = () => query([{ _id: "module", isPublished: true }])
  models.CohortApplication.find = filter => { assert.equal(filter.status, "accepted"); assert.equal(filter.schedule, "schedule"); return query([{ student: "student" }]) }
  models.User.exists = async () => true
  models.StudentProgress.findOne = () => query({ enrolledAt: new Date(+now - 86400000) })
  models.ModuleAttendance.updateOne = async (...args) => writes.push(args)
  await (await adapters(models)).snapshot(now)
  assert.equal(writes.length, 1)
  assert.equal(writes[0][0].schedule, "schedule")
  assert.equal(writes[0][1].$setOnInsert.closesAt.toISOString(), now.toISOString())
})
test("notification uses accepted application partner for exact schedule", async () => {
  const models = emptyModels(); const sent = []
  models.User.findById = () => query({ name: "Student", isActive: true, accountabilityPartner: { email: "wrong@test" } })
  models.Course.findById = () => query({ title: "Course" })
  models.Module.findById = () => query({ title: "Module" })
  models.CohortApplication.findOne = filter => { assert.equal(filter.schedule, "schedule"); assert.equal(filter.status, "accepted"); return query({ partnerName: "Pastor", partnerEmail: "accepted@test" }) }
  models.send = async email => sent.push(email)
  assert.equal(await (await adapters(models)).deliver({ ...record, attempts: 1, lease: "lease" }), true)
  assert.equal(sent[0].to, "accepted@test")
  models.CohortApplication.findOne = () => query(null)
  assert.equal(await (await adapters(models)).deliver({ ...record, attempts: 1, lease: "lease" }), false)
  assert.equal(sent.length, 1)
})
test("admin is notified to follow up with the student and accountability partner", async () => {
  const models = emptyModels(); const sent = []
  models.User.findById = () => query({ name: "Student", email: "student@test", isActive: true })
  models.User.find = filter => {
    assert.equal(filter.role, "admin")
    assert.equal(filter.isActive, true)
    return query([{ name: "Admin", email: "admin@test" }])
  }
  models.Course.findById = () => query({ title: "Course" })
  models.Module.findById = () => query({ title: "Module" })
  models.CohortApplication.findOne = () => query({ partnerName: "Pastor", partnerEmail: "partner@test" })
  models.send = async email => sent.push(email)
  const notice = { ...record, missingTests: ["test"], missingLessons: [], attempts: 1, lease: "lease" }
  assert.equal(await (await adapters(models)).deliver(notice), true)
  assert.equal(sent.length, 2)
  assert.equal(sent[0].to, "partner@test")
  assert.equal(sent[1].to, "admin@test")
  assert.match(sent[1].html, /partner@test/)
  assert.match(sent[1].html, /Student appeals/)
})
test("evaluation is conditional and acknowledgement requires lease ownership", async () => {
  const models = emptyModels(); const writes = []
  models.ModuleAttendance.updateOne = async (...args) => writes.push(args)
  const deps = await adapters(models)
  await deps.evaluate(record, { complete: false, missingLessons: ["l"], missingTests: ["t"] }, now)
  assert.equal(writes[0][0].evaluatedAt.$exists, false)
  assert.equal(writes[0][1].$set.notificationStatus, "pending")
  await deps.acknowledge({ ...record, lease: "owner" }, true, now)
  assert.equal(writes[1][0].notificationLease, "owner")
  assert.equal(writes[1][0].notificationStatus, "leased")
})
test("completion lookup carries schedule to common helper", async () => {
  const models = emptyModels(); let args
  models.completion = (...values) => { args = values; return { complete: false } }
  await (await adapters(models)).completion(record)
  assert.equal(args[4], "schedule")
})

for (const scenario of [
  { name: "unpaid", payment: null, eligible: false },
  { name: "pending", payment: { status: "pending", amount: 100, paidAt: new Date(+now - 1) }, eligible: false },
  { name: "underpaid", payment: { status: "success", amount: 99, paidAt: new Date(+now - 1) }, eligible: false },
  { name: "paid after deadline", payment: { status: "success", amount: 100, paidAt: new Date(+now + 1) }, eligible: false },
  { name: "paid before deadline", payment: { status: "success", amount: 100, paidAt: new Date(+now - 1) }, eligible: true },
  { name: "legacy verified payment", payment: { status: "success", amount: 100, updatedAt: new Date(+now - 1) }, eligible: true },
]) {
  test(`legacy enrollment ${scenario.name}: payment gates snapshot, evaluation and delivery`, async () => {
    const models = emptyModels(); const writes = []; const sent = []
    models.CohortSchedule.find = () => query([{ _id: "schedule", course: "course", cohort: "cohort", startsAt: new Date(+now - 86400000), endsAt: now }])
    models.Course.exists = async () => true
    models.Course.findById = () => query({ title: "Course", isPaid: true, price: 100 })
    models.Module.find = () => query([{ _id: "module", isPublished: true }])
    models.Module.findById = () => query({ title: "Module" })
    models.CohortApplication.find = () => query([{ student: "student" }])
    models.CohortApplication.exists = async () => true
    models.CohortApplication.findOne = () => query({ partnerName: "Pastor", partnerEmail: "partner@test" })
    models.User.exists = async () => true
    models.User.findById = () => query({ name: "Student", isActive: true })
    models.StudentProgress.findOne = () => query({ enrolledAt: new Date(+now - 86400000) })
    models.ModuleAttendance.updateOne = async (...args) => writes.push(args)
    models.ModuleAttendance.find = () => query([{ _id: "attendance", student: "student", course: "course", module: "module", schedule: "schedule", closesAt: now }])
    models.PaymentTransaction.exists = async filter => {
      assert.equal(filter.student, "student")
      assert.equal(filter.course, "course")
      assert.equal(filter.status, "success")
      assert.equal(filter.amount.$gte, 100)
      assert.equal(+filter.$or[0].paidAt.$lt, +now)
      assert.equal(filter.$or[1].paidAt.$exists, false)
      const payment = scenario.payment
      return payment && payment.status === filter.status && payment.amount >= filter.amount.$gte &&
        (payment.paidAt ? payment.paidAt < filter.$or[0].paidAt.$lt : payment.updatedAt < filter.$or[1].updatedAt.$lt)
    }
    models.send = async email => sent.push(email)
    const deps = await adapters(models)
    await deps.snapshot(now)
    assert.equal(writes.length, scenario.eligible ? 1 : 0)
    assert.equal((await deps.due(now)).length, scenario.eligible ? 1 : 0)
    assert.equal(await deps.deliver({ ...record, attempts: 1, lease: "lease" }), scenario.eligible)
    assert.equal(sent.length, scenario.eligible ? 1 : 0)
  })
}
