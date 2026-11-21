import fs from 'node:fs'
import path from 'node:path'
import mongoose from 'mongoose'

const envPath = path.join(process.cwd(), '.env.local')
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 })
  const db = mongoose.connection.db
  const lessons = db.collection('lessons')
  const ids = ['6ae7ba00847cf096be51bf8c', '6ae7b658954af6a95c612f22', '6ae7b4f82106b5fc2079acbd']
  for (const id of ids) {
    const l = await lessons.findOne({ _id: new mongoose.Types.ObjectId(id) })
    console.log('LESSON', id, l.title)
    console.log('  contentLen', (l.content || '').length)
    console.log('  studentNotes:', l.studentNotes || '(none)')
    console.log('  videoCues count:', (l.videoCues || []).length)
    console.log('  videoCues[0]:', JSON.stringify((l.videoCues || [])[0] || null).slice(0, 200))
    console.log()
  }
  await mongoose.disconnect()
  process.exit(0)
}
run().catch(e => { console.error(e); process.exit(1) })
