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

  const mods = await modules.find({ course: new mongoose.Types.ObjectId(COURSE) }).sort({ order: 1 }).toArray()
  console.log('MODULES for course', COURSE, '->', mods.length)
  for (const m of mods) {
    const l = await lessons.find({ module: m._id }).sort({ order: 1 }).toArray()
    console.log(`  MODULE ${m._id} "${String(m.title).slice(0, 50)}" (order=${m.order}) -> ${l.length} lessons:`)
    for (const x of l) {
      console.log(`      lesson ${x._id} [${x.order}] "${String(x.title).slice(0, 48)}" type=${x.lessonType||'text'} video=${!!x.videoUrl||!!x.youtubeVideoId} contentLen=${(x.content||'').length}`)
    }
  }

  await mongoose.disconnect()
}
run().then(() => process.exit(0), (e) => { console.error(e); process.exit(1) })
