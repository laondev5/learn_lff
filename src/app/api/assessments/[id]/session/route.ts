import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { connectDB } from "@/lib/mongoose"
import Assessment from "@/models/Assessment.model"
import ProctoringSession, { IProctoringSession } from "@/models/ProctoringSession.model"
import Submission from "@/models/Submission.model"
import StudentProgress from "@/models/StudentProgress.model"
import { isPastExamDeadline } from "@/lib/exam-window"
import { Types } from "mongoose"

/**
 * POST /api/assessments/[id]/session
 * Starts or resumes an exam/assessment session for a student.
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

    await connectDB()

    // 1. Fetch assessment
    const assessment = await Assessment.findById(assessmentId)
    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 })
    }

    if (!assessment.isPublished) {
      return NextResponse.json({ error: "Assessment is not available yet" }, { status: 403 })
    }

    // 2. Verify student enrollment in the course
    const enrollment = await StudentProgress.findOne({
      student: studentId,
      course: assessment.course,
    })

    if (!enrollment) {
      return NextResponse.json({ error: "You are not enrolled in this course" }, { status: 403 })
    }

    // 3. Reuse an in-progress session, unless the server-side deadline passed
    const existingSession = await ProctoringSession.findOne({
      assessment: assessmentId,
      student: studentId,
    })

    if (existingSession?.status === "active") {
      if (!isPastExamDeadline(assessment, existingSession)) {
        const resumedQuestions = assessment.questions.map((q) => ({
          _id: q._id,
          text: q.text,
          type: q.type,
          options: q.options,
          points: q.points,
        }))

        return NextResponse.json({
          success: true,
          isNew: false,
          session: existingSession,
          assessment: {
            title: assessment.title,
            type: assessment.type,
            durationMinutes: assessment.durationMinutes,
            totalMarks: assessment.totalMarks,
            proctoringEnabled: assessment.proctoringEnabled,
            questions: resumedQuestions,
          },
        })
      }

      existingSession.status = "expired"
      existingSession.endTime = new Date()
      await existingSession.save()
    }

    // 4. If no resumable session, check attempt limits
    const submissionCount = await Submission.countDocuments({
      student: studentId,
      assessment: assessmentId,
    })

    if (submissionCount >= assessment.maxAttempts) {
      return NextResponse.json({
        error: `You have reached the maximum number of attempts (${assessment.maxAttempts}) for this assessment.`,
      }, { status: 403 })
    }

    // 5. Open a fresh attempt. One document per student + assessment is allowed,
    // so reset the previous one instead of inserting.
    const freshAttempt = {
      status: "active" as const,
      startTime: new Date(),
      endTime: undefined,
      warnings: 0,
      maxWarnings: 3,
      violationLog: [],
      microphoneActive: false,
      fullscreenActive: false,
      tabHidden: false,
      lastPolledAt: undefined,
      answersSnapshot: {},
    }

    let proctoringSession: IProctoringSession
    if (existingSession) {
      existingSession.set(freshAttempt)
      await existingSession.save()
      proctoringSession = existingSession
    } else {
      proctoringSession = await ProctoringSession.create({
        assessment: assessmentId,
        student: studentId,
        course: assessment.course,
        ...freshAttempt,
      })
    }

    // 6. Return new session and sanitized assessment
    const sanitizedQuestions = assessment.questions.map((q) => ({
      _id: q._id,
      text: q.text,
      type: q.type,
      options: q.options,
      points: q.points,
    }))

    return NextResponse.json({
      success: true,
      isNew: true,
      session: proctoringSession,
      assessment: {
        title: assessment.title,
        type: assessment.type,
        durationMinutes: assessment.durationMinutes,
        totalMarks: assessment.totalMarks,
        proctoringEnabled: assessment.proctoringEnabled,
        questions: sanitizedQuestions,
      },
    }, { status: 201 })

  } catch (error: unknown) {
    console.error("[START_SESSION_POST]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

/**
 * GET /api/assessments/[id]/session
 * Checks if there is an active session for the current user and returns pre-exam info.
 */
export async function GET(
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

    await connectDB()

    const assessment = await Assessment.findById(assessmentId)
    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 })
    }

    if (!assessment.isPublished) {
      return NextResponse.json({ error: "Assessment is not available yet" }, { status: 403 })
    }

    const enrollment = await StudentProgress.findOne({
      student: studentId,
      course: assessment.course,
    })

    if (!enrollment) {
      return NextResponse.json({ error: "You are not enrolled in this course" }, { status: 403 })
    }

    const submissionCount = await Submission.countDocuments({
      student: studentId,
      assessment: assessmentId,
    })

    if (submissionCount >= assessment.maxAttempts) {
      return NextResponse.json({
        error: `You have reached the maximum number of attempts (${assessment.maxAttempts}) for this assessment.`,
      }, { status: 403 })
    }

    const proctoringSession = await ProctoringSession.findOne({
      assessment: id,
      student: session.user.id,
      status: "active",
    })

    return NextResponse.json({
      hasActiveSession: !!proctoringSession,
      session: proctoringSession || null,
      assessmentInfo: {
        title: assessment.title,
        type: assessment.type,
        durationMinutes: assessment.durationMinutes,
        totalMarks: assessment.totalMarks,
        proctoringEnabled: assessment.proctoringEnabled,
        maxAttempts: assessment.maxAttempts,
        attemptsLeft: assessment.maxAttempts - submissionCount,
      }
    })
  } catch (error: unknown) {
    console.error("[GET_SESSION_STATUS]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
