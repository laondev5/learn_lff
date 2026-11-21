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

  const all = await lessons.find({ course: new mongoose.Types.ObjectId(COURSE) }).sort({ order: 1 }).toArray()
  console.log('total lessons in course:', all.length)
  let withBlock = 0
  for (const l of all) {
    const c = String(l.content || '')
    const secs = c.split('## ').slice(1).map(s => s.split('\n')[0].trim())
    const realSecs = secs.filter(s => !s.includes('---') && s.length > 0)
    if (realSecs.length) {
      withBlock++
      console.log(`  lesson ${l._id} | ${l.title} | ${realSecs.length} section(s): ${realSecs.join(' / ')}`)
    }
  }
  console.log('lessons with a family-class-style section block:', withBlock)

  await mongoose.disconnect()
  process.exit(0)
}
run().catch(e => { console.error(e); process.exit(1) })
