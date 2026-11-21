import fs from 'node:fs'
import path from 'node:path'
import mongoose from 'mongoose'

const base = process.cwd()
const envPath = path.join(base, '.env.local')
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 })

const fileUrl = (p) => 'file://' + path.join(base, p).replace(/\\/g, '/').replace(/^file:\/\/C\//, 'file:///C:/')
const Lesson = (await import(fileUrl('src/models/Lesson.model'))).default
const Module = (await import(fileUrl('src/models/Module.model'))).default

const COURSE = '6ae7aefcb85ea3c5d860b351'
const answersPath = path.join(base, 'scripts/family-answers-v2.json')
const answers = JSON.parse(fs.readFileSync(answersPath, 'utf8'))

// group sections by their module number (answers file carries module=N per section)
const byModule = new Map()
for (const s of answers) {
  const mod = s.module
  if (!byModule.has(mod)) byModule.set(mod, [])
  byModule.get(mod).push(s)
}

const mods = await Module.find({ course: COURSE }).sort({ order: 1 }).lean()
console.log('modules found:', mods.length)

const blockForSection = (section) => {
  const lines = [`## ${section.section}`, '']
  for (const q of section.questions) {
    const a = q.a == null ? '<none>' : q.a
    lines.push(`${q.q}`)
    lines.push(`Answer: ${a}`)
    lines.push('')
  }
  return lines.join('\n').trimEnd() + '\n\n---\n\n'
}

const updated = []
for (const m of mods) {
  const lessons = await Lesson.find({ module: m._id }).sort({ order: 1 }).lean()
  const sections = byModule.get(m.order) ?? []
  if (!sections.length) continue
  for (let i = 0; i < sections.length; i++) {
    const lesson = lessons[i]
    if (!lesson) { console.log(`WARN: no lesson slot for section ${i+1} in module ${m.order} (${m.title.slice(0,40)})`); continue }
    const block = blockForSection(sections[i])
    const prev = lesson.content || ''
    // append only if not already present (avoid double-writing on re-runs)
    if (prev.includes('## ' + sections[i].section)) {
      console.log(`SKIP already present: lesson ${lesson._id} "${lesson.title.slice(0,40)}" -> ${sections[i].section}`)
      continue
    }
    const next = prev ? prev + '\n\n' + block : block
    await Lesson.findByIdAndUpdate(lesson._id, { content: next }, { runValidators: true })
    updated.push({ lesson: lesson._id, title: lesson.title, section: sections[i].section, qcount: sections[i].questions.length })
    console.log(`WROTE lesson ${lesson._id} "${lesson.title.slice(0,45)}" <- ${sections[i].section} (${sections[i].questions.length} Q)`)
  }
}

console.log('\nWRITTEN', updated.length, 'lesson(s):')
for (const u of updated) console.log(`  - ${u.lesson} "${u.title}" <- ${u.section} (${u.qcount} Q)`)

// Final confirmation read-back of one sample lesson
const sample = await Lesson.findById(updated[0]?.lesson).lean()
if (sample) {
  console.log('\nSAMPLE READ-BACK (lesson', sample._id, '):')
  console.log((sample.content || '').slice(0, 1200))
}

await mongoose.disconnect()
process.exit(0)
