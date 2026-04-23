import "server-only"
import Assessment, { IAssessment } from "@/models/Assessment.model"
import ProctoringSession, { IProctoringSession } from "@/models/ProctoringSession.model"
import Submission, { IAnswer, ISubmission } from "@/models/Submission.model"
import StudentProgress from "@/models/StudentProgress.model"
import CourseSettings from "@/models/CourseSettings.model"
import { Types } from "mongoose"

export interface GradingInput {
  assessmentId: string | Types.ObjectId
  studentId: string | Types.ObjectId
  answers: { questionId: string; answer: string }[]
  isAutoSubmit?: boolean
  autoSubmittedReason?: string
  proctoringSessionId?: string | Types.ObjectId
}

export interface CourseGrades {
  studentId: string
  courseId: string
  ca: {
    score: number
    maxScore: number
    contribution: number // Weighted contribution to final grade
    weight: number
    items: {
      assessmentId: string
      title: string
      type: string
      score: number
      maxScore: number
    }[]
  }
  exam: {
    score: number
    maxScore: number
    contribution: number
    weight: number
    hasTaken: boolean
  }
  finalGrade: number
}

/**
 * Common grading and submission service.
 * Handles:
 * 1. Scoring
 * 2. Submission creation
 * 3. Session status update
 * 4. Student progress update
 */
export async function processAssessmentSubmission(input: GradingInput) {
  const {
    assessmentId,
    studentId,
    answers,
    isAutoSubmit = false,
    autoSubmittedReason,
    proctoringSessionId
  } = input

  // 1. Fetch Assessment
  const assessment = await Assessment.findById(assessmentId)
  if (!assessment) throw new Error("Assessment not found")

  // 2. Grading Engine
  let score = 0
  const gradedAnswers: IAnswer[] = assessment.questions.map(q => {
    const qId = q._id.toString()
    const studentAnswer = answers.find(a => a.questionId === qId)
    const answerText = studentAnswer ? studentAnswer.answer : ""
    
    // Simple grading (case-insensitive for MCQ/TF/ShortAnswer)
    const isCorrect = answerText.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()
    const pointsAwarded = isCorrect ? q.points : 0
    
    if (isCorrect) score += pointsAwarded
    
    return {
      questionId: q._id,
      answer: answerText,
      isCorrect,
      pointsAwarded
    }
  })

  const percentageScore = (score / assessment.totalMarks) * 100
  const passed = score >= assessment.passingMarks

  // 3. Attempt Number
  const attemptNumber = (await Submission.countDocuments({
    student: studentId,
    assessment: assessmentId
  })) + 1

  // 4. Create Submission
  const submission = await Submission.create({
    student: studentId,
    assessment: assessmentId,
    course: assessment.course,
    proctoringSession: proctoringSessionId,
    answers: gradedAnswers,
    score,
    maxScore: assessment.totalMarks,
    percentageScore,
    passed,
    attemptNumber,
    autoSubmitted: isAutoSubmit,
    autoSubmittedReason: isAutoSubmit ? (autoSubmittedReason || "Automatic submission") : undefined,
    submittedAt: new Date()
  })

  // 5. Update Session Status if it exists
  if (proctoringSessionId) {
    await ProctoringSession.findByIdAndUpdate(proctoringSessionId, {
      status: "submitted",
      endTime: new Date()
    })
  }

  // 6. Update Student Progress
  if (passed) {
    const progress = await StudentProgress.findOne({
      student: studentId,
      course: assessment.course
    })

    if (progress) {
      if (assessment.type === "exam") {
        progress.examPassed = true
        progress.examScore = percentageScore
      } else {
        // Only push if not already completed
        if (!progress.completedTests.includes(assessment._id as Types.ObjectId)) {
          progress.completedTests.push(assessment._id as Types.ObjectId)
        }
      }
      
      // End-of-module module completion
      if (assessment.module && !progress.completedModules.includes(assessment.module as Types.ObjectId)) {
        progress.completedModules.push(assessment.module as Types.ObjectId)
      }
      
      await progress.save()
    }
  }

  return {
    submission,
    score,
    totalMarks: assessment.totalMarks,
    percentageScore,
    passed
  }
}

/**
 * CA Calculation Engine
 * Calculates the Continuous Assessment (CA), Exam, and Final Grade for a student in a course.
 */
export async function calculateStudentGrades(courseId: string, studentId: string): Promise<CourseGrades> {
  // 1. Fetch Course Settings for weights
  const settings = await CourseSettings.findOne({ course: courseId })
  const caWeight = settings?.caWeight ?? 40
  const examWeight = settings?.examWeight ?? 60

  // 2. Fetch all published assessments for the course
  const assessments = await Assessment.find({ course: courseId, isPublished: true })

  // 3. Fetch all submissions for the student in this course
  // We take the highest score for each assessment if multiple attempts exist
  const submissions = await Submission.aggregate([
    { $match: { student: new Types.ObjectId(studentId), course: new Types.ObjectId(courseId) } },
    { $sort: { score: -1 } },
    { $group: { _id: "$assessment", bestSubmission: { $first: "$$ROOT" } } }
  ])

  const submissionMap = new Map(submissions.map(s => [s._id.toString(), s.bestSubmission]))

  // 4. Split assessments into CA and Exam categories
  const caItems: CourseGrades["ca"]["items"] = []
  let caTotalScore = 0
  let caTotalMaxScore = 0

  let examScore = 0
  let examMaxScore = 0
  let hasTakenExam = false

  assessments.forEach(assessment => {
    const bestSub = submissionMap.get(assessment._id.toString())
    const score = bestSub ? bestSub.score : 0
    const maxScore = assessment.totalMarks

    if (assessment.type === "exam") {
      // We only take the absolute latest or best exam score
      if (bestSub) {
        examScore = score
        examMaxScore = maxScore
        hasTakenExam = true
      } else {
        examMaxScore = maxScore // Expected max score
      }
    } else {
      // CA Category: quiz, test, attendance
      caItems.push({
        assessmentId: assessment._id.toString(),
        title: assessment.title,
        type: assessment.type,
        score,
        maxScore
      })
      caTotalScore += score
      caTotalMaxScore += maxScore
    }
  })

  // 5. Apply Formulas
  // CA = (sum of scores / sum of maxScores) * caWeight
  const caContribution = caTotalMaxScore > 0 
    ? (caTotalScore / caTotalMaxScore) * caWeight 
    : 0

  // Exam = (examScore / examMax) * examWeight
  const examContribution = examMaxScore > 0 
    ? (examScore / examMaxScore) * examWeight 
    : 0

  // Final = CA + Exam
  const finalGrade = caContribution + examContribution

  return {
    studentId,
    courseId,
    ca: {
      score: caTotalScore,
      maxScore: caTotalMaxScore,
      contribution: Number(caContribution.toFixed(2)),
      weight: caWeight,
      items: caItems
    },
    exam: {
      score: examScore,
      maxScore: examMaxScore,
      contribution: Number(examContribution.toFixed(2)),
      weight: examWeight,
      hasTaken: hasTakenExam
    },
    finalGrade: Number(finalGrade.toFixed(2))
  }
}
