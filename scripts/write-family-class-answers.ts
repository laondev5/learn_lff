import fs from 'node:fs'
import path from 'node:path'
import mongoose from 'mongoose'

const base = process.cwd()
const envPath = path.join(base, '.env.local')
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 })

  const db = mongoose.connection.db
  const lessons = db.collection('lessons')
  const modules = db.collection('modules')

  const COURSE = '6ae7aefcb85ea3c5d860b351'
  const answersPath = path.join(base, 'scripts/family-answers-v2.json')
  const answers = JSON.parse(fs.readFileSync(answersPath, 'utf8'))

  const mods = await modules.find({ course: new mongoose.Types.ObjectId(COURSE) }).sort({ order: 1 }).toArray()

  // build a fuzzy keyword matcher: for each answer section, find the platform module whose title
  // best overlaps with the section's topic keywords. Manual curated overrides first.
  const manualMap: Record<string, string> = {
    'SALVATION & REPENTANCE FROM DEAD WORKS': 'Salvation and Repentance from Dead Works',
    'FAITH TOWARDS GOD & BUILDING FAITH': 'Faith Towards God',
    'UNDERSTANDING THE GOD-HEAD': 'Understanding the Godhead',
    'DOCTRINE OF BAPTISMS': 'Doctrine of Baptism',
    'LAYING-ON OF HANDS': 'Laying of Hands',
    'RESURRECTION': 'Resurrections',
    'THE CHURCH': 'A Brief About Sanctuary of Grace',
    'FELLOWSHIP & KEYS TO FAMILY COMMITMENT': 'Keys to Family Commitment',
    'BUILDING LOVE AND UNITY': 'Building Love and Unity',
    'MISSION STATEMENT: UPHOLDING THE VISION': 'Mission Statement: Upholding the Vision',
    'CARE': 'Care',
    'YOU AND YOUR PASTOR': 'Basic Introduction to the Living Faith Foundation',
    'THE CHURCH WORKER': 'The Church Worker',
    'STEWARDSHIP': 'Stewardship',
    'LEADERSHIP & FOLLOWERSHIP': 'Leadership and Followership — Pastor Ayotunde',
    'KINGDOM INVESTMENT': 'Principle of Kingdom Investment',
    'TITHING & FIRSTFRUITS': 'Tithing and First Fruits',
    'SOUL-WINNING: THE GREAT COMMISSION': 'Tithing and First Fruits — Pst Wale',
  }

  // title -> { moduleId, lessonId, lessonTitle }  (keyed by module title AND lesson title)
  const lessonByTitle = new Map()
  const lessonByLessonTitle = new Map()
  for (const m of mods) {
    const l = await lessons.findOne({ module: m._id, course: new mongoose.Types.ObjectId(COURSE) })
    if (!l) continue
    const mk = m.title.trim().toLowerCase()
    const lk = l.title.trim().toLowerCase()
    lessonByTitle.set(mk, { moduleId: m._id, lessonId: l._id, lessonTitle: l.title })
    lessonByLessonTitle.set(lk, { moduleId: m._id, lessonId: l._id, lessonTitle: l.title })
  }

  const ObjectId = mongoose.Types.ObjectId
  const written = []
  const skipped = []
  const unmatched = []

  for (const section of answers) {
    const title = section.section.trim()
    let targetLesson: { moduleId: any; lessonId: any; lessonTitle: any } | undefined

    // 1) manual override (match by module title OR lesson title)
    const override = manualMap[title]
    if (override) {
      const key = override.trim().toLowerCase()
      targetLesson = lessonByTitle.get(key) ?? lessonByLessonTitle.get(key)
    }

    // 2) fuzzy: highest token overlap between section title and module title
    if (!targetLesson) {
      const sectionTokens = new Set(title.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean))
      let best = 0
      for (const [key, rec] of lessonByTitle) {
        const mtokens = new Set(key.replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean))
        let overlap = 0
        for (const t of sectionTokens) { if (mtokens.has(t)) overlap++ }
        if (overlap > best) { best = overlap; targetLesson = rec }
      }
      if (!targetLesson || best === 0) unmatched.push(title)
    }

    if (!targetLesson) { skipped.push(title); continue }

    const lesson = await lessons.findOne({ _id: targetLesson.lessonId })
    if (!lesson) { skipped.push(`${title} (lesson gone)`); continue }

    const block = (() => {
      const lines = [`## ${title}`, '']
      for (const q of section.questions) {
        const a = q.a == null ? '<none>' : String(q.a)
        lines.push(q.q)
        lines.push(`Answer: ${a}`)
        lines.push('')
      }
      return lines.join('\n').trimEnd() + '\n\n---\n\n'
    })()

    const prev = lesson.content || ''
    if (prev.includes('## ' + title)) {
      skipped.push(`${title} (already present in "${targetLesson.lessonTitle}")`); continue
    }

    const next = prev ? prev + '\n\n' + block : block
    await lessons.updateOne({ _id: lesson._id }, { $set: { content: next } })
    written.push({ lessonId: String(lesson._id), lessonTitle: lesson.title, section: title, qcount: section.questions.length })
    console.log(`WROTE lesson ${lesson._id} "${String(lesson.title).slice(0, 45)}" <- ${title} (${section.questions.length} Q, module "${mods.find(m => m._id.equals(targetLesson.moduleId))?.title?.slice(0, 30) ?? '??'}")`)
  }

  console.log('\nWRITTEN', written.length, '| SKIPPED', skipped.length, '| UNMATCHED', unmatched.length)
  console.log('\nWRITTEN:')
  for (const w of written) console.log(`  - ${w.lessonId} "${w.lessonTitle}" <- ${w.section} (${w.qcount} Q)`)
  if (skipped.length) console.log('\nSKIPPED:')
  for (const s of skipped) console.log(`  - ${s}`)
  if (unmatched.length) console.log('\nUNMATCHED (no module match):')
  for (const u of unmatched) console.log(`  - ${u}`)

  // read-back sample
  if (written.length) {
    const sample = await lessons.findOne({ _id: new ObjectId(written[0].lessonId) })
    if (sample) {
      console.log('\nSAMPLE READ-BACK (lesson', sample._id, '):')
      console.log((String(sample.content || '').slice(0, 1600)))
    }
  }

  await mongoose.disconnect()
}

run().then(() => process.exit(0), (e) => { console.error(e); process.exit(1) })
