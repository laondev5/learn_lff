import { z } from "zod"

export const assessmentQuestionSchema = z.object({
  text: z.string().min(1, "Question text is required"),
  type: z.enum(["mcq", "true_false", "short_answer"]),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().min(1, "Correct answer is required"),
  points: z.number().min(0, "Points must be non-negative"),
})

export const assessmentSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  courseId: z.string().min(1, "Course ID is required"),
  moduleId: z.string().optional(),
  type: z.enum(["quiz", "test", "attendance", "exam"]),
  totalMarks: z.number().min(0).optional(), // Can be calculated from questions
  passingMarks: z.number().min(0),
  maxAttempts: z.number().min(1).default(1),
  questions: z.array(assessmentQuestionSchema).min(1, "At least one question is required"),
  weight: z.number().min(0).default(1),
  durationMinutes: z.number().min(1, "Duration must be at least 1 minute"),
  proctoringEnabled: z.boolean().default(false),
  allowedViolations: z.array(z.enum([
    "tab_switch",
    "fullscreen_exit",
    "microphone_inactive",
    "copy_paste",
    "right_click",
  ])).default(["tab_switch", "fullscreen_exit"]),
  isPublished: z.boolean().default(false),
})

export type CreateAssessmentInput = z.infer<typeof assessmentSchema>

export const courseSettingsSchema = z.object({
  caWeight: z.number().min(0).max(100),
  examWeight: z.number().min(0).max(100),
  proctoringEnabled: z.boolean().default(false),
  maxWarnings: z.number().min(1).max(10).default(3),
}).refine(data => data.caWeight + data.examWeight === 100, {
  message: "CA weight and Exam weight must sum to 100",
  path: ["caWeight"],
})

export type UpdateCourseSettingsInput = z.infer<typeof courseSettingsSchema>

export const violationReportSchema = z.object({
  microphoneActive: z.boolean(),
  fullscreenActive: z.boolean(),
  tabHidden: z.boolean(),
  violation: z.enum([
    "tab_switch",
    "fullscreen_exit",
    "microphone_inactive",
    "copy_paste",
    "right_click",
  ]).optional(),
  details: z.string().optional(),
  answersSnapshot: z.record(z.string(), z.string()).optional(),
})

export type ViolationReportInput = z.infer<typeof violationReportSchema>

export const submissionSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string(),
    answer: z.string(),
  })),
})

export type SubmissionInput = z.infer<typeof submissionSchema>
