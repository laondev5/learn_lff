import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { connectDB } from "@/lib/mongoose"
import ProctoringSession from "@/models/ProctoringSession.model"
import { violationReportSchema } from "@/lib/validations/assessment"
import { processAssessmentSubmission } from "@/lib/assessment.service"
import { Types } from "mongoose"

/**
 * POST /api/assessments/[id]/session/heartbeat
 * Receives periodic status updates (mic, fullscreen, tab) and violation reports.
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

    const body = await req.json()
    const parsed = violationReportSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    await connectDB()

    const proctoringSession = await ProctoringSession.findOne({
      assessment: id,
      student: session.user.id,
      status: "active",
    })

    if (!proctoringSession) {
      return NextResponse.json({ error: "No active session found" }, { status: 404 })
    }

    // 1. Update basic proctoring state
    proctoringSession.microphoneActive = parsed.data.microphoneActive
    proctoringSession.fullscreenActive = parsed.data.fullscreenActive
    proctoringSession.tabHidden = parsed.data.tabHidden
    proctoringSession.lastPolledAt = new Date()

    // 2. Save partial answer snapshot if provided
    if (parsed.data.answersSnapshot) {
      proctoringSession.answersSnapshot = {
        ...(proctoringSession.answersSnapshot || {}),
        ...parsed.data.answersSnapshot
      }
    }

    // 3. Handle specific violation if reported
    if (parsed.data.violation) {
      proctoringSession.violationLog.push({
        type: parsed.data.violation,
        timestamp: new Date(),
        details: parsed.data.details || `Automatic detection of ${parsed.data.violation}`
      })

      // Increment warnings count
      proctoringSession.warnings += 1

      // 4. Auto-submit trigger check
      if (proctoringSession.warnings >= proctoringSession.maxWarnings) {
        // Mark as terminated first to prevent race conditions
        proctoringSession.status = "terminated"
        await proctoringSession.save()

        // Auto-grade and close using the last snapshot
        const snapshot = proctoringSession.answersSnapshot || {}
        const answers = Object.entries(snapshot).map(([qId, ans]) => ({
          questionId: qId,
          answer: String(ans)
        }))

        const result = await processAssessmentSubmission({
          assessmentId: id,
          studentId: session.user.id,
          answers,
          isAutoSubmit: true,
          autoSubmittedReason: `Max warnings exceeded (${proctoringSession.warnings}/${proctoringSession.maxWarnings})`,
          proctoringSessionId: (proctoringSession._id as Types.ObjectId).toString()
        })

        return NextResponse.json({
          success: true,
          status: "terminated",
          autoSubmitted: true,
          message: "Max warnings exceeded. Session auto-submitted.",
          result: {
            score: result.score,
            percentageScore: result.percentageScore,
            passed: result.passed
          }
        })
      }
    }

    await proctoringSession.save()

    return NextResponse.json({
      success: true,
      status: proctoringSession.status,
      warnings: proctoringSession.warnings,
      maxWarnings: proctoringSession.maxWarnings,
    })

  } catch (error: unknown) {
    console.error("[HEARTBEAT_POST]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
