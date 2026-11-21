import "server-only"
import CohortApplication from "@/models/CohortApplication.model"
import CohortSchedule from "@/models/CohortSchedule.model"

/** Admission is derived from the pastor's recorded acceptance, never a profile field. */
export async function getAcceptedCohortApplication(student: string, course: string, now = new Date()) {
  const applications = await CohortApplication.find({ student, course, status: "accepted" }).lean()
  const schedules = await CohortSchedule.find({ _id: { $in: applications.map(a => a.schedule) }, course }).sort({ startsAt: -1 }).lean()
  const schedule = schedules.find(s => s.startsAt <= now && s.endsAt > now)
    ?? schedules.find(s => s.startsAt <= now)
    ?? schedules.at(-1)
  if (!schedule) return null
  const application = applications.find(a => a.schedule.equals(schedule._id))!
  return { application, schedule }
}
