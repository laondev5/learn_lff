import path from 'node:path'
const base = process.cwd()
const fileUrl = (p) => 'file://' + path.join(base, p).replace(/\\/g, '/')
console.log('Lesson.model url:', fileUrl('src/models/Lesson.model'))
