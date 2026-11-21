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
  const COURSE = '6ae7aefcb85ea3c5d860b351'

  const all = await lessons.find({ course: new mongoose.Types.ObjectId(COURSE) }).sort({ order: 1 }).toArray()
  console.log('Checking all', all.length, 'lessons for content vs studentNotes...')
  console.log('')

  let restored = 0
  let missingNotes = 0
  for (const l of all) {
    const content = String(l.content || '')
    const notes = String(l.studentNotes || '')
    const hasSectionBlock = content.includes('## ')
    const contentStart = content.slice(0, 60)
    const notesStart = notes.slice(0, 60)
    const idStr = l._id.toString()

    console.log(`lesson ${idStr.slice(0, 8)}... | ${String(l.title).slice(0, 40)}`)
    console.log(`  contentLen=${content.length} hasBlock=${hasSectionBlock} contentStart="${contentStart}"`)
    console.log(`  notesLen=${notes.length} notesStart="${notesStart}"`)

    if (hasSectionBlock && notes.length > content.length * 0.5) {
      // The content field has the family-class blocks appended; the original content is in studentNotes.
      // Restore: put the original (studentNotes) back into content, then re-append the family-class blocks.
      // Extract the family-class blocks from the current content.
      const blocks: string[] = []
      const parts = content.split(/^## /m)
      for (let i = 1; i < parts.length; i++) {
        const block = '## ' + parts[i]
        // stop at the next ## or end; keep the block up to its trailing ---\n\n
        const blockEnd = block.indexOf('\n\n---\n\n')
        if (blockEnd > 0) {
          blocks.push(block.slice(0, blockEnd + 8))
        } else {
          blocks.push(block)
        }
      }
      const restoredContent = notes + '\n\n' + blocks.join('\n\n') + '\n\n'
      await lessons.updateOne({ _id: l._id }, { $set: { content: restoredContent } })
      console.log(`  -> RESTORED: original content (${notes.length} chars) + ${blocks.length} family-class block(s)`)
      restored++
    } else if (hasSectionBlock && notes.length === 0) {
      console.log(`  -> SKIP: has block but studentNotes is empty (cannot restore original)`)
      missingNotes++
    } else if (!hasSectionBlock && notes.length > 0) {
      console.log(`  -> OK: no block, original content intact (contentLen=${content.length}, notesLen=${notes.length})`)
    } else {
      console.log(`  -> OK: no block, no notes (contentLen=${content.length})`)
    }
    console.log('')
  }

  console.log(`Summary: restored=${restored}, missingNotes=${missingNotes}, total=${all.length}`)

  // Verify the 3 known-affected lessons
  console.log('\n--- Verify affected lessons ---')
  const affectedIds = ['6ae7ba00847cf096be51bf8c', '6ae7b658954af6a95c612f22', '6ae7b4f82106b5fc2079acbd']
  for (const id of affectedIds) {
    const l = await lessons.findOne({ _id: new mongoose.Types.ObjectId(id) })
    const content = String(l.content || '')
    const firstBlock = content.includes('## ') ? content.split('## ').slice(1)[0].split('\n')[0].trim() : '(no block)'
    console.log(`  ${id.slice(0, 8)}... | ${String(l.title).slice(0, 35)} | contentLen=${content.length} firstBlock="${firstBlock}" notesLen=${String(l.studentNotes||'').length}`)
  }

  await mongoose.disconnect()
  process.exit(0)
}
run().catch(e => { console.error(e); process.exit(1) })
