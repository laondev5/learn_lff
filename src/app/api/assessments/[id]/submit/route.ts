import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { connectDB } from "@/lib/mongoose"
import Assessment from "@/models/Assessment.model"
import ProctoringSession from "@/models/ProctoringSession.model"
import StudentProgress from "@/models/StudentProgress.model"
import Submission from "@/models/Submission.model"
import { submissionSchema } from "@/lib/validations/assessment"
import { processAssessmentSubmission } from "@/lib/assessment.service"
import { isPastExamDeadline } from "@/lib/exam-window"
import { Types } from "mongoose"

/**
 * POST /api/assessments/[id]/submit
 * Handles final submission of an assessment (manual or triggered auto-submit).
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const session = await auth()
    if (!session?.user || session.user.role !== "student") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const studentId = session.user.id
    const assessmentId = id
    
    // Check if it's an auto-submit request or manual submit
    let body;
    try {
      body = await req.json()
    } catch (e) {
      body = {}
    }

    const isAutoSubmit = body.isAutoSubmit === true
    const autoSubmittedReason = body.reason || "Automatic submission"

    await connectDB()

    // 1. Fetch Assessment & Active Session
    const [assessment, proctoringSession] = await Promise.all([
      Assessment.findById(assessmentId),
      ProctoringSession.findOne({
        assessment: assessmentId,
        student: studentId,
        status: { $in: ["active", "terminated"] }
      })
    ])

    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 })
    }

    if (!assessment.isPublished) {
      return NextResponse.json({ error: "Assessment is not available" }, { status: 403 })
    }

    // Only a student enrolled in the course may submit, and only from a session
    // they actually started.
    const enrolled = await StudentProgress.exists({ student: studentId, course: assessment.course })
    if (!enrolled) {
      return NextResponse.json({ error: "You are not enrolled in this course" }, { status: 403 })
    }

    if (!proctoringSession) {
      return NextResponse.json({ error: "No active session to submit" }, { status: 400 })
    }

    if (isPastExamDeadline(assessment, proctoringSession)) {
      proctoringSession.status = "expired"
      proctoringSession.endTime = new Date()
      await proctoringSession.save()
      return NextResponse.json({ error: "Time limit exceeded for this attempt" }, { status: 403 })
    }

    const attemptsUsed = await Submission.countDocuments({
      student: studentId,
      assessment: assessmentId,
    })
    if (attemptsUsed >= assessment.maxAttempts) {
      return NextResponse.json({
        error: `You have reached the maximum number of attempts (${assessment.maxAttempts}) for this assessment.`,
      }, { status: 403 })
    }

    // 2. Prepare Answers for Grading
    let answers: { questionId: string; answer: string }[] = []
    
    if (isAutoSubmit) {
      const snapshot = proctoringSession.answersSnapshot || {}
      answers = Object.entries(snapshot).map(([qId, ans]) => ({
        questionId: qId,
        answer: String(ans)
      }))
    } else {
      const parsed = submissionSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
      }
      answers = parsed.data.answers
    }

    // 3. Process Submission via Service
    const result = await processAssessmentSubmission({
      assessmentId,
      studentId,
      answers,
      isAutoSubmit,
      autoSubmittedReason,
      proctoringSessionId: (proctoringSession._id as Types.ObjectId).toString()
    })

    return NextResponse.json({
      success: true,
      submission: {
        _id: result.submission._id,
        score: result.score,
        totalMarks: result.totalMarks,
        percentageScore: result.percentageScore,
        passed: result.passed,
        autoSubmitted: isAutoSubmit
      }
    })

  } catch (error: unknown) {
    console.error("[SUBMISSION_POST]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
