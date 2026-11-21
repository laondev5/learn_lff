#!/usr/bin/env node
// Raw collections deliberately avoid schema hooks, casting, and automatic timestamps.
import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import { mkdir, open, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { parseEnv } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const { ObjectId } = mongoose.Types;
const { EJSON } = mongoose.mongo.BSON;
const id = value => String(value ?? '');
const encode = value => EJSON.stringify(value, { relaxed: false });
const equal = (a, b) => encode(a) === encode(b);
const digest = value => createHash('sha256').update(encode(value)).digest('hex');
export const childId = (course, lesson) => new ObjectId(createHash('sha256')
  .update(`one-video-per-module:v1:${id(course)}:${id(lesson)}`).digest('hex').slice(0, 24));

export function parseArgs(args) {
  const options = { apply: false, maintenance: false, allowNoTransactions: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--course' && !options.course) options.course = args[++i];
    else if (arg === '--apply') options.apply = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--maintenance-confirmed') options.maintenance = true;
    else if (arg === '--allow-no-transactions') options.allowNoTransactions = true;
    else throw new Error('Invalid arguments. Use --course <24-hex-ID> [--dry-run | --apply --maintenance-confirmed [--allow-no-transactions]].');
  }
  if (!/^[a-f0-9]{24}$/i.test(options.course ?? '')) throw new Error('--course requires a 24-hex ObjectId.');
  if (options.apply && options.dryRun) throw new Error('--apply and --dry-run are mutually exclusive.');
  return options;
}

export function buildPlan(data) {
  const { course, modules, lessons, tests, assessments, studentprogresses } = data;
  const issues = [], changes = [], mapping = [];
  const byId = new Map(modules.map(m => [id(m._id), m]));
  const lessonById = new Map(lessons.map(l => [id(l._id), l]));
  const ordered = (docs, label) => {
    const orders = new Set();
    for (const d of docs) {
      if (!Number.isFinite(d.order) || orders.has(d.order)) issues.push(`Ambiguous ${label} order at ${id(d._id)}.`);
      orders.add(d.order);
    }
    return [...docs].sort((a, b) => a.order - b.order || id(a._id).localeCompare(id(b._id)));
  };
  const update = (collection, before, fields) => {
    const set = Object.fromEntries(Object.entries(fields).filter(([k, v]) => !equal(before[k], v)));
    if (Object.keys(set).length) changes.push({ collection, before, set });
  };
  for (const doc of [...modules, ...lessons, ...tests, ...assessments, ...studentprogresses]) {
    if (id(doc.course) !== id(course._id)) issues.push(`Cross-course reference in ${id(doc._id)}.`);
  }
  for (const l of lessons) {
    if (!byId.has(id(l.module))) issues.push(`Orphan lesson ${id(l._id)}.`);
    if (l.lessonType !== 'video') issues.push(`Non-video lesson ${id(l._id)} requires explicit content handling.`);
  }
  let order = modules.length ? Math.min(...modules.map(m => m.order)) : 1;
  const targets = [];
  for (const mod of ordered(modules, 'module')) {
    const children = ordered(lessons.filter(l => id(l.module) === id(mod._id)), `lesson in ${id(mod._id)}`);
    if (!children.length) {
      issues.push(`Empty module ${id(mod._id)} cannot become a video module.`);
      continue;
    }
    if (children.length > 1 && assessments.some(a => id(a.module) === id(mod._id))) {
      issues.push(`Collective assessment on split module ${id(mod._id)}: blocked; final-child attachment is not proven equivalent.`);
    }
    children.forEach((lesson, index) => {
      const target = index === 0 ? mod._id : childId(course._id, lesson._id);
      if (index && byId.has(id(target))) issues.push(`Deterministic module ID collision ${id(target)}.`);
      if (index === 0) update('modules', mod, { order });
      else changes.push({ collection: 'modules', insert: { ...mod, _id: target,
        title: lesson.title, order } });
      update('lessons', lesson, { module: target });
      mapping.push({ lesson: id(lesson._id), title: lesson.title, from: id(mod._id), to: id(target), order });
      targets.push({ _id: target, original: mod, lesson });
      order++;
    });
  }
  const targetByLesson = new Map(mapping.map(m => [m.lesson, new ObjectId(m.to)]));
  for (const test of tests) {
    const lesson = lessonById.get(id(test.lesson));
    if (!lesson) issues.push(`Orphan test ${id(test._id)}.`);
    else if (test.module) {
      if (id(test.module) !== id(lesson.module)) issues.push(`Inconsistent test module ${id(test._id)}.`);
      update('tests', test, { module: targetByLesson.get(id(test.lesson)) });
    }
  }
  for (const a of assessments) {
    if (a.module && !byId.has(id(a.module))) issues.push(`Orphan assessment ${id(a._id)}.`);
  }
  for (const p of studentprogresses) {
    if (![p.completedLessons, p.completedTests, p.completedModules].every(Array.isArray)) {
      issues.push(`Malformed progress ${id(p._id)}.`); continue;
    }
    const doneLessons = new Set(p.completedLessons.map(id));
    const doneTests = new Set(p.completedTests.map(id));
    const oldModules = new Set(p.completedModules.map(id));
    const completed = [];
    for (const target of targets) {
      const { lesson, original } = target;
      const requiredTests = tests.filter(t => id(t.lesson) === id(lesson._id) && t.isPublished);
      const requiredAssessments = assessments.filter(a => id(a.module) === id(original._id) && a.isPublished);
      const done = doneLessons.has(id(lesson._id)) && requiredTests.every(t => doneTests.has(id(t._id)))
        && requiredAssessments.every(a => doneTests.has(id(a._id)));
      // A module-only completion can come from an assessment. Never guess lesson completions.
      if (oldModules.has(id(original._id)) && !done) {
        issues.push(`Progress ${id(p._id)} has module completion without supporting lesson/test evidence for ${id(lesson._id)}; would reduce access.`);
      }
      if (done) completed.push(target._id);
    }
    // Preserve historical/dangling references; they are not ours to delete.
    completed.push(...p.completedModules.filter(m => !byId.has(id(m))));
    update('studentprogresses', p, { completedModules: completed });
  }
  return { issues: [...new Set(issues)], changes, mapping };
}

export async function readSnapshot(db, courseId, session) {
  const options = session ? { session } : {};
  const course = await db.collection('courses').findOne({ _id: courseId }, options);
  if (!course) throw new Error('Course not found.');
  const find = (name, query) => db.collection(name).find(query, options).sort({ _id: 1 }).toArray();
  const modules = await find('modules', { course: courseId });
  const moduleIds = modules.map(m => m._id);
  const lessons = await find('lessons', { $or: [{ course: courseId }, { module: { $in: moduleIds } }] });
  const lessonIds = lessons.map(l => l._id);
  const tests = await find('tests', { $or: [{ course: courseId }, { lesson: { $in: lessonIds } }, { module: { $in: moduleIds } }] });
  const assessments = await find('assessments', { $or: [{ course: courseId }, { module: { $in: moduleIds } }] });
  const studentprogresses = await find('studentprogresses', { $or: [{ course: courseId }, { completedModules: { $in: moduleIds } }, { completedLessons: { $in: lessonIds } }] });
  return { course, modules, lessons, tests, assessments, studentprogresses };
}

export async function writeBackup(data, plan, directory = path.join(root, '.env.video-module-backups')) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const filename = path.join(directory, `${id(data.course._id)}-${Date.now()}-${digest(data).slice(0, 12)}.ejson`);
  // Use an existing ignore rule; never silently alter repository configuration.
  try { execFileSync('git', ['check-ignore', '-q', '--', filename], { cwd: root, stdio: 'ignore' }); }
  catch { throw new Error('Backup path is not git-ignored; refusing apply.'); }
  const file = await open(filename, 'wx', 0o600);
  try {
    await file.writeFile(encode({ version: 1, createdAt: new Date(), snapshotHash: digest(data),
      snapshot: data, insertedModules: plan.changes.filter(c => c.insert).map(c => c.insert._id),
      changes: plan.changes }));
    await file.sync();
  } finally { await file.close(); }
  return filename;
}

export async function applyPlan(db, data, plan, session) {
  for (const change of plan.changes) {
    if (change.skip) continue;
    const collection = db.collection(change.collection);
    if (change.insert) await collection.insertOne(change.insert, { session });
    else {
      const result = await collection.updateOne({ _id: change.before._id }, { $set: change.set }, { session });
      if (result.matchedCount !== 1) throw new Error('Document disappeared during migration.');
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const env = parseEnv(await readFile(path.join(root, '.env.local'), 'utf8'));
  if (!env.MONGODB_URI) throw new Error('MONGODB_URI missing in .env.local.');
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false });
  const db = mongoose.connection.db;
  const courseId = new ObjectId(options.course);
  const hello = await db.admin().command({ hello: 1 });
  const transactions = Boolean((hello.setName || hello.msg === 'isdbgrid') && hello.logicalSessionTimeoutMinutes != null);
  const data = await readSnapshot(db, courseId);
  const plan = buildPlan(data);
  // Check globally as well as within the selected course; never overwrite a collision.
  const inserted = plan.changes.filter(c => c.insert).map(c => c.insert._id);
  if (inserted.length) {
    // A rerun after an interrupted non-transactional apply finds its own inserted modules.
    // Identical content is a resume; different content is still a hard collision.
    const existing = new Map((await db.collection('modules').find({ _id: { $in: inserted } }).toArray()).map(m => [id(m._id), m]));
    for (const change of plan.changes) {
      if (!change.insert) continue;
      const found = existing.get(id(change.insert._id));
      if (!found) continue;
      if (equal(found, change.insert)) change.skip = true;
      else plan.issues.push('A deterministic child ID already exists with different content; refusing collision/partial migration.');
    }
  }
  console.log(JSON.stringify({ mode: options.apply ? 'apply-preflight' : 'dry-run',
    course: id(courseId), title: data.course.title, transactions,
    before: data.modules.length, after: plan.mapping.length, insertedModules: inserted.length,
    movedLessons: plan.changes.filter(c => c.collection === 'lessons').length,
    changedProgress: plan.changes.filter(c => c.collection === 'studentprogresses').length,
    issues: plan.issues, constraints: [
      ...(!transactions && !options.allowNoTransactions ? ['APPLY BLOCKED: MongoDB transactions unavailable. Pass --allow-no-transactions for the resumable write path.'] : []),
      ...(!transactions && options.allowNoTransactions ? ['NON-TRANSACTIONAL APPLY: resumable and verified, but keep writers paused for the whole run.'] : []),
      'Apply requires all course editing, enrollment and progress writers paused (--maintenance-confirmed).',
      'Application navigation/sequential checks are module-local; cross-module continuation is not implemented by this script.'
    ], mapping: plan.mapping }, null, 2));
  if (!options.apply) { if (plan.issues.length) process.exitCode = 2; return; }
  const canWrite = transactions || options.allowNoTransactions;
  if (plan.issues.length || !canWrite || !options.maintenance) throw new Error('Apply preflight blocked. Resolve reported constraints first.');
  if (!plan.changes.length) { console.log('No changes required.'); return; }
  if (!transactions) {
    // Standalone MongoDB: backup first, then apply resumable idempotent writes and re-verify.
    const backup = await writeBackup(data, plan);
    console.log(`Backup saved: ${backup}`);
    await applyPlan(db, data, plan, undefined);
    const verified = buildPlan(await readSnapshot(db, courseId));
    if (verified.issues.length || verified.changes.length) throw new Error('Post-write idempotency check failed; restore the backup file before retrying.');
    console.log('Non-transactional apply verified: every module now holds exactly one video.');
    return;
  }
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const current = await readSnapshot(db, courseId, session);
      if (!equal(current, data)) throw new Error('Data changed since preflight; rerun dry-run.');
      const backup = await writeBackup(current, plan);
      console.log(`Backup saved: ${backup}`);
      await applyPlan(db, current, plan, session);
      const verified = buildPlan(await readSnapshot(db, courseId, session));
      if (verified.issues.length || verified.changes.length) throw new Error('Post-write idempotency check failed; transaction aborted.');
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' });
    console.log('Transaction committed.');
  } finally { await session.endSession(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { await main(); }
  catch (error) {
    // Driver errors may contain URI/host details. Never print them or stack traces.
    const safe = ['--course', '--apply', 'Invalid arguments', 'Course not found', 'MONGODB_URI missing',
      'Apply preflight blocked', 'Data changed', 'Post-write', 'Backup path', 'Document disappeared'];
    console.error(safe.some(prefix => error.message?.startsWith(prefix)) ? error.message : 'Migration failed; database/environment details suppressed. No nontransactional writes are performed.');
    process.exitCode = 1;
  } finally { await mongoose.disconnect(); }
}
