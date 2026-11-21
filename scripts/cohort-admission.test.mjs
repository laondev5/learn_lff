import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import { createRequire } from "node:module"
import ts from "typescript"
const realRequire = createRequire(import.meta.url)
const query = value => ({ lean: async () => value, select() { return this }, sort() { return this }, session: async () => value })
function load(file, dependencies) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8")
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const exports = {}
  const require = name => {
    if (name in dependencies) return dependencies[name]
    if (name === "server-only") return {}
    if (name === "node:crypto" || name === "zod") return realRequire(name)
    if (name.includes("/models/")) return { default: {} }
    throw new Error(`Unmocked dependency: ${name}`)
  }
  runInNewContext(js, { exports, require, Date, console })
  return exports
}
for (const status of ["pending", "rejected"]) {
  test(`${status} admission cannot grant course or module access despite legacy cohort`, async () => {
    const admission = load("src/lib/cohort-application.ts", {
      "@/models/CohortApplication.model": { default: { find: filter => query(filter.status === status ? [{ schedule: "s" }] : []) } },
      "@/models/CohortSchedule.model": { default: { find: filter => { assert.equal(filter._id.$in.length, 0); return query([]) } } },
    })
    const access = load("src/lib/cohort-access.ts", {
      mongoose: { Types: { ObjectId: { isValid: () => true } } },
      "@/lib/mongoose": { connectDB: async () => {} },
      "@/lib/cohort-application": admission,
      "@/models/User.model": { default: { findById: () => query({ role: "student", isActive: true, cohort: "legacy" }) } },
      "@/models/Course.model": { default: { findById: () => query({ isPublished: true }) } },
      "./cohort-time": {},
    })
    for (const result of [await access.getStudentCourseAccess("student", "course"), await access.getStudentModuleAccess("student", "course", "module")]) {
      assert.equal(result.allowed, false)
      assert.equal(result.reason, "pastor_acceptance_required")
    }
  })
}
function invitationHarness(isPaid = false) {
  const token = "a".repeat(64)
  const digest = realRequire("node:crypto").createHash("sha256").update(token).digest("hex")
  const state = { writes: 0, emails: 0, admissions: 0 }
  const application = { _id: "application", student: "student", schedule: "schedule", course: "course", cohort: "cohort", partnerName: "Pastor", partnerEmail: "pastor@test.com", status: "pending", tokenHash: digest, tokenExpiresAt: new Date(Date.now() + 60_000), save: async () => { state.writes++ } }
  const api = load("src/actions/cohort-application.actions.ts", {
    "@/auth": { auth: async () => null },
    "@/lib/mongoose": { connectDB: async () => {} },
    mongoose: { default: { startSession: async () => ({ withTransaction: async callback => callback(), endSession: async () => {} }) }, Types: { ObjectId: { isValid: () => true } } },
    bcryptjs: { hash: async () => { throw new Error("Unexpected password mutation") } },
    "next/headers": { headers: async () => new Map() },
    "next/cache": { revalidatePath: () => {} },
    "@/lib/email": { sendEmail: async () => { state.emails++; throw new Error("Email forbidden") } },
    "@/lib/app-url": { getAppUrl: () => "https://example.test" },
    "@/lib/rate-limit": { checkRateLimit: async () => ({ allowed: true }) },
    "@/lib/password-reset": { createResetToken: () => ({ token: "set-password-token", tokenHash: "set-password-hash", expiresAt: new Date(Date.now() + 60_000) }), SET_PASSWORD_TTL_MS: 60_000 },
    "@/lib/paystack": { initializePaystackPayment: async () => ({ authorizationUrl: "https://pay.example/checkout", reference: "test-reference" }) },
    "@/lib/cohort-time": { applicationClosesAt: () => new Date(Date.now() + 60_000), isApplicationOpen: () => true, REGISTRATION_GRACE_DAYS: 7 },
    "@/models/CohortApplication.model": { default: {
      findOne: filter => query(filter.tokenHash === application.tokenHash && filter.status === application.status && application.tokenExpiresAt > filter.tokenExpiresAt.$gt ? application : null),
      updateOne: async (filter, update) => {
        if (filter._id !== application._id || filter.status !== application.status) return { modifiedCount: 0 }
        application.status = update.$set.status
        application.respondedAt = update.$set.respondedAt
        return { modifiedCount: 1 }
      },
    } },
    "@/models/CohortSchedule.model": { default: { findOne: () => query({ _id: "schedule" }) } },
    "@/models/User.model": { default: { findById: () => query({ name: "Student" }), findOne: () => query({ _id: "student" }), updateOne: async () => { state.writes++ } } },
    "@/models/Course.model": { default: { findById: () => query({ isPublished: true, isPaid }) } },
    "@/models/StudentProgress.model": { default: { updateOne: async () => { state.writes++; state.admissions++ } } },
  })
  return { api, token, state, application }
}
test("GET invitation read is read-only and does not admit or email", async () => {
  const { api, token, state, application } = invitationHarness()
  assert.equal((await api.getPartnerInvitation(token)).studentName, "Student")
  assert.equal(application.status, "pending")
  assert.deepEqual(state, { writes: 0, emails: 0, admissions: 0 })
})
for (const decision of ["accepted", "rejected"]) {
  test(`${decision} decision consumes token and replay cannot admit or reverse decision`, async () => {
    const { api, token, state, application } = invitationHarness()
    assert.equal((await api.respondToPartnerInvitation(token, decision)).success, true)
    const writes = state.writes
    assert.equal(application.status, decision)
    assert.ok((await api.respondToPartnerInvitation(token, decision === "accepted" ? "rejected" : "accepted")).error)
    assert.equal(state.writes, writes)
    assert.equal(state.admissions, decision === "accepted" ? 1 : 0)
    assert.equal(state.emails, 0)
    assert.equal(await api.getPartnerInvitation(token), null)
  })
}
test("expired or malformed invitation cannot mutate admission", async () => {
  const { api, token, state, application } = invitationHarness()
  application.tokenExpiresAt = new Date(0)
  assert.equal(await api.getPartnerInvitation(token), null)
  assert.ok((await api.respondToPartnerInvitation(token, "accepted")).error)
  assert.ok((await api.respondToPartnerInvitation("invalid", "accepted")).error)
  assert.deepEqual(state, { writes: 0, emails: 0, admissions: 0 })
})

test("invitation GET page renders through lookup only; no response mutation", async () => {
  const { api, token, state } = invitationHarness()
  const page = load("src/app/accountability/respond/page.tsx", {
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    "next/link": { default: "link" },
    "./PartnerResponseForm": { PartnerResponseForm: "response-form" },
    "@/actions/cohort-application.actions": {
      getPartnerInvitation: api.getPartnerInvitation,
      respondToPartnerInvitation: async () => { throw new Error("GET must not mutate") },
    },
  })
  assert.ok(await page.default({ searchParams: Promise.resolve({ token }) }))
  assert.deepEqual(state, { writes: 0, emails: 0, admissions: 0 })
})

test("pastor acceptance for paid course does not create enrollment", async () => {
  const { api, token, state, application } = invitationHarness(true)
  assert.equal((await api.respondToPartnerInvitation(token, "accepted")).success, true)
  assert.equal(application.status, "accepted")
  assert.equal(state.admissions, 0)
  assert.equal(state.emails, 0)
})
