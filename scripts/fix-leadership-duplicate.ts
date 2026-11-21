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

  const leadershipId = new mongoose.Types.ObjectId('6ae7c68a3dd07e9826798d9f')
  const target = 'YOU AND YOUR PASTOR'

  const l = await lessons.findOne({ _id: leadershipId })
  const content = String(l.content || '')
  console.log('Leadership lesson contentLen before:', content.length)
  console.log('Contains YOU AND YOUR PASTOR block:', content.includes('## ' + target))

  // If the YOU AND YOUR PASTOR block is the FIRST block, remove it.
  // If it's the SECOND block, remove it but keep the first (LEADERSHIP & FOLLOWERSHIP).
  const idx = content.indexOf('## ' + target)
  if (idx < 0) {
    console.log('YOU AND YOUR PASTOR block NOT found — already removed or never there.')
    console.log('Current blocks:', content.split('## ').slice(1).map(s => s.split('\n')[0].trim()).filter(s => s.length > 0 && !s.includes('---')))
    process.exit(0)
  }

  // Determine if this block is at the start (right after original content) or after another block
  const beforeBlock = content.slice(0, idx).trimEnd()
  const blockEnd = content.indexOf('\n\n---\n\n', idx)
  const afterBlock = blockEnd > 0 ? content.slice(blockEnd + 8).trimStart() : ''
  const cleaned = (beforeBlock + (afterBlock ? '\n\n' + afterBlock : '')).trim()

  // Verify the target block is gone
  if (cleaned.includes('## ' + target)) {
    console.log('ERROR: block still present after cleanup!')
    console.log('cleaned contentLen:', cleaned.length)
    process.exit(1)
  }

  // Make sure we still have the LEADERSHIP & FOLLOWERSHIP block and the original content
  const stillHasLeadership = cleaned.includes('## LEADERSHIP & FOLLOWERSHIP')
  const stillStartsWithOverview = cleaned.startsWith('Lesson Overview')
  console.log('Still has LEADERSHIP & FOLLOWERSHIP block:', stillHasLeadership)
  console.log('Still starts with Lesson Overview:', stillStartsWithOverview)
  console.log('New contentLen:', cleaned.length)

  if (!stillHasLeadership || !stillStartsWithOverview) {
    console.log('WARNING: something went wrong — restoring from studentNotes not attempted.')
    process.exit(1)
  }

  await lessons.updateOne({ _id: leadershipId }, { $set: { content: cleaned } })
  console.log('Removed duplicate YOU AND YOUR PASTOR block from Leadership lesson.')

  // Verify
  const l2 = await lessons.findOne({ _id: leadershipId })
  const c2 = String(l2.content || '')
  const blocks = c2.split('## ').slice(1).map(s => s.split('\n')[0].trim()).filter(s => s.length > 0 && !s.includes('---'))
  console.log('\n--- After fix ---')
  console.log('contentLen:', c2.length)
  console.log('blocks:', blocks)
  console.log('startsWithOverview:', c2.startsWith('Lesson Overview'))

  await mongoose.disconnect()
  process.exit(0)
}
run().catch(e => { console.error(e); process.exit(1) })
