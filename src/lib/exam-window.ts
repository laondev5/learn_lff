import type { IAssessment } from "@/models/Assessment.model"
import type { IProctoringSession } from "@/models/ProctoringSession.model"

/** Clock drift tolerance between the student's browser and the server. */
const GRACE_MS = 60_000

/** Server-side deadline for a timed assessment attempt, or null when untimed. */
function examDeadline(
  assessment: Pick<IAssessment, "durationMinutes">,
  session: Pick<IProctoringSession, "startTime">
): Date | null {
  const minutes = assessment.durationMinutes
  if (!minutes || minutes <= 0) return null
  return new Date(session.startTime.getTime() + minutes * 60_000 + GRACE_MS)
}

export function isPastExamDeadline(
  assessment: Pick<IAssessment, "durationMinutes">,
  session: Pick<IProctoringSession, "startTime">,
  now = new Date()
): boolean {
  const deadline = examDeadline(assessment, session)
  return !!deadline && now.getTime() > deadline.getTime()
}
