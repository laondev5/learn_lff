import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const source = readFileSync(new URL('../src/lib/cohort-time.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { cohortWindow, moduleWindow, courseWindowAccess, moduleWindowAccess, lagosMidnight, DAY_MS, applicationClosesAt, isApplicationOpen } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
test('November 20 opens at midnight Lagos, not 11:59pm the day before', () => {
  const w = cohortWindow('2026-11-20', '2026-11-22')
  assert.equal(w.startsAt.toISOString(), '2026-11-19T23:00:00.000Z')
  assert.equal(courseWindowAccess(w.startsAt, w.endsAt, undefined, new Date(+w.startsAt - 1)).allowed, false)
  assert.equal(courseWindowAccess(w.startsAt, w.endsAt, undefined, w.startsAt).allowed, true)
  assert.equal(courseWindowAccess(w.startsAt, w.endsAt, undefined, new Date(+w.endsAt - 1)).allowed, true)
  assert.equal(courseWindowAccess(w.startsAt, w.endsAt, undefined, w.endsAt).allowed, false)
})
test('each module lasts 24 hours; next slot opens exactly as previous closes', () => {
  const w = cohortWindow('2026-11-20', '2026-11-22')
  const a = moduleWindow(w.startsAt, 0), b = moduleWindow(w.startsAt, 1)
  const access = courseWindowAccess(w.startsAt, w.endsAt, undefined, b.opensAt)
  assert.equal(+a.closesAt, +b.opensAt)
  assert.equal(+b.closesAt - +b.opensAt, DAY_MS)
  assert.equal(moduleWindowAccess(access, a.opensAt, a.closesAt, undefined, b.opensAt).allowed, false)
  assert.equal(moduleWindowAccess(access, b.opensAt, b.closesAt, undefined, b.opensAt).allowed, true)
})
test('approved grace reopens only its window and extends individual course end', () => {
  const w = cohortWindow('2026-11-20', '2026-11-20')
  const now = new Date(+w.endsAt + 1000), close = new Date(+now + DAY_MS)
  const access = courseWindowAccess(w.startsAt, w.endsAt, close, now)
  assert.equal(access.allowed, true)
  assert.equal(moduleWindowAccess(access, w.startsAt, w.endsAt, { opensAt: now, closesAt: close }, now).allowed, true)
  assert.equal(moduleWindowAccess(access, w.startsAt, w.endsAt, { opensAt: now, closesAt: close }, close).allowed, false)
  assert.equal(courseWindowAccess(w.startsAt, w.endsAt, close, new Date(+w.startsAt - 1)).allowed, false)
})
test('applications close exactly seven days after the cohort starts', () => {
  const w = cohortWindow('2026-11-20', '2026-12-05')
  const close = applicationClosesAt(w.startsAt)
  assert.equal(+close - +w.startsAt, 7 * DAY_MS)
  assert.equal(isApplicationOpen({ startsAt: w.startsAt }, new Date(+close - 1)), true)
  assert.equal(isApplicationOpen({ startsAt: w.startsAt }, close), false)
  assert.equal(isApplicationOpen({ startsAt: w.startsAt }, new Date(+w.startsAt + 8 * DAY_MS)), false)
})
test('invalid calendar dates and reversed windows are rejected', () => {
  assert.throws(() => lagosMidnight('2026-02-30'))
  assert.throws(() => cohortWindow('2026-11-22', '2026-11-20'))
  assert.throws(() => moduleWindow(new Date(), -1))
})
