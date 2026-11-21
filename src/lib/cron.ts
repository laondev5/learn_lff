import { randomUUID } from "node:crypto"
import { connectDB } from "./mongoose"
import User from "@/models/User.model"
import StudentProgress from "@/models/StudentProgress.model"
import PaymentTransaction from "@/models/PaymentTransaction.model"
import Course from "@/models/Course.model"
import Module from "@/models/Module.model"
import CohortApplication from "@/models/CohortApplication.model"
import CohortSchedule from "@/models/CohortSchedule.model"
import ModuleAttendance from "@/models/ModuleAttendance.model"
import { getModuleCompletionAtDeadline, getStudentModuleAccess } from "./cohort-access"
import { sendEmail } from "./email"
import { getAppUrl } from "./app-url"
import { runProgressJob, escapeNotificationHtml as escape, type AbsenceRecord, type Notice } from "./cron-job"

/** Legacy enrollment alone does not establish paid access before a deadline. */
async function hadPaymentAccess(student: string, courseId: string, deadline: Date) {
  const course = await Course.findById(courseId).select("isPaid price").lean()
  if (!course) return false
  if (!course.isPaid) return true
  return !!await PaymentTransaction.exists({
    student, course: courseId, status: "success", amount: { $gte: course.price ?? 0 },
    $or: [
      { paidAt: { $lt: deadline } },
      // Older verified transactions may lack paidAt; use their last persisted update.
      { paidAt: { $exists: false }, updatedAt: { $lt: deadline } },
    ],
  })
}

/** Explicitly invoked scheduled job; never run on import. Attendance is the durable outbox. */
export async function checkStudentProgress(now = new Date()) {
  await connectDB()
  return runProgressJob({
    async snapshot() {
      // Include students who never opened a lesson; activity alone cannot create absences.
      const schedules = await CohortSchedule.find({ startsAt: { $lte: now } }).lean()
      for (const schedule of schedules) {
        if (!await Course.exists({ _id: schedule.course, isPublished: true })) continue
        const modules = await Module.find({ course: schedule.course }).sort({ order: 1, _id: 1 }).lean()
        const applications = await CohortApplication.find({ schedule: schedule._id, course: schedule.course, status: "accepted" }).lean()
        for (const application of applications) {
          if (!await User.exists({ _id: application.student, role: "student", isActive: true })) continue
          const progress = await StudentProgress.findOne({ student: application.student, course: schedule.course }).select("enrolledAt").lean()
          if (!progress) continue
          for (const mod of modules) {
            if (!mod.isPublished) continue
            // Fixed daily windows: one module opens every 24 hours.
            const access = await getStudentModuleAccess(String(application.student), String(schedule.course), String(mod._id), now)
            if (!access.opensAt || !access.closesAt) continue
            const close = access.closesAt
            // No attendance obligation for a slot that ended before enrollment.
            if (close <= access.opensAt || new Date(Math.max(progress.enrolledAt.getTime(), application.respondedAt?.getTime() ?? 0)) >= close || access.opensAt > now) continue
            if (!await hadPaymentAccess(String(application.student), String(schedule.course), close)) continue
            const key = { student: application.student, schedule: schedule._id, module: mod._id }
            try {
              await ModuleAttendance.updateOne(key, { $setOnInsert: { ...key, course: schedule.course, cohort: schedule.cohort, opensAt: access.opensAt, closesAt: close } }, { upsert: true })
            } catch (error) {
              // Another worker may have inserted the same unique attendance key.
              if ((error as { code?: number }).code !== 11000) throw error
            }
          }
        }
      }
    },
    async due() {
      const rows = await ModuleAttendance.find({ closesAt: { $lte: now }, evaluatedAt: { $exists: false } }).lean()
      const accepted = await Promise.all(rows.map(row => CohortApplication.exists({ student: row.student, course: row.course, schedule: row.schedule, status: "accepted", $or: [{ respondedAt: { $lt: row.closesAt } }, { respondedAt: { $exists: false } }] })))
      const paid = await Promise.all(rows.map(row => hadPaymentAccess(String(row.student), String(row.course), row.closesAt)))
      return rows.filter((_, index) => accepted[index] && paid[index]).map(row => ({ id: String(row._id), studentId: String(row.student), courseId: String(row.course), moduleId: String(row.module), scheduleId: String(row.schedule), closesAt: row.closesAt, completedAt: row.completedAt, missingLessons: row.missingLessons ?? [], missingTests: row.missingTests ?? [] }))
    },
    async completion(record: AbsenceRecord) {
      return getModuleCompletionAtDeadline(record.studentId, record.courseId, record.moduleId, record.closesAt, record.scheduleId)
    },
    async evaluate(record, result) {
      // One conditional update freezes original absence and enqueues exactly once.
      await ModuleAttendance.updateOne({ _id: record.id, evaluatedAt: { $exists: false } }, { $set: {
        evaluatedAt: now, absent: !result.complete,
        missingLessons: result.missingLessons, missingTests: result.missingTests,
        notificationStatus: result.complete ? "none" : "pending", notificationNextAttemptAt: now,
      } })
    },
    async claim() {
      const lease = randomUUID()
      const row = await ModuleAttendance.findOneAndUpdate({ absent: true, $or: [
        { notificationStatus: "pending", notificationNextAttemptAt: { $lte: now } },
        { notificationStatus: "leased", notificationLeaseUntil: { $lte: now } },
      ] }, { $set: { notificationStatus: "leased", notificationLease: lease, notificationLeaseUntil: new Date(Date.now() + 10 * 60_000) }, $inc: { notificationAttempts: 1 } }, { new: true, sort: { closesAt: 1 } }).lean()
      return row ? { id: String(row._id), studentId: String(row.student), courseId: String(row.course), moduleId: String(row.module), scheduleId: String(row.schedule), closesAt: row.closesAt, missingLessons: row.missingLessons ?? [], missingTests: row.missingTests ?? [], attempts: row.notificationAttempts, lease } : null
    },
    async deliver(notice: Notice) {
      const [student, course, mod, application, admins] = await Promise.all([
        User.findById(notice.studentId).select("name email isActive").lean(),
        Course.findById(notice.courseId).select("title").lean(),
        Module.findById(notice.moduleId).select("title").lean(),
        CohortApplication.findOne({ student: notice.studentId, course: notice.courseId, schedule: notice.scheduleId, status: "accepted" }).select("partnerName partnerEmail").lean(),
        User.find({ role: "admin", isActive: true }).select("name email").lean(),
      ])
      if (!student?.isActive || !course || !mod) return false
      if (!await hadPaymentAccess(notice.studentId, notice.courseId, notice.closesAt)) return false
      const deadline = notice.closesAt.toLocaleString("en-GB", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" })
      const missedTest = (notice.missingTests?.length ?? 0) > 0
      const missedLessonCount = notice.missingLessons?.length ?? 0
      const safeName = escape(student.name.replace(/[\r\n]/g, " "))
      const safeCourse = escape(course.title.replace(/[\r\n]/g, " "))
      const detail = missedTest
        ? `${safeName} did not take and pass the module test for ${escape(mod.title)} in ${safeCourse} within the 24-hour window that ended ${escape(deadline)} (Lagos).`
        : `${safeName} did not complete the required lessons for ${escape(mod.title)} in ${safeCourse} by ${escape(deadline)} (Lagos).`
      const lessonsNote = missedLessonCount > 0
        ? ` They also left ${missedLessonCount} lesson${missedLessonCount !== 1 ? "s" : ""} unfinished.`
        : ""
      const partnerName = escape(application?.partnerName || "accountability partner")
      const partnerEmail = application?.partnerEmail ?? null
      const appUrl = escape(getAppUrl())

      let partnerSent = false
      if (partnerEmail) {
        await sendEmail({
          to: partnerEmail,
          subject: `${missedTest ? "Module test missed" : "Module deadline missed"}: ${safeName} — ${safeCourse}`,
          html: `<p>Hello ${partnerName},</p>` +
            `<p>${detail}${lessonsNote}</p>` +
            `<p>The module is now locked. Please check in with ${safeName}. To continue, they must submit an appeal in their learning portal for this module to be reopened for another 24 hours.</p>` +
            `<p>They can sign in at <a href="${appUrl}">${appUrl}</a> and open Student appeals. A later extension does not change the original attendance record.</p>`,
        })
        partnerSent = true
      }

      const adminEmails = admins.map((admin) => admin.email).filter((email): email is string => !!email)
      let adminSent = false
      if (adminEmails.length > 0) {
        await sendEmail({
          to: adminEmails.join(", "),
          subject: `Follow-up needed: ${safeName} missed ${mod.title.replace(/[\r\n]/g, " ")}`,
          html: `<p>Hello administrator,</p>` +
            `<p>${detail}${lessonsNote}</p>` +
            `<p><strong>Student:</strong> ${safeName}${student.email ? ` (${escape(student.email)})` : ""}<br />` +
            `<strong>Course:</strong> ${safeCourse}<br />` +
            `<strong>Module:</strong> ${escape(mod.title)}<br />` +
            `<strong>Accountability partner:</strong> ${partnerName}${partnerEmail ? ` (${escape(partnerEmail)})` : " — no partner email on file"}<br />` +
            `<strong>Window closed:</strong> ${escape(deadline)} (Lagos)</p>` +
            `<p>${partnerEmail ? "The accountability partner has been emailed." : "The accountability partner could not be emailed because no address is on file."} Please follow up with both the student and their accountability partner.</p>` +
            `<p>The student must submit an access appeal in <strong>Student appeals</strong> at <a href="${appUrl}/student/appeals">${appUrl}/student/appeals</a> before the module can reopen for another 24 hours.</p>`,
        })
        adminSent = true
      }

      return partnerSent || adminSent
    },
    async acknowledge(notice, sent) {
      await ModuleAttendance.updateOne({ _id: notice.id, notificationStatus: "leased", notificationLease: notice.lease }, {
        $set: { notificationStatus: sent ? "sent" : "none", ...(sent ? { notificationSentAt: new Date() } : {}) },
        $unset: { notificationLease: 1, notificationLeaseUntil: 1 },
      })
    },
    async retry(notice, next) {
      await ModuleAttendance.updateOne({ _id: notice.id, notificationStatus: "leased", notificationLease: notice.lease }, {
        $set: { notificationStatus: "pending", notificationNextAttemptAt: next },
        $unset: { notificationLease: 1, notificationLeaseUntil: 1 },
      })
    },
  }, now)
}
