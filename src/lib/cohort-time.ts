/** Africa/Lagos is UTC+01:00 year-round. All windows are [open, close). */
export const DAY_MS = 24 * 60 * 60 * 1000
/** Applications stay open for one week after the cohort starts. */
export const REGISTRATION_GRACE_DAYS = 7
export type AccessResult = { allowed: boolean; reason: string; startsAt?: Date; endsAt?: Date }
export type ModuleAccessResult = AccessResult & { opensAt?: Date; closesAt?: Date }

export function lagosMidnight(date: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Use YYYY-MM-DD dates")
  const utc = new Date(`${date}T00:00:00.000Z`)
  if (!Number.isFinite(utc.getTime()) || utc.toISOString().slice(0, 10) !== date) throw new Error("Invalid calendar date")
  return new Date(utc.getTime() - 60 * 60 * 1000)
}

export function cohortWindow(startDate: string, endDate: string) {
  const startsAt = lagosMidnight(startDate)
  const endsAt = new Date(lagosMidnight(endDate).getTime() + DAY_MS)
  if (endsAt <= startsAt) throw new Error("End date must be on or after start date")
  return { startsAt, endsAt }
}

export function moduleWindow(startsAt: Date, index: number) {
  if (!Number.isInteger(index) || index < 0) throw new Error("Invalid module index")
  const opensAt = new Date(startsAt.getTime() + index * DAY_MS)
  return { opensAt, closesAt: new Date(opensAt.getTime() + DAY_MS) }
}

/** Registration closes seven Lagos days after the cohort starts. */
export function applicationClosesAt(startsAt: Date, registrationClosesAt?: Date | null): Date {
  return registrationClosesAt
    ? new Date(registrationClosesAt)
    : new Date(startsAt.getTime() + REGISTRATION_GRACE_DAYS * DAY_MS)
}

/** Applications are open from schedule creation until the registration cutoff. */
export function isApplicationOpen(schedule: { startsAt: Date; registrationClosesAt?: Date | null }, now = new Date()): boolean {
  return now < applicationClosesAt(new Date(schedule.startsAt), schedule.registrationClosesAt)
}

export function courseWindowAccess(startsAt: Date, scheduledEnd: Date, extension?: Date, now = new Date()): AccessResult {
  const endsAt = new Date(Math.max(scheduledEnd.getTime(), extension?.getTime() ?? 0))
  const reason = now < startsAt ? "course_not_started" : now >= endsAt ? "course_ended" : "allowed"
  return { allowed: reason === "allowed", reason, startsAt, endsAt }
}

export function moduleWindowAccess(course: AccessResult, opensAt: Date, scheduledClose: Date, grant?: { opensAt: Date; closesAt: Date }, now = new Date()): ModuleAccessResult {
  const activeGrant = grant && now >= grant.opensAt && now < grant.closesAt
  const effectiveOpen = activeGrant ? grant.opensAt : opensAt
  const closesAt = new Date(Math.min((activeGrant ? grant.closesAt : scheduledClose).getTime(), course.endsAt?.getTime() ?? Infinity))
  if (!course.allowed) return { ...course, opensAt: effectiveOpen, closesAt }
  const reason = now < effectiveOpen ? "module_not_started" : now >= closesAt ? "module_ended" : "allowed"
  return { ...course, allowed: reason === "allowed", reason, opensAt: effectiveOpen, closesAt }
}
