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
  console.log('=== FINAL VERIFICATION:', all.length, 'lessons ===\n')

  const expected: Record<string, string[]> = {
    '6ae7ba00847cf096be51bf8c': ['SALVATION & REPENTANCE FROM DEAD WORKS'],
    '6ae7b658954af6a95c612f22': ['THE CHURCH'],
    '6ae7b4f82106b5fc2079acbd': ['YOU AND YOUR PASTOR'],
    '6ae7bf453dd07e9826798d9a': ['FAITH TOWARDS GOD & BUILDING FAITH'],
    '6ae7c09e3dd07e9826798d9b': ['UNDERSTANDING THE GOD-HEAD'],
    '6ae7c1330b571feb01940039': ['DOCTRINE OF BAPTISMS'],
    '6ae7c1ba278dbeb8ad5be06d': ['LAYING-ON OF HANDS'],
    '6ae7c225278dbeb8ad5be06e': ['RESURRECTION'],
    '6ae7c3d70b571feb0194003b': ['FELLOWSHIP & KEYS TO FAMILY COMMITMENT'],
    '6ae7c436278dbeb8ad5be06f': ['BUILDING LOVE AND UNITY'],
    '6ae7c502278dbeb8ad5be071': ['MISSION STATEMENT: UPHOLDING THE VISION'],
    '6ae7c568278dbeb8ad5be072': ['CARE'],
    '6ae7c6123dd07e9826798d9e': ['THE CHURCH WORKER', 'STEWARDSHIP'],
    '6ae7c68a3dd07e9826798d9f': ['LEADERSHIP & FOLLOWERSHIP'],
    '6ae7c7913dd07e9826798da0': ['KINGDOM INVESTMENT'],
    '6ae7c7f93dd07e9826798da1': ['SOUL-WINNING: THE GREAT COMMISSION'],
    '6ae7c87b3dd07e9826798da2': ['TITHING & FIRSTFRUITS'],
  }

  // Wait — the Leadership lesson (6ae7c68a) has BOTH YOU AND YOUR PASTOR AND LEADERSHIP & FOLLOWERSHIP.
  // But the Basic Introduction lesson (6ae7b4f) also has YOU AND YOUR PASTOR (from the manual map).
  // So YOU AND YOUR PASTOR is on TWO lessons. That's a duplicate too!
  // Let me check: the manual map says YOU AND YOUR PASTOR -> 'Basic Introduction to the Living Faith Foundation'.
  // And the fuzzy match for LEADERSHIP & FOLLOWERSHIP -> 'Leadership and Followership — Pastor Ayotunde' (module 18).
  // But the Leadership lesson ALSO has YOU AND YOUR PASTOR. Where did that come from?
  // In run 3, the LEADERSHIP & FOLLOWERSHIP section was mapped to the Leadership lesson. But YOU AND YOUR PASTOR
  // was mapped to the Basic Introduction lesson (module 1). So the Leadership lesson should NOT have YOU AND YOUR PASTOR.
  // Unless... the manual map for YOU AND YOUR PASTOR was wrong in an earlier run and it got written to the Leadership
  // lesson. Let me check the write logs.
  // Actually — looking at run 3's log: "WROTE lesson 6ae7c68a3dd07e9826798d9f \"Leadership and Followership — Pastor Ayotunde\" <- YOU AND YOUR PASTOR (5 Q, module \"Introduction\")"
  // Wait, that says the Leadership lesson got YOU AND YOUR PASTOR! But the manual map says YOU AND YOUR PASTOR -> Basic Introduction.
  // This is because in run 3, the manual map had YOU AND YOUR PASTOR -> 'Basic Introduction to the Living Faith Foundation',
  // but the lookup `lessonByTitle.get('basic introduction to the living faith foundation')` returned the Basic Introduction
  // lesson. So YOU AND YOUR PASTOR was written to the Basic Introduction lesson.
  // But the log says it was written to the Leadership lesson. That's contradictory.
  // Let me re-read run 3's log more carefully.

  let allGood = true
  for (const l of all) {
    const content = String(l.content || '')
    const idStr = l._id.toString()
    const expectedBlocks = expected[idStr] || []
    const actualBlocks = content.split('## ').slice(1).map(s => s.split('\n')[0].trim()).filter(s => s.length > 0 && !s.includes('---'))

    const contentStartsWithOverview = content.startsWith('Lesson Overview')
    const notesLen = String(l.studentNotes || '').length

    // Lessons that never had content in the content field (only in studentNotes):
    // These are video lessons whose content lives in studentNotes, per the pre-write inspection.
    const alwaysEmptyContentIds = new Set([
      '6ae7c3183dd07e9826798d9c', // Commitment to the Family
      '6ae7c37d0b571feb0194003a', // Fellowship
      '6ae7c70c0b571feb0194003c', // Leadership and Followership — Pastor Charles
      '6ae7bfef278dbeb8ad5be06c', // Building Faith
      '6ae7c4a6278dbeb8ad5be070', // The Unity Destroyers
    ])
    const wasAlwaysEmpty = alwaysEmptyContentIds.has(idStr)
    const missingOriginal = !wasAlwaysEmpty && !contentStartsWithOverview && notesLen > 100
    const hasExtra = actualBlocks.some(b => !expectedBlocks.includes(b))
    const missingExpected = expectedBlocks.some(b => !actualBlocks.includes(b))

    const status = missingOriginal ? '❌ LOST ORIGINAL' : hasExtra ? '❌ EXTRA BLOCK' : missingExpected ? '❌ MISSING BLOCK' : '✅ OK'
    if (status !== '✅ OK') allGood = false

    console.log(`[${status}] ${l.title}`)
    console.log(`    contentLen=${content.length} notesLen=${notesLen} startsWithOverview=${contentStartsWithOverview}`)
    console.log(`    expected: ${expectedBlocks.length ? expectedBlocks.join(', ') : '(none)'}`)
    console.log(`    actual:   ${actualBlocks.length ? actualBlocks.join(', ') : '(none)'}`)
    if (hasExtra || missingExpected) console.log(`    PROBLEM: extra=${actualBlocks.filter(b=>!expectedBlocks.includes(b))} missing=${expectedBlocks.filter(b=>!actualBlocks.includes(b))}`)
    console.log('')
  }

  console.log('=== OVERALL:', allGood ? 'ALL LESSONS OK' : 'SOME LESSONS HAVE PROBLEMS', '===')

  await mongoose.disconnect()
  process.exit(allGood ? 0 : 1)
}
run().catch(e => { console.error(e); process.exit(1) })
