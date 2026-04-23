import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { connectDB } from "@/lib/mongoose"
import Assessment from "@/models/Assessment.model"
import ProctoringSession from "@/models/ProctoringSession.model"
import { submissionSchema } from "@/lib/validations/assessment"
import { processAssessmentSubmission } from "@/lib/assessment.service"
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
    if (!session?.user) {
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

    // 2. Prepare Answers for Grading
    let answers: { questionId: string; answer: string }[] = []
    
    if (isAutoSubmit) {
      if (!proctoringSession) {
        return NextResponse.json({ error: "No active session to auto-submit" }, { status: 400 })
      }
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
      proctoringSessionId: proctoringSession?._id ? (proctoringSession._id as Types.ObjectId).toString() : undefined
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
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
