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

  // The Basic Introduction lesson (6ae7b4f82106b5fc2079acbd) has a duplicate SALVATION & REPENTANCE
  // FROM DEAD WORKS block that should only be on the Salvation lesson (6ae7ba00847cf096be51bf8c).
  // Remove the duplicate from the Basic Introduction lesson.
  const basicIntroId = new mongoose.Types.ObjectId('6ae7b4f82106b5fc2079acbd')
  const target = 'SALVATION & REPENTANCE FROM DEAD WORKS'

  const l = await lessons.findOne({ _id: basicIntroId })
  const content = String(l.content || '')
  console.log('Basic Introduction lesson contentLen before:', content.length)
  console.log('Contains SALVATION block:', content.includes('## ' + target))

  // Extract the SALVATION block from the content and remove it
  const idx = content.indexOf('## ' + target)
  if (idx < 0) { console.log('SALVATION block not found!'); process.exit(1) }

  const before = content.slice(0, idx).trimEnd()
  const afterIdx = content.indexOf('\n\n---\n\n', idx)
  const after = afterIdx > 0 ? content.slice(afterIdx + 8).trimStart() : ''
  const cleaned = (before + (after ? '\n\n' + after : '')).trim()

  // Verify the SALVATION block is no longer present
  if (cleaned.includes('## ' + target)) {
    console.log('ERROR: SALVATION block still present after cleanup!')
    console.log('cleaned contentLen:', cleaned.length)
    process.exit(1)
  }

  await lessons.updateOne({ _id: basicIntroId }, { $set: { content: cleaned } })
  console.log('Removed duplicate SALVATION block. New contentLen:', cleaned.length)

  // Verify
  const l2 = await lessons.findOne({ _id: basicIntroId })
  const c2 = String(l2.content || '')
  console.log('\n--- After fix ---')
  console.log('contentLen:', c2.length)
  const blocks = c2.split('## ').slice(1).map(s => s.split('\n')[0].trim())
  console.log('blocks:', blocks)
  console.log('\nFirst 300 chars of restored content:')
  console.log(c2.slice(0, 300))

  await mongoose.disconnect()
  process.exit(0)
}
run().catch(e => { console.error(e); process.exit(1) })
