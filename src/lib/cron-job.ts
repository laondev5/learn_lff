/** Pure job orchestration. Adapters own persistence and delivery. */
export interface AbsenceRecord {
  id: string
  studentId: string
  courseId: string
  moduleId: string
  scheduleId: string
  closesAt: Date
  completedAt?: Date
  missingLessons?: string[]
  missingTests?: string[]
}
export interface Notice extends AbsenceRecord { attempts: number; lease: string }
export interface ProgressJobDependencies {
  snapshot(now: Date): Promise<void>
  due(now: Date): Promise<AbsenceRecord[]>
  completion(record: AbsenceRecord): Promise<{ complete: boolean; missingLessons: string[]; missingTests: string[] }>
  evaluate(record: AbsenceRecord, result: { complete: boolean; missingLessons: string[]; missingTests: string[] }, now: Date): Promise<void>
  claim(now: Date): Promise<Notice | null>
  deliver(notice: Notice): Promise<boolean>
  acknowledge(notice: Notice, sent: boolean, now: Date): Promise<void>
  retry(notice: Notice, next: Date): Promise<void>
}
export function retryAt(now: Date, attempts: number) {
  return new Date(now.getTime() + Math.min(24 * 60, 5 * 2 ** Math.min(Math.max(attempts - 1, 0), 9)) * 60_000)
}
export function escapeNotificationHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!)
}
export async function runProgressJob(deps: ProgressJobDependencies, now = new Date(), limit = 100) {
  await deps.snapshot(now)
  let evaluated = 0
  for (const record of await deps.due(now)) {
    if (record.closesAt > now) continue
    const result = record.completedAt && record.completedAt < record.closesAt
      ? { complete: true, missingLessons: [], missingTests: [] }
      : await deps.completion(record)
    await deps.evaluate(record, result, now)
    evaluated++
  }
  let sent = 0
  let failed = 0
  for (let i = 0; i < limit; i++) {
    const notice = await deps.claim(now)
    if (!notice) break
    try {
      const delivered = await deps.deliver(notice)
      await deps.acknowledge(notice, delivered, now)
      if (delivered) sent++
    } catch {
      await deps.retry(notice, retryAt(now, notice.attempts))
      failed++
    }
  }
  return { evaluated, sent, failed }
}
