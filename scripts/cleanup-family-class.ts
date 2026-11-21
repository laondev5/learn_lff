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
  const COURSE = '6ae7aefcb85ea3c5d860b351'

  // Find lessons that contain the THE CHURCH WORKER block and remove it if the lesson
  // is NOT the intended home (Stewardship lesson). The intended home is the Stewardship lesson.
  const stewardshipLessonId = '6ae7c6123dd07e9826798d9e' // Stewardship lesson (The Church Worker module)

  const targetSection = 'THE CHURCH WORKER'
  const all = await lessons.find({ course: new mongoose.Types.ObjectId(COURSE) }).toArray()
  console.log('Cleaning up duplicate THE CHURCH WORKER blocks...')

  for (const l of all) {
    const c = String(l.content || '')
    if (!c.includes('## ' + targetSection)) continue

    const isHome = l._id.toString() === stewardshipLessonId
    console.log(`  lesson ${l._id} "${l.title}" -> THE CHURCH WORKER present, isHome=${isHome}`)

    if (!isHome) {
      // Remove the THE CHURCH WORKER block from this lesson
      const blockStart = c.indexOf('## ' + targetSection)
      const blockEnd = c.indexOf('\n\n---\n\n', blockStart)
      const before = c.slice(0, blockStart)
      const afterBlock = c.slice(blockEnd + 8) // length of '\n\n---\n\n'
      // Clean up extra separators/blank lines at the join
      let cleaned = (before.trimEnd() + (afterBlock.trimStart() ? '\n\n' + afterBlock.trimStart() : '')).trim()
      // Also remove leading separator if present
      cleaned = cleaned.replace(/^---[\s\S]*?^---/m, (m) => { const x = m.trim(); return x ? '\n\n' + x + '\n\n' : '' })
      // Collapse multiple separators
      cleaned = cleaned.replace(/\n---\n/g, '\n\n---\n\n').replace(/\n{3,}/g, '\n\n').trim()
      await lessons.updateOne({ _id: l._id }, { $set: { content: cleaned } })
      console.log(`    -> REMOVED THE CHURCH WORKER block. New contentLen=${(cleaned || '').length}`)
    }
  }

  // Verify
  console.log('\n--- After cleanup ---')
  const verify = await lessons.find({ course: new mongoose.Types.ObjectId(COURSE) }).sort({ order: 1 }).toArray()
  for (const l of verify) {
    const c = String(l.content || '')
    const secs = c.split('## ').slice(1).map(s => s.split('\n')[0].trim()).filter(s => !s.includes('---') && s.length > 0)
    if (secs.length) console.log(`  lesson ${l._id} | ${l.title} | ${secs.length}: ${secs.join(' / ')}`)
  }

  await mongoose.disconnect()
  process.exit(0)
}
run().catch(e => { console.error(e); process.exit(1) })
