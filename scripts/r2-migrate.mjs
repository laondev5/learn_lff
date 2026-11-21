// Never runs implicitly. Default is read-only. Use --apply to upload and update lessons.
// Backup lives under ignored .env.r2-migration-backups/ and is written before DB changes.
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import mongoose from "mongoose";
import { HeadObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Config, safeFailure } from "./r2-common.mjs";
const apply = process.argv.includes("--apply");
const backupDir = ".env.r2-migration-backups";
async function digest(stream) { const h = createHash("sha256"); for await (const chunk of stream) h.update(chunk); return h.digest("hex"); }
try {
  for (const file of [".local-video-map.json", `${backupDir}/check.json`]) {
    execFileSync("git", ["check-ignore", "--quiet", file], { stdio: "ignore" });
  }
  const map = JSON.parse(await readFile(".local-video-map.json", "utf8"));
  const { client, bucket, endpoint } = r2Config();
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db, lessons = db.collection("lessons");
  const plan = [];
  for (const [id, file] of Object.entries(map)) {
    if (!/^[a-f0-9]{24}$/.test(id) || typeof file !== "string" || !path.isAbsolute(file)) throw new Error("Invalid local video map");
    const lesson = await lessons.findOne({ _id: new mongoose.Types.ObjectId(id) });
    if (!lesson) throw new Error("Mapped lesson missing");
    const course = await db.collection("courses").findOne({ _id: lesson.course });
    if (!course?.teacher) throw new Error("Course teacher missing");
    const size = (await stat(file)).size;
    if (size < 1 || size > 5 * 1024 ** 3) throw new Error("Migration file outside single-PUT size limit");
    const sha256 = await digest(createReadStream(file));
    const key = `teachers/${course.teacher}/videos/migration/${id}/${sha256}.mp4`;
    const url = `${endpoint}/${bucket}/${key}`;
    plan.push({ id, file, size, sha256, key, url, oldUrl: lesson.videoUrl ?? null, hadUrl: Object.hasOwn(lesson, "videoUrl") });
  }
  console.log(`${apply ? "APPLY" : "DRY RUN"}: ${plan.length} mapped videos; ${plan.filter(p => p.oldUrl !== p.url).length} URL updates planned.`);
  if (apply) {
    await mkdir(backupDir, { recursive: true });
    const backup = path.join(backupDir, `${Date.now()}-${randomUUID()}.json`);
    await writeFile(backup, JSON.stringify({ createdAt: new Date().toISOString(), entries: plan }, null, 2), { flag: "wx", mode: 0o600 });
    console.log("Ignored rollback mapping saved before changes.");
  }
  for (const entry of plan) {
    const input = { Bucket: bucket, Key: entry.key };
    let head;
    try { head = await client.send(new HeadObjectCommand(input)); }
    catch (error) { if (error.$metadata?.httpStatusCode !== 404) throw error; }
    if (!apply) { console.log(`${entry.id}: ${head ? "object exists; verification required on apply" : "would upload"}`); continue; }
    if (!head) {
      await client.send(new PutObjectCommand({ ...input, Body: createReadStream(entry.file), ContentLength: entry.size, ContentType: "video/mp4", CacheControl: "private, no-store", Metadata: { sha256: entry.sha256 } }));
      head = await client.send(new HeadObjectCommand(input));
    }
    if (head.ContentLength !== entry.size || head.Metadata?.sha256 !== entry.sha256) throw new Error("Uploaded object metadata mismatch");
    // Verify actual remote bytes, not merely user-supplied hash metadata.
    const remote = await client.send(new GetObjectCommand(input));
    if (!remote.Body || await digest(remote.Body) !== entry.sha256) throw new Error("Uploaded object checksum mismatch");
    if (entry.oldUrl !== entry.url) {
      const filter = { _id: new mongoose.Types.ObjectId(entry.id), videoUrl: entry.hadUrl ? entry.oldUrl : { $exists: false } };
      const updated = await lessons.updateOne(filter, { $set: { videoUrl: entry.url, updatedAt: new Date() } });
      if (updated.matchedCount !== 1) throw new Error("Lesson changed concurrently; refusing overwrite");
    }
    console.log(`${entry.id}: verified${entry.oldUrl === entry.url ? "; already migrated" : "; URL saved"}`);
  }
} catch (error) { safeFailure("Migration stopped", error); }
finally { await mongoose.disconnect(); }
