/**
 * Seed the Family Class FINAL EXAM (Batch B) as a published Assessment of type "exam".
 *
 * Source: scripts/family-final-exam-batch-b.json, transcribed from
 * "FAMILY CLASS QUESTIONS BATCH B.docx".
 *
 * The exam is course-level (no `module`), which is what makes the app treat it as
 * the final exam: src/lib/assessment-access.ts refuses entry until every published
 * module is complete.
 *
 * Objective questions are `mcq` because the paper prints an explicit option set for
 * each gap. Essay questions are `short_answer` and carry a `keywords` list used by
 * the keyword-coverage grader in src/actions/student.actions.ts.
 *
 * Idempotent: keyed by course + type "exam", so re-running updates in place.
 */
import fs from "node:fs"
import path from "node:path"
import mongoose from "mongoose"

const envPath = path.join(process.cwd(), ".env.local")
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const CREATED_BY = "69f7cc6fa8721389b99425be" // admin@lff.com
const spec = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "scripts", "family-final-exam-batch-b.json"), "utf8")
)

const log = []
const say = (s) => { log.push(s); console.log(s) }

try {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  const db = mongoose.connection.db
  const courseId = new mongoose.Types.ObjectId(spec.courseId)

  const course = await db.collection("courses").findOne({ _id: courseId })
  if (!course) throw new Error(`Course ${spec.courseId} not found`)
  say(`COURSE: ${course.title}`)

  const questions = []
  // Re-use IDs for questions whose text is unchanged so answer snapshots from
  // an existing session are not invalidated by a re-seed.
  const existingExam = await db.collection("assessments").findOne({ course: courseId, type: "exam" })
  const idByText = new Map(
    (existingExam?.questions ?? []).map((q) => [q.text?.trim(), q._id])
  )

  // Papers carry a `step` so the exam is delivered as a wizard (Part 1 MCQ →
  // Part 1 essay → Part 2 MCQ → Part 2 essay) rather than one long form.
  const papers = [...spec.papers].sort((a, b) => (a.step ?? 99) - (b.step ?? 99))
  for (const paper of papers) {
    const section = paper.stepLabel ?? `${paper.paper} — ${paper.section}`
    for (const q of paper.questions) {
      questions.push({
        _id: idByText.get(q.text?.trim()) ?? new mongoose.Types.ObjectId(),
        text: q.text,
        type: q.type,
        options: q.type === "mcq" ? q.options : [],
        // For essays the correctAnswer is the model answer; `keywords` rides along
        // as an extra field on the subdocument so the grader can read it back.
        correctAnswer: q.correctAnswer,
        points: q.points,
        section,
        ...(q.keywords ? { keywords: q.keywords } : {}),
      })
    }
    say(`  step ${paper.step ?? "?"} — ${section}: ${paper.questions.length} questions`)
  }

  const totalMarks = questions.reduce((s, q) => s + q.points, 0)
  const passingMarks = Math.round((totalMarks * spec.passingScore) / 100)

  const doc = {
    title: spec.title,
    course: courseId,
    type: "exam",
    totalMarks,
    passingMarks,
    maxAttempts: spec.maxAttempts,
    questions,
    weight: 1,
    durationMinutes: spec.durationMinutes,
    proctoringEnabled: true,
    allowedViolations: [
      "tab_switch",
      "fullscreen_exit",
      "microphone_inactive",
      "multi_screen",
      "noise_detected",
      "movement_detected",
      "face_not_visible",
      "multiple_faces",
    ],
    isPublished: true,
    createdBy: new mongoose.Types.ObjectId(CREATED_BY),
    updatedAt: new Date(),
  }

  const existing = existingExam
  if (existing) {
    await db.collection("assessments").updateOne({ _id: existing._id }, { $set: doc })
    say(`UPDATED exam ${existing._id}`)
  } else {
    const res = await db.collection("assessments").insertOne({ ...doc, createdAt: new Date() })
    say(`CREATED exam ${res.insertedId}`)
  }

  say(`\nTOTAL questions: ${questions.length}`)
  say(`  mcq: ${questions.filter((q) => q.type === "mcq").length}`)
  say(`  short_answer: ${questions.filter((q) => q.type === "short_answer").length}`)
  say(`TOTAL marks: ${totalMarks} | passing: ${passingMarks} (${spec.passingScore}%) | duration: ${spec.durationMinutes} min`)

  // Verify what is actually stored.
  const saved = await db.collection("assessments").findOne({ course: courseId, type: "exam" })
  say(`VERIFY: ${saved.title} | q=${saved.questions.length} | marks=${saved.totalMarks}/${saved.passingMarks} | published=${saved.isPublished}`)
} catch (e) {
  say("ERR " + e.message)
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}

fs.writeFileSync(path.join(process.cwd(), "scripts", "family-final-exam-seed.log"), log.join("\n") + "\n")
