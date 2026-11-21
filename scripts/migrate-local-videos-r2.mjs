#!/usr/bin/env node
// No Cloudinary deletion. Only lesson video references are changed, with compare-and-set.
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, readFile, stat, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';
import mongoose from 'mongoose';
import { S3Client, HeadBucketCommand, GetBucketCorsCommand, PutBucketCorsCommand,
  HeadObjectCommand, GetObjectCommand, CreateMultipartUploadCommand, UploadPartCommand,
  CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const root = fileURLToPath(new URL('../', import.meta.url));
const backupDir = path.join(root, '.env.r2-migration-backups');
const PART_SIZE = 8 * 1024 * 1024;
export function parseArgs(args) {
  const options = { apply: false, configureCors: false, probe: false, origins: [] };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--apply') options.apply = true;
    else if (args[i] === '--upload-only') { options.apply = true; options.uploadOnly = true; }
    else if (args[i] === '--dry-run') options.dryRun = true;
    else if (args[i] === '--probe') options.probe = true;
    else if (args[i] === '--configure-cors') options.configureCors = true;
    else if (args[i] === '--origin') options.origins.push(args[++i]);
    else throw new Error('Invalid arguments');
  }
  if (options.apply && options.dryRun) throw new Error('Conflicting modes');
  return options;
}
export function normalizeOrigin(value) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) throw new Error('Invalid origin');
  return url.origin;
}
export function mergeCors(existing, origins) {
  const rules = existing.filter(rule => rule.ID !== 'lff-private-video');
  return [...rules, { ID: 'lff-private-video', AllowedOrigins: [...new Set(origins)].sort(),
    AllowedMethods: ['GET', 'HEAD', 'PUT'], AllowedHeaders: ['Content-Type', 'Range', 'If-Match', 'x-amz-*'],
    ExposeHeaders: ['ETag', 'Content-Length', 'Content-Range', 'Accept-Ranges'], MaxAgeSeconds: 3600 }];
}
export function referenceFilter(lesson) {
  const filter = { _id: lesson._id, course: lesson.course, module: lesson.module };
  for (const key of ['videoUrl', 'youtubeVideoId']) filter[key] = Object.hasOwn(lesson, key) ? lesson[key] : { $exists: false };
  return filter;
}
export function objectKey(teacherId, lessonId, sha256) {
  if (!/^[a-f0-9]{24}$/i.test(teacherId) || !/^[a-f0-9]{24}$/i.test(lessonId) || !/^[a-f0-9]{64}$/.test(sha256)) throw new Error('Invalid object identity');
  return `teachers/${teacherId}/videos/migrated/${lessonId}/${sha256}.mp4`;
}
async function privateBackup(name, data) {
  await mkdir(backupDir, { recursive: true, mode: 0o700 });
  const filename = path.join(backupDir, `${Date.now()}-${randomUUID()}-${name}.json`);
  execFileSync('git', ['check-ignore', '-q', '--', filename], { cwd: root, stdio: 'ignore' });
  const file = await open(filename, 'wx', 0o600);
  try { await file.writeFile(JSON.stringify(data, null, 2)); await file.sync(); }
  finally { await file.close(); }
  return filename;
}
async function hashFile(filename) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}
async function head(client, Bucket, Key) {
  try { return await client.send(new HeadObjectCommand({ Bucket, Key })); }
  catch (error) { if (error.$metadata?.httpStatusCode === 404) return null; throw error; }
}
async function upload(client, Bucket, item) {
  const existing = await head(client, Bucket, item.key);
  if (existing) {
    if (existing.ContentLength !== item.size || existing.Metadata?.sha256 !== item.sha256) throw new Error('Existing object verification failed');
    return 'reused';
  }
  const { UploadId } = await client.send(new CreateMultipartUploadCommand({ Bucket, Key: item.key,
    ContentType: 'video/mp4', CacheControl: 'private, no-store', Metadata: { sha256: item.sha256, lesson: item.lessonId } }));
  if (!UploadId) throw new Error('Multipart allocation failed');
  const file = await open(item.localPath, 'r');
  try {
    const parts = [], hash = createHash('sha256');
    let offset = 0;
    while (offset < item.size) {
      const body = Buffer.alloc(Math.min(PART_SIZE, item.size - offset));
      const { bytesRead } = await file.read(body, 0, body.length, offset);
      if (bytesRead !== body.length) throw new Error('Source changed during upload');
      hash.update(body);
      const md5 = createHash('md5').update(body).digest();
      const PartNumber = parts.length + 1;
      const part = await client.send(new UploadPartCommand({ Bucket, Key: item.key, UploadId, PartNumber,
        Body: body, ContentLength: body.length, ContentMD5: md5.toString('base64') }));
      if (!part.ETag || part.ETag.replaceAll('"', '').toLowerCase() !== md5.toString('hex')) throw new Error('Part integrity check failed');
      parts.push({ PartNumber, ETag: part.ETag }); offset += bytesRead;
      console.log(JSON.stringify({ event: 'upload-progress', lessonId: item.lessonId, percent: Math.floor(offset / item.size * 100) }));
    }
    if (hash.digest('hex') !== item.sha256 || (await file.stat()).size !== item.size) throw new Error('Source changed during upload');
    await client.send(new CompleteMultipartUploadCommand({ Bucket, Key: item.key, UploadId, MultipartUpload: { Parts: parts } }));
  } catch (error) {
    await client.send(new AbortMultipartUploadCommand({ Bucket, Key: item.key, UploadId })).catch(() => {});
    throw error;
  } finally { await file.close(); }
  const verified = await head(client, Bucket, item.key);
  if (verified?.ContentLength !== item.size || verified?.Metadata?.sha256 !== item.sha256) throw new Error('Uploaded object verification failed');
  return 'uploaded';
}
async function verifyPlayback(client, bucket, item, origin) {
  const signed = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: item.key }), { expiresIn: 120 });
  const response = await fetch(signed, { headers: { Range: 'bytes=0-31', ...(origin ? { Origin: origin } : {}) }, signal: AbortSignal.timeout(30000) });
  if (response.status !== 206 || response.headers.get('content-range') !== `bytes 0-31/${item.size}`) {
    await response.body?.cancel(); throw new Error('Signed playback range failed');
  }
  const remote = Buffer.from(await response.arrayBuffer());
  const file = await open(item.localPath, 'r');
  try {
    const local = Buffer.alloc(32); await file.read(local, 0, 32, 0);
    if (!remote.equals(local)) throw new Error('Playback bytes mismatch');
  } finally { await file.close(); }
  if (origin && response.headers.get('access-control-allow-origin') !== origin && response.headers.get('access-control-allow-origin') !== '*') throw new Error('Playback CORS verification failed');
}
async function main() {
  const options = parseArgs(process.argv.slice(2));
  const localEnv = parseEnv(await readFile(path.join(root, '.env.local'), 'utf8'));
  const env = { ...localEnv, ...process.env };
  const keys = ['R2_ACCOUNT_ID', 'R2_BUCKET_NAME', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
  const missing = keys.filter(key => !env[key]);
  if (missing.length) { console.log(JSON.stringify({ configured: false, missing })); process.exitCode = 2; return; }
  if (!/^[a-f0-9]{32}$/.test(env.R2_ACCOUNT_ID)) throw new Error('Invalid R2 account configuration');
  const endpoint = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const bucket = env.R2_BUCKET_NAME;
  const client = new S3Client({ region: 'auto', endpoint, forcePathStyle: true,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
    requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED', maxAttempts: 4 });
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
  console.log(JSON.stringify({ credentials: 'verified', bucketAccess: true }));
  const origins = [...new Set(['http://localhost:3000', ...options.origins,
    ...['NEXT_PUBLIC_APP_URL', 'APP_URL', 'AUTH_URL', 'NEXTAUTH_URL'].map(key => env[key]).filter(Boolean)].map(normalizeOrigin))];
  let cors = [];
  try { cors = (await client.send(new GetBucketCorsCommand({ Bucket: bucket }))).CORSRules ?? []; }
  catch (error) {
    if (error.$metadata?.httpStatusCode === 403) {
      console.log(JSON.stringify({ corsReadable: false, corsManagement: 'permission-denied' }));
      if (options.configureCors) throw error;
    } else if (error.name !== 'NoSuchCORSConfiguration' && error.$metadata?.httpStatusCode !== 404) throw error;
  }
  console.log(JSON.stringify({ corsRuleCount: cors.length, expectedOriginCount: origins.length }));
  for (const origin of origins) {
    const signed = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: 'lff-cors-preflight-probe' }), { expiresIn: 60 });
    const response = await fetch(signed, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'range' }, signal: AbortSignal.timeout(15000) });
    const allowed = response.headers.get('access-control-allow-origin');
    console.log(JSON.stringify({ corsPreflight: response.ok && (allowed === origin || allowed === '*') ? 'passed' : 'blocked', origin }));
    await response.body?.cancel();
  }
  if (options.configureCors) {
    const next = mergeCors(cors, origins);
    if (JSON.stringify(next) !== JSON.stringify(cors)) {
      await privateBackup('cors', { previous: cors, next });
      await client.send(new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: { CORSRules: next } }));
      const verified = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
      if (!verified.CORSRules?.some(rule => rule.ID === 'lff-private-video' && origins.every(origin => rule.AllowedOrigins?.includes(origin)))) throw new Error('CORS verification failed');
    }
    console.log(JSON.stringify({ cors: 'configured-and-verified' }));
  }
  if (options.probe) return;
  if (!env.MONGODB_URI) throw new Error('Database configuration missing');
  const map = JSON.parse(await readFile(path.join(root, '.local-video-map.json'), 'utf8'));
  if (!map || Array.isArray(map) || typeof map !== 'object') throw new Error('Invalid video map');
  await mongoose.connect(env.MONGODB_URI, { autoIndex: false, serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db, lessons = db.collection('lessons');
  const plan = [];
  for (const [lessonId, localPath] of Object.entries(map)) {
    if (!/^[a-f0-9]{24}$/i.test(lessonId) || typeof localPath !== 'string' || path.extname(localPath).toLowerCase() !== '.mp4') throw new Error('Invalid video map entry');
    const info = await stat(localPath);
    if (!info.isFile() || info.size < 32) throw new Error('Invalid local video file');
    const lesson = await lessons.findOne({ _id: new mongoose.Types.ObjectId(lessonId) }, { projection: { course: 1, module: 1, videoUrl: 1, youtubeVideoId: 1, lessonType: 1 } });
    if (!lesson || lesson.lessonType !== 'video') throw new Error('Mapped video lesson missing');
    const course = await db.collection('courses').findOne({ _id: lesson.course }, { projection: { teacher: 1 } });
    if (!course?.teacher) throw new Error('Mapped course owner missing');
    const sha256 = await hashFile(localPath);
    const key = objectKey(String(course.teacher), lessonId, sha256);
    const url = `${endpoint}/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
    plan.push({ lessonId, localPath, size: info.size, sha256, key, url, before: lesson });
  }
  console.log(JSON.stringify({ mode: options.apply ? 'apply' : 'dry-run', mappedVideos: plan.length,
    bytes: plan.reduce((sum, item) => sum + item.size, 0), referencesAlreadyMigrated: plan.filter(item => item.before.videoUrl === item.url && !item.before.youtubeVideoId).length }));
  if (!options.apply) return;
  await mkdir(backupDir, { recursive: true, mode: 0o700 });
  const lockPath = path.join(backupDir, 'migration.lock');
  const lock = await open(lockPath, 'wx', 0o600);
  try {
    await lock.writeFile(String(process.pid)); await lock.sync();
    const backup = await privateBackup('references', { version: 1, createdAt: new Date(), plan });
    console.log(JSON.stringify({ backup: path.relative(root, backup) }));
    let updated = 0, reused = 0;
    for (const item of plan) {
      const result = await upload(client, bucket, item);
      await verifyPlayback(client, bucket, item);
      if (options.uploadOnly) {
        console.log(JSON.stringify({ event: 'staged-and-verified', lessonId: item.lessonId, object: result }));
        continue;
      }
      if (item.before.videoUrl === item.url && !item.before.youtubeVideoId) reused++;
      else {
        const update = await lessons.updateOne(referenceFilter(item.before), { $set: { videoUrl: item.url }, $unset: { youtubeVideoId: '' } });
        if (update.matchedCount !== 1) throw new Error('Lesson changed during migration; reference not overwritten');
        updated++;
      }
      const after = await lessons.findOne({ _id: item.before._id }, { projection: { videoUrl: 1, youtubeVideoId: 1 } });
      if (after?.videoUrl !== item.url || after.youtubeVideoId) throw new Error('Reference verification failed');
      console.log(JSON.stringify({ event: 'verified', lessonId: item.lessonId, object: result }));
    }
    console.log(JSON.stringify({ complete: true, verifiedVideos: plan.length, referencesUpdated: updated, referencesReused: reused, cloudinaryDeleted: 0, localMapPreserved: true }));
  } finally { await lock.close(); await unlink(lockPath); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { await main(); }
  catch (error) {
    // Never print SDK errors, URLs, connection strings, or provider response bodies.
    const status = error.$metadata?.httpStatusCode;
    const safeNames = ['AccessDenied', 'InvalidAccessKeyId', 'SignatureDoesNotMatch', 'NoSuchBucket', 'Forbidden', 'TimeoutError'];
    console.error(JSON.stringify({ failed: true, kind: safeNames.includes(error.name) ? error.name : 'MigrationError', ...(status ? { httpStatus: status } : {}), details: 'Sensitive diagnostics suppressed; existing Cloudinary assets retained.' }));
    process.exitCode = 1;
  } finally { await mongoose.disconnect(); }
}
