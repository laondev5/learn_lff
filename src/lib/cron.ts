import { connectDB } from "./mongoose"
import User, { IUser } from "@/models/User.model"
import StudentProgress from "@/models/StudentProgress.model"
import SystemConfig from "@/models/SystemConfig.model"
import Course, { ICourse } from "@/models/Course.model"
import { sendEmail, studentStuckEmailHtml } from "./email"

export async function checkStudentProgress() {
  console.log("Running student progress check...")
  await connectDB()

  const config = await SystemConfig.findOne().lean()
  const stuckHours = config?.stuckDurationHours || 72
  const stuckThreshold = new Date(Date.now() - stuckHours * 60 * 60 * 1000)

  // Find students who haven't updated their progress in X hours
  const inactiveProgress = await StudentProgress.find({
    updatedAt: { $lt: stuckThreshold },
    examPassed: false, // Only check if they haven't finished the course
  })
    .populate<{ student: IUser }>("student")
    .populate<{ course: ICourse }>("course")
    .lean()

  console.log(`Found ${inactiveProgress.length} inactive students.`)

  for (const progress of inactiveProgress) {
    const student = progress.student
    const course = progress.course

    if (student && student.accountabilityPartner?.email) {
      const partner = student.accountabilityPartner
      console.log(`Sending alert to partner ${partner.email} for student ${student.name}`)

      try {
        await sendEmail({
          to: partner.email,
          subject: `Support Needed: ${student.name}'s Progress`,
          html: studentStuckEmailHtml(
            partner.name,
            student.name,
            course.title || "their course",
            stuckHours
          ),
        })
        
        // Update progress timestamp so we don't spam the partner every check
        // We'll "bump" it to now so they won't get another alert for another X hours
        await StudentProgress.findByIdAndUpdate(progress._id, {
          updatedAt: new Date(),
        })
      } catch (error) {
        console.error(`Failed to send email to ${partner.email}:`, error)
      }
    }
  }
}
