/**
 * Seed the FAMILY CLASS fill-in-the-blank module tests as published Assessments.
 *
 * Source: scripts/family-module-answers.json (221 questions, answers sourced from
 * the lecture transcripts and lesson notes; unverifiable answers are "<none>").
 *
 * Each of the 18 question sections maps to a module in the Family Class course.
 * Questions whose answer could not be verified are SKIPPED from the published
 * assessment (storing "<none>" as a correct answer would make an unanswerable
 * question). A summary of skipped questions is written to scripts/exam-seed.log.
 *
 * Idempotent: assessments are keyed by course + module + title and updated in place.
 */
import fs from "node:fs"
import path from "node:path"
import mongoose from "mongoose"

const envPath = path.join(process.cwd(), ".env.local")
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const COURSE_ID = "6ae7aefcb85ea3c5d860b351"
const CREATED_BY = "69f7cc6fa8721389b99425be" // admin@lff.com
const answers = JSON.parse(fs.readFileSync(path.join(process.cwd(), "scripts", "family-module-answers.json"), "utf8"))

// Section title -> module title substrings in the DB. Combined sections are
// seeded to both modules they cover so every module ends with a test.
const SECTION_TO_MODULES = {
  "SALVATION & REPENTANCE FROM DEAD WORKS": ["The Foundations of the Faith"],
  "FAITH TOWARDS GOD & BUILDING FAITH": ["Faith Towards God", "Building Faith"],
  "UNDERSTANDING THE GOD-HEAD": ["Understanding the Godhead"],
  "DOCTRINE OF BAPTISMS": ["Doctrine of Baptism"],
  "LAYING-ON OF HANDS": ["Laying of Hands"],
  "RESURRECTION": ["Resurrections"],
  "THE CHURCH": ["Introduction", "A Brief About Sanctuary of Grace"],
  "FELLOWSHIP & KEYS TO FAMILY COMMITMENT": ["Fellowship", "Keys to Family Commitment"],
  "BUILDING LOVE AND UNITY": ["Building Love and Unity", "The Unity Destroyers"],
  "MISSION STATEMENT: UPHOLDING THE VISION": ["Mission Statement"],
  "CARE": ["Care"],
  "YOU AND YOUR PASTOR": ["The Family"],
  "THE CHURCH WORKER": ["The Church Worker"],
  "STEWARDSHIP": ["The Church Worker"],
  "LEADERSHIP & FOLLOWERSHIP": ["Leadership and Followership — Pastor Ayotunde", "Leadership and Followership — Pastor Charles"],
  "KINGDOM INVESTMENT": ["Principle of Kingdom Investment"],
  "TITHING & FIRSTFRUITS": ["Tithing and First Fruits — Pst Wale", "Tithing and First Fruits"],
  "SOUL-WINNING: THE GREAT COMMISSION": ["Tithing and First Fruits"],
}

const log = []
const say = (s) => { log.push(s); console.log(s) }

try {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  const db = mongoose.connection.db
  const modules = await db.collection("modules").find({ course: new mongoose.Types.ObjectId(COURSE_ID) }).toArray()

  let totalQ = 0, seededQ = 0, skippedQ = 0
  for (const section of answers) {
    const moduleTitles = SECTION_TO_MODULES[section.section]
    if (!moduleTitles?.length) { say(`SKIP section "${section.section}": no module mapping`); continue }

    const questions = []
    for (const q of section.questions) {
      totalQ++
      const answer = String(q.a ?? "").trim()
      if (!answer || answer === "<none>") { skippedQ++; continue }
      questions.push({
        _id: new mongoose.Types.ObjectId(),
        text: q.q,
        type: "fill_blank",
        options: [],
        correctAnswer: answer,
        points: 1,
      })
    }
    if (!questions.length) { say(`SKIP section "${section.section}": no verifiable answers`); continue }

    const totalMarks = questions.length
    const passingMarks = Math.max(1, Math.round(totalMarks * 0.7))
    const title = `${section.section} — Module Test`

    for (const moduleTitle of moduleTitles) {
      const module = modules.find((m) => m.title === moduleTitle) ?? modules.find((m) => m.title.includes(moduleTitle))
      if (!module) { say(`SKIP section "${section.section}": module not found (${moduleTitle})`); continue }
      const filter = { course: new mongoose.Types.ObjectId(COURSE_ID), module: module._id, title }
      await db.collection("assessments").updateOne(
        filter,
        {
          $set: {
            title,
            course: new mongoose.Types.ObjectId(COURSE_ID),
            module: module._id,
            type: "test",
            totalMarks,
            passingMarks,
            maxAttempts: 3,
            questions,
            weight: 1,
            durationMinutes: Math.max(10, Number((section.duration || "25").replace(/[^0-9]/g, "")) || 25),
            proctoringEnabled: false,
            allowedViolations: ["tab_switch", "fullscreen_exit"],
            isPublished: true,
            createdBy: new mongoose.Types.ObjectId(CREATED_BY),
          },
        },
        { upsert: true }
      )
      seededQ += questions.length
      say(`SEEDED "${section.section}" -> module "${module.title}" : ${questions.length} questions (skipped ${section.questions.length - questions.length})`)
    }
  }

  say(`\nTOTAL source questions: ${totalQ}`)
  say(`SEEDED: ${seededQ}`)
  say(`SKIPPED (no verified answer): ${skippedQ}`)
} catch (e) {
  say("ERR " + e.message)
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}

fs.writeFileSync(path.join(process.cwd(), "scripts", "exam-seed.log"), log.join("\n") + "\n")
